-- Abbas Book Bank POS: daily cash register, Karachi business date.
-- Run this ONE migration in Supabase SQL Editor. It creates no sample transactions.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pos_cash_registers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 branch_id uuid NOT NULL REFERENCES public.branches(id),
 business_date date NOT NULL,
 opening_cash numeric(14,2) NOT NULL CHECK(opening_cash>=0),
 opened_by uuid NOT NULL REFERENCES auth.users(id),
 opened_at timestamptz NOT NULL DEFAULT now(),
 opening_note text,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 counted_cash numeric(14,2) CHECK(counted_cash>=0),
 closed_by uuid REFERENCES auth.users(id),
 closed_at timestamptz,
 UNIQUE(branch_id,business_date)
);
CREATE TABLE IF NOT EXISTS public.pos_cash_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 register_id uuid NOT NULL REFERENCES public.pos_cash_registers(id),
 kind text NOT NULL CHECK(kind IN ('deposit','withdrawal','refund')),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 reason text NOT NULL CHECK(length(btrim(reason))>=3),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_cash_movements_register_idx ON public.pos_cash_movements(register_id);
ALTER TABLE public.pos_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_cash_registers,public.pos_cash_movements FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pos_cash_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_branch uuid;v_day date:=(now() AT TIME ZONE 'Asia/Karachi')::date;v_reg public.pos_cash_registers%ROWTYPE;
 v_sales numeric(14,2);v_adjust numeric(14,2);v_expected numeric(14,2);
BEGIN
 IF public.current_pos_role()<>'seller' THEN RAISE EXCEPTION 'Seller session required';END IF;
 SELECT branch_id INTO v_branch FROM public.active_access WHERE user_id=auth.uid() AND role='seller' AND expires_at>now();
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Verified shop required';END IF;
 SELECT * INTO v_reg FROM public.pos_cash_registers WHERE branch_id=v_branch AND business_date=v_day;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_opened','business_date',v_day,'branch_id',v_branch);END IF;
 SELECT coalesce(sum(sp.amount),0) INTO v_sales FROM public.sales s JOIN public.sale_payments sp ON sp.sale_id=s.id
 WHERE s.branch_id=v_branch AND sp.method='cash' AND s.created_at>=v_reg.opened_at AND s.created_at<coalesce(v_reg.closed_at,now());
 SELECT coalesce(sum(CASE WHEN kind='deposit' THEN amount ELSE -amount END),0) INTO v_adjust FROM public.pos_cash_movements WHERE register_id=v_reg.id;
 v_expected:=v_reg.opening_cash+v_sales+v_adjust;
 RETURN jsonb_build_object('id',v_reg.id,'status',v_reg.status,'branch_id',v_branch,'business_date',v_day,'opening_cash',v_reg.opening_cash,'cash_sales',v_sales,'adjustments',v_adjust,'expected_cash',v_expected,'counted_cash',v_reg.counted_cash,'difference',CASE WHEN v_reg.counted_cash IS NULL THEN NULL ELSE v_reg.counted_cash-v_expected END);
