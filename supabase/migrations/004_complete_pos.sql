-- Abbas Book Bank POS: checkout, returns, staff directory, and reporting.
-- Apply ONCE after the existing foundation and operations migrations.
-- No destructive schema changes. Run in the correct Supabase project.
BEGIN;

-- Idempotent seller checkout: branch always comes from verified server session.
CREATE OR REPLACE FUNCTION public.pos_checkout(p_items jsonb,p_request_key uuid,p_method text DEFAULT 'cash')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid();v_branch uuid;v_existing public.checkout_requests%ROWTYPE;
 v_hash text;v_total numeric(12,2):=0;v_sale uuid;v_item record;v_price numeric(12,2);v_available integer;
BEGIN
 IF v_user IS NULL OR public.current_pos_role()<>'seller' THEN RAISE EXCEPTION 'Seller session required'; END IF;
 SELECT a.branch_id INTO v_branch FROM public.active_access a JOIN public.branches b ON b.id=a.branch_id AND b.enabled
 WHERE a.user_id=v_user AND a.role='seller' AND a.expires_at>now();
 IF v_branch IS NULL THEN RAISE EXCEPTION 'Verified shop required';END IF;
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

-- Return items refer to original sale_item IDs, never user-provided prices.
CREATE OR REPLACE FUNCTION public.pos_return_sale(p_sale_id uuid,p_items jsonb,p_reason text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_branch uuid;v_sale public.sales%ROWTYPE;v_item record;v_return uuid;
 v_amount numeric(12,2):=0;v_prev uuid;v_allowed integer;v_existing integer;
BEGIN
 IF public.current_pos_role() NOT IN ('admin','seller') THEN RAISE EXCEPTION 'POS session required';END IF;
 IF p_request_key IS NULL THEN RAISE EXCEPTION 'Return request key required';END IF;
 IF length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Return reason required';END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid return items';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE (x->>'quantity') !~ '^[1-9][0-9]{0,3}$' OR (x->>'sale_item_id') !~ '^[0-9a-fA-F-]{36}$') THEN RAISE EXCEPTION 'Invalid return item';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT x->>'sale_item_id') FROM jsonb_array_elements(p_items) x) THEN RAISE EXCEPTION 'Duplicate return item';END IF;
 SELECT * INTO v_sale FROM public.sales WHERE id=p_sale_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found';END IF;
 IF public.current_pos_role()='seller' THEN
  v_branch:=public.current_pos_branch();
  IF v_branch IS NULL OR v_sale.branch_id<>v_branch THEN RAISE EXCEPTION 'Sale belongs to another shop';END IF;
 END IF;
 -- The request key is recorded in audit details and protected by an advisory transaction lock.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
 SELECT entity_id INTO v_prev FROM public.audit_events WHERE action='sale_returned' AND details->>'request_key'=p_request_key::text AND actor_id=v_actor LIMIT 1;
 IF v_prev IS NOT NULL THEN RETURN jsonb_build_object('return_id',v_prev,'duplicate',true);END IF;
 INSERT INTO public.sale_returns(sale_id,branch_id,status,reason,created_by,completed_at)
 VALUES(p_sale_id,v_sale.branch_id,'completed',btrim(p_reason),v_actor,now()) RETURNING id INTO v_return;
 FOR v_item IN SELECT (x->>'sale_item_id')::uuid sale_item_id,(x->>'quantity')::integer qty,coalesce((x->>'restockable')::boolean,true) restockable FROM jsonb_array_elements(p_items) x ORDER BY x->>'sale_item_id' LOOP
  SELECT quantity INTO v_allowed FROM public.sale_items WHERE id=v_item.sale_item_id AND sale_id=p_sale_id;
  IF v_allowed IS NULL THEN RAISE EXCEPTION 'Item does not belong to this sale';END IF;
  SELECT coalesce(sum(ri.quantity),0) INTO v_existing FROM public.sale_return_items ri JOIN public.sale_returns r ON r.id=ri.return_id WHERE ri.sale_item_id=v_item.sale_item_id AND r.status='completed';
  IF v_item.qty>v_allowed-v_existing THEN RAISE EXCEPTION 'Return exceeds unreturned quantity';END IF;
  INSERT INTO public.sale_return_items(return_id,sale_item_id,quantity,restockable) VALUES(v_return,v_item.sale_item_id,v_item.qty,v_item.restockable);
  SELECT v_amount+v_item.qty*unit_price INTO v_amount FROM public.sale_items WHERE id=v_item.sale_item_id;
  IF v_item.restockable THEN
   INSERT INTO public.stock(branch_id,product_id,quantity)
   SELECT v_sale.branch_id,product_id,v_item.qty FROM public.sale_items WHERE id=v_item.sale_item_id
   ON CONFLICT(branch_id,product_id) DO UPDATE SET quantity=public.stock.quantity+excluded.quantity;
   INSERT INTO public.inventory_movements(branch_id,product_id,delta,reason,source_type,source_id,actor_id)
   SELECT v_sale.branch_id,product_id,v_item.qty,'return','return',v_return,v_actor FROM public.sale_items WHERE id=v_item.sale_item_id;
  END IF;
 END LOOP;
 UPDATE public.sale_returns SET refund_amount=v_amount WHERE id=v_return;
 INSERT INTO public.audit_events(actor_id,branch_id,action,entity_type,entity_id,details)
 VALUES(v_actor,v_sale.branch_id,'sale_returned','sale_return',v_return,jsonb_build_object('request_key',p_request_key,'sale_id',p_sale_id,'refund_amount',v_amount));
 RETURN jsonb_build_object('return_id',v_return,'refund_amount',v_amount,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.pos_return_sale(uuid,jsonb,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_return_sale(uuid,jsonb,text,uuid) TO authenticated;

-- Restricted read APIs avoid exposing private staff and financial tables.
CREATE OR REPLACE FUNCTION public.pos_sales_detail(p_sale_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_sale public.sales%ROWTYPE;
BEGIN
 IF public.current_pos_role() NOT IN ('admin','seller') THEN RAISE EXCEPTION 'Unauthorized';END IF;
 SELECT * INTO v_sale FROM public.sales WHERE id=p_sale_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found';END IF;
 IF public.current_pos_role()='seller' AND (v_sale.branch_id IS DISTINCT FROM public.current_pos_branch() OR v_sale.seller_id<>auth.uid()) THEN RAISE EXCEPTION 'Sale unavailable';END IF;
 RETURN jsonb_build_object('sale',to_jsonb(v_sale),'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',si.id,'product_id',si.product_id,'name',p.name,'quantity',si.quantity,'unit_price',si.unit_price,'returned_quantity',coalesce((SELECT sum(ri.quantity) FROM public.sale_return_items ri JOIN public.sale_returns r ON r.id=ri.return_id WHERE ri.sale_item_id=si.id AND r.status='completed'),0))) FROM public.sale_items si JOIN public.products p ON p.id=si.product_id WHERE si.sale_id=p_sale_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.pos_sales_detail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_sales_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_staff_directory(p_id uuid DEFAULT NULL,p_name text DEFAULT NULL,p_branch_id uuid DEFAULT NULL,p_enabled boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM public.pos_admin_required();
 IF p_name IS NOT NULL THEN
  IF length(btrim(p_name)) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Invalid staff name';END IF;
  IF p_id IS NULL THEN
   INSERT INTO public.staff_profiles(display_name,branch_id,enabled) VALUES(btrim(p_name),p_branch_id,p_enabled) RETURNING id INTO v_id;
  ELSE
   UPDATE public.staff_profiles SET display_name=btrim(p_name),branch_id=p_branch_id,enabled=p_enabled WHERE id=p_id RETURNING id INTO v_id;
   IF v_id IS NULL THEN RAISE EXCEPTION 'Staff record not found';END IF;
  END IF;
  INSERT INTO public.audit_events(actor_id,branch_id,action,entity_type,entity_id) VALUES(auth.uid(),p_branch_id,'staff_record_saved','staff_profile',v_id);
 END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.display_name) FROM public.staff_profiles s),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.pos_staff_directory(uuid,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_staff_directory(uuid,text,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_reports(p_from date DEFAULT CURRENT_DATE-30,p_to date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.pos_admin_required();
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Invalid reporting period';END IF;
 RETURN jsonb_build_object(
 'daily_sales',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT s.created_at::date day,count(*) sales,sum(s.total) gross FROM public.sales s WHERE s.created_at>=p_from AND s.created_at<p_to+1 GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'branches',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.name,count(s.id) sales,coalesce(sum(s.total),0) gross FROM public.branches b LEFT JOIN public.sales s ON s.branch_id=b.id AND s.created_at>=p_from AND s.created_at<p_to+1 GROUP BY b.id,b.name ORDER BY b.name) x),'[]'::jsonb),
 'returns',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT r.branch_id,count(*) returns,coalesce(sum(r.refund_amount),0) refunds FROM public.sale_returns r WHERE r.status='completed' AND r.completed_at>=p_from AND r.completed_at<p_to+1 GROUP BY r.branch_id) x),'[]'::jsonb),
 'stock',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.name branch,p.name product,st.quantity,p.price FROM public.stock st JOIN public.branches b ON b.id=st.branch_id JOIN public.products p ON p.id=st.product_id ORDER BY b.name,p.name LIMIT 10000) x),'[]'::jsonb),
 'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT created_at,action,entity_type,entity_id,branch_id,actor_id FROM public.audit_events WHERE created_at>=p_from AND created_at<p_to+1 ORDER BY created_at DESC LIMIT 1000) x),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION public.pos_reports(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_reports(date,date) TO authenticated;
COMMIT;