END $$;
REVOKE ALL ON FUNCTION public.pos_cash_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cash_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_cash_open(p_opening_cash numeric,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_branch uuid;v_day date:=(now() AT TIME ZONE 'Asia/Karachi')::date;v_reg public.pos_cash_registers%ROWTYPE;
BEGIN
 IF public.current_pos_role()<>'seller' THEN RAISE EXCEPTION 'Seller session required';END IF;
 SELECT a.branch_id INTO v_branch FROM public.active_access a JOIN public.branches b ON b.id=a.branch_id AND b.enabled WHERE a.user_id=auth.uid() AND a.role='seller' AND a.expires_at>now();
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Verified shop required';END IF;
 IF p_opening_cash IS NULL OR p_opening_cash<0 OR p_opening_cash>100000000 OR p_opening_cash<>round(p_opening_cash,2) THEN RAISE EXCEPTION 'Invalid opening cash';END IF;
 INSERT INTO public.pos_cash_registers(branch_id,business_date,opening_cash,opened_by,opening_note)
 VALUES(v_branch,v_day,p_opening_cash,auth.uid(),left(coalesce(p_note,''),250))
 ON CONFLICT(branch_id,business_date) DO NOTHING;
 SELECT * INTO v_reg FROM public.pos_cash_registers WHERE branch_id=v_branch AND business_date=v_day;
 RETURN jsonb_build_object('id',v_reg.id,'status',v_reg.status,'opening_cash',v_reg.opening_cash,'business_date',v_day,'already_existed',v_reg.opened_by<>auth.uid() OR v_reg.opening_cash<>p_opening_cash);
END $$;
REVOKE ALL ON FUNCTION public.pos_cash_open(numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cash_open(numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_cash_movement(p_kind text,p_amount numeric,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_branch uuid;v_reg uuid;
BEGIN
 IF public.current_pos_role()<>'seller' THEN RAISE EXCEPTION 'Seller session required';END IF;
 SELECT branch_id INTO v_branch FROM public.active_access WHERE user_id=auth.uid() AND role='seller' AND expires_at>now();
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Verified shop required';END IF;
 IF p_kind NOT IN ('deposit','withdrawal','refund') OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000000 OR p_amount<>round(p_amount,2) OR length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Invalid movement';END IF;
 SELECT id INTO v_reg FROM public.pos_cash_registers WHERE branch_id=v_branch AND business_date=(now() AT TIME ZONE 'Asia/Karachi')::date AND status='open' FOR UPDATE;
 IF v_reg IS NULL THEN RAISE EXCEPTION 'Open register required';END IF;
 INSERT INTO public.pos_cash_movements(register_id,kind,amount,reason,actor_id) VALUES(v_reg,p_kind,p_amount,left(btrim(p_reason),250),auth.uid());
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.pos_cash_movement(text,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cash_movement(text,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_cash_close(p_counted_cash numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_branch uuid;v_reg uuid;
BEGIN
 IF public.current_pos_role()<>'seller' THEN RAISE EXCEPTION 'Seller session required';END IF;
 SELECT branch_id INTO v_branch FROM public.active_access WHERE user_id=auth.uid() AND role='seller' AND expires_at>now();
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Verified shop required';END IF;
 IF p_counted_cash IS NULL OR p_counted_cash<0 OR p_counted_cash>100000000 OR p_counted_cash<>round(p_counted_cash,2) THEN RAISE EXCEPTION 'Invalid counted cash';END IF;
 SELECT id INTO v_reg FROM public.pos_cash_registers WHERE branch_id=v_branch AND business_date=(now() AT TIME ZONE 'Asia/Karachi')::date AND status='open' FOR UPDATE;
 IF v_reg IS NULL THEN RAISE EXCEPTION 'No open register';END IF;
 UPDATE public.pos_cash_registers SET status='closed',counted_cash=p_counted_cash,closed_by=auth.uid(),closed_at=now() WHERE id=v_reg;
 RETURN jsonb_build_object('ok',true,'id',v_reg);
END $$;
REVOKE ALL ON FUNCTION public.pos_cash_close(numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cash_close(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_cash_admin_overview()
RETURNS TABLE(id uuid,shop_name text,business_date date,status text,opening_cash numeric,cash_sales numeric,adjustments numeric,expected_cash numeric,counted_cash numeric,difference numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.current_pos_role()<>'admin' THEN RAISE EXCEPTION 'Admin only';END IF;
 RETURN QUERY SELECT r.id,b.name,r.business_date,r.status,r.opening_cash,
 coalesce((SELECT sum(sp.amount) FROM public.sales s JOIN public.sale_payments sp ON sp.sale_id=s.id WHERE s.branch_id=r.branch_id AND sp.method='cash' AND s.created_at>=r.opened_at AND s.created_at<coalesce(r.closed_at,now())),0)::numeric AS cash_sales,
 coalesce((SELECT sum(CASE WHEN m.kind='deposit' THEN m.amount ELSE -m.amount END) FROM public.pos_cash_movements m WHERE m.register_id=r.id),0)::numeric AS adjustments,
 (r.opening_cash + coalesce((SELECT sum(sp.amount) FROM public.sales s JOIN public.sale_payments sp ON sp.sale_id=s.id WHERE s.branch_id=r.branch_id AND sp.method='cash' AND s.created_at>=r.opened_at AND s.created_at<coalesce(r.closed_at,now())),0) + coalesce((SELECT sum(CASE WHEN m.kind='deposit' THEN m.amount ELSE -m.amount END) FROM public.pos_cash_movements m WHERE m.register_id=r.id),0))::numeric AS expected_cash,
 r.counted_cash,
 CASE WHEN r.counted_cash IS NULL THEN NULL ELSE r.counted_cash-r.opening_cash-coalesce((SELECT sum(sp.amount) FROM public.sales s JOIN public.sale_payments sp ON sp.sale_id=s.id WHERE s.branch_id=r.branch_id AND sp.method='cash' AND s.created_at>=r.opened_at AND s.created_at<coalesce(r.closed_at,now())),0)-coalesce((SELECT sum(CASE WHEN m.kind='deposit' THEN m.amount ELSE -m.amount END) FROM public.pos_cash_movements m WHERE m.register_id=r.id),0) END::numeric AS difference
 FROM public.pos_cash_registers r JOIN public.branches b ON b.id=r.branch_id ORDER BY r.business_date DESC,b.name LIMIT 300;
END $$;
REVOKE ALL ON FUNCTION public.pos_cash_admin_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cash_admin_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_cash_admin_reopen(p_register_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_reg public.pos_cash_registers%ROWTYPE;
BEGIN
 IF public.current_pos_role()<>'admin' THEN RAISE EXCEPTION 'Admin only';END IF;
 SELECT * INTO v_reg FROM public.pos_cash_registers WHERE id=p_register_id FOR UPDATE;
 IF NOT FOUND OR v_reg.business_date<>(now() AT TIME ZONE 'Asia/Karachi')::date OR v_reg.status<>'closed' THEN RAISE EXCEPTION 'Only a closed register for today may be reopened';END IF;
 UPDATE public.pos_cash_registers SET status='open',counted_cash=NULL,closed_by=NULL,closed_at=NULL WHERE id=p_register_id;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.pos_cash_admin_reopen(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cash_admin_reopen(uuid) TO authenticated;

-- Replace only the existing checkout function, retaining its stock and idempotency behavior.
CREATE OR REPLACE FUNCTION public.pos_checkout(p_items jsonb,p_request_key uuid,p_method text DEFAULT 'cash')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_branch uuid;v_existing public.checkout_requests%ROWTYPE;
 v_hash text;v_total numeric(12,2):=0;v_sale uuid;v_item record;v_price numeric(12,2);v_available integer;
BEGIN
 IF v_user IS NULL OR public.current_pos_role()<>'seller' THEN RAISE EXCEPTION 'Seller session required'; END IF;
 SELECT a.branch_id INTO v_branch FROM public.active_access a JOIN public.branches b ON b.id=a.branch_id AND b.enabled
 WHERE a.user_id=v_user AND a.role='seller' AND a.expires_at>now();
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Verified shop required';END IF;
 -- Serialize checkout against register closing. Never book sales into a closed register.
 PERFORM 1 FROM public.pos_cash_registers WHERE branch_id=v_branch AND business_date=(now() AT TIME ZONE 'Asia/Karachi')::date AND status='open' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Open cash register required before checkout';END IF;
 IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required';END IF;
 IF p_method NOT IN ('cash','card','bank_transfer','other') THEN RAISE EXCEPTION 'Invalid payment method';END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid cart';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE (x->>'quantity') !~ '^[1-9][0-9]{0,3}$' OR (x->>'product_id') !~ '^[0-9a-fA-F-]{36}$') THEN RAISE EXCEPTION 'Invalid cart item';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT x->>'product_id') FROM jsonb_array_elements(p_items) x) THEN RAISE EXCEPTION 'Duplicate product';END IF;
 SELECT md5(string_agg((x->>'product_id')||':'||(x->>'quantity'),',' ORDER BY x->>'product_id')||':'||p_method)
 INTO v_hash FROM jsonb_array_elements(p_items) x;
 -- Unique request row serializes concurrent retries, including two browser tabs.
 INSERT INTO public.checkout_requests(user_id,branch_id,request_key,request_hash)
 VALUES(v_user,v_branch,p_request_key,v_hash) ON CONFLICT(user_id,request_key) DO NOTHING;
 SELECT * INTO v_existing FROM public.checkout_requests WHERE user_id=v_user AND request_key=p_request_key FOR UPDATE;
 IF v_existing.request_hash<>v_hash OR v_existing.branch_id<>v_branch THEN RAISE EXCEPTION 'Checkout key reused for different cart';END IF;
 IF v_existing.sale_id IS NOT NULL THEN
  RETURN jsonb_build_object('sale_id',v_existing.sale_id,'total',(SELECT total FROM public.sales WHERE id=v_existing.sale_id),'branch_id',v_branch,'duplicate',true);
 END IF;
 FOR v_item IN SELECT (x->>'product_id')::uuid product_id,(x->>'quantity')::integer qty FROM jsonb_array_elements(p_items) x ORDER BY x->>'product_id' LOOP
  SELECT price INTO v_price FROM public.products WHERE id=v_item.product_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable';END IF;
  SELECT quantity INTO v_available FROM public.stock WHERE branch_id=v_branch AND product_id=v_item.product_id FOR UPDATE;
  IF v_available IS NULL OR v_available<v_item.qty THEN RAISE EXCEPTION 'Insufficient shop stock for product %',v_item.product_id;END IF;
  v_total:=v_total+v_price*v_item.qty;
 END LOOP;
 INSERT INTO public.sales(seller_id,branch_id,total) VALUES(v_user,v_branch,v_total) RETURNING id INTO v_sale;
 FOR v_item IN SELECT (x->>'product_id')::uuid product_id,(x->>'quantity')::integer qty FROM jsonb_array_elements(p_items) x ORDER BY x->>'product_id' LOOP
  SELECT price INTO v_price FROM public.products WHERE id=v_item.product_id;
  UPDATE public.stock SET quantity=quantity-v_item.qty WHERE branch_id=v_branch AND product_id=v_item.product_id;
  INSERT INTO public.sale_items(sale_id,product_id,quantity,unit_price) VALUES(v_sale,v_item.product_id,v_item.qty,v_price);
  INSERT INTO public.inventory_movements(branch_id,product_id,delta,reason,source_type,source_id,actor_id)
  VALUES(v_branch,v_item.product_id,-v_item.qty,'sale','sale',v_sale,v_user);
 END LOOP;
 IF v_total>0 THEN INSERT INTO public.sale_payments(sale_id,method,amount) VALUES(v_sale,p_method,v_total);END IF;
 UPDATE public.checkout_requests SET sale_id=v_sale WHERE user_id=v_user AND request_key=p_request_key;
 INSERT INTO public.audit_events(actor_id,branch_id,action,entity_type,entity_id)
 VALUES(v_user,v_branch,'sale_completed','sale',v_sale);
 RETURN jsonb_build_object('sale_id',v_sale,'total',v_total,'branch_id',v_branch,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.pos_checkout(jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_checkout(jsonb,uuid,text) TO authenticated;


COMMIT;
