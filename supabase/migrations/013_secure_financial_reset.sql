-- Abbas Book Bank: atomic, PIN-authorized reporting-period transition.
-- REVIEW IN STAGING FIRST. Requires migration 012.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pos_reporting_reset_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 previous_period_id bigint NOT NULL REFERENCES public.pos_reporting_periods(id),
 new_period_id bigint NOT NULL REFERENCES public.pos_reporting_periods(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 reset_at timestamptz NOT NULL,
 previous_sales_count bigint NOT NULL,
 previous_expenses_count bigint NOT NULL,
 stock_rows_preserved bigint NOT NULL
);
ALTER TABLE public.pos_reporting_reset_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_reporting_reset_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pos_reset_financial_period(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_hash text; v_attempt public.login_attempts%rowtype;
 v_old bigint; v_new bigint; v_at timestamptz; v_open bigint; v_sales bigint; v_expenses bigint; v_stock bigint;
BEGIN
 IF v_actor IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN
   RAISE EXCEPTION 'Administrator access required';
 END IF;
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('ok',false,'error','Enter a six-digit admin PIN'); END IF;
 -- Serialize reset attempts, including those from different administrators.
 PERFORM pg_catalog.pg_advisory_xact_lock(817211, 13);
 INSERT INTO public.login_attempts(user_id) VALUES(v_actor) ON CONFLICT DO NOTHING;
 SELECT * INTO v_attempt FROM public.login_attempts WHERE user_id=v_actor FOR UPDATE;
 IF v_attempt.locked_until>pg_catalog.clock_timestamp() THEN
  RETURN jsonb_build_object('ok',false,'error','Too many PIN attempts. Try later.');
 END IF;
 SELECT c.pin_hash INTO v_hash FROM public.pin_credentials c
  WHERE c.enabled AND c.role='admin' AND c.pin_hash=public.crypt(p_pin,c.pin_hash) LIMIT 1;
 IF v_hash IS NULL THEN
  UPDATE public.login_attempts SET failures=CASE WHEN failures>=4 THEN 0 ELSE failures+1 END,
   locked_until=CASE WHEN failures>=4 THEN now()+interval '15 minutes' ELSE NULL END,updated_at=now()
   WHERE user_id=v_actor;
  RETURN jsonb_build_object('ok',false,'error','Invalid admin PIN');
 END IF;
 UPDATE public.login_attempts SET failures=0,locked_until=NULL,updated_at=now() WHERE user_id=v_actor;
 -- Serialize reporting-period transitions against financial writes. Lock order is fixed.
 -- Writers already in progress finish before these locks are acquired.
 -- Writers that begin later wait until the new period is committed.
 LOCK TABLE public.pos_cash_registers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.sales IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.sale_returns IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.pos_operating_expenses IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.pos_cash_movements IN SHARE ROW EXCLUSIVE MODE;
 SELECT count(*) INTO v_open FROM public.pos_cash_registers WHERE status='open';
 IF v_open<>0 THEN RETURN jsonb_build_object('ok',false,'error','Close all shop cash registers before resetting','open_registers',v_open); END IF;
 SELECT id INTO v_old FROM public.pos_reporting_periods WHERE ended_at IS NULL FOR UPDATE;
 IF v_old IS NULL THEN RAISE EXCEPTION 'No active reporting period'; END IF;
 SELECT count(*) INTO v_sales FROM public.sales;
 SELECT count(*) INTO v_expenses FROM public.pos_operating_expenses;
 SELECT count(*) INTO v_stock FROM public.stock;
 v_at:=pg_catalog.clock_timestamp();
 UPDATE public.pos_reporting_periods SET ended_at=v_at WHERE id=v_old;
 INSERT INTO public.pos_reporting_periods(started_at,initiated_by,reason)
 VALUES(v_at,v_actor,'Administrator financial reporting reset') RETURNING id INTO v_new;
 INSERT INTO public.pos_reporting_reset_audit(previous_period_id,new_period_id,actor_id,reset_at,
   previous_sales_count,previous_expenses_count,stock_rows_preserved)
 VALUES(v_old,v_new,v_actor,v_at,v_sales,v_expenses,v_stock);
 RETURN jsonb_build_object('ok',true,'new_period_id',v_new,'previous_period_id',v_old,'started_at',v_at);
END $$;
REVOKE ALL ON FUNCTION public.pos_reset_financial_period(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_reset_financial_period(text) TO authenticated;

-- Assign financial event timestamps at the actual insert time, not at the start of
-- a transaction that may have waited for the reporting-period transition.
CREATE OR REPLACE FUNCTION public.abb_financial_event_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='sales' THEN
  NEW.created_at:=pg_catalog.clock_timestamp();
 ELSIF TG_TABLE_NAME='sale_returns' THEN
  IF NEW.status='completed' THEN NEW.completed_at:=pg_catalog.clock_timestamp(); END IF;
 ELSIF TG_TABLE_NAME='pos_operating_expenses' THEN
  NEW.created_at:=pg_catalog.clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.abb_financial_event_timestamp() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS abb_financial_sale_time ON public.sales;
CREATE TRIGGER abb_financial_sale_time BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.abb_financial_event_timestamp();
DROP TRIGGER IF EXISTS abb_financial_return_time ON public.sale_returns;
CREATE TRIGGER abb_financial_return_time BEFORE INSERT ON public.sale_returns
FOR EACH ROW EXECUTE FUNCTION public.abb_financial_event_timestamp();
DROP TRIGGER IF EXISTS abb_financial_expense_time ON public.pos_operating_expenses;
CREATE TRIGGER abb_financial_expense_time BEFORE INSERT ON public.pos_operating_expenses
FOR EACH ROW EXECUTE FUNCTION public.abb_financial_event_timestamp();

-- Do not allow editing/deleting financial expenses belonging to closed periods.
CREATE OR REPLACE FUNCTION public.pos_delete_expense(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_created timestamptz; v_start timestamptz;
BEGIN
 PERFORM public.pos_admin_required();
 SELECT started_at INTO v_start FROM public.pos_reporting_periods WHERE ended_at IS NULL;
 IF v_start IS NULL THEN RAISE EXCEPTION 'Active reporting period missing'; END IF;
 SELECT created_at INTO v_created FROM public.pos_operating_expenses WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_created<v_start THEN RAISE EXCEPTION 'Historical expenses cannot be deleted. Preserve audit history.'; END IF;
 DELETE FROM public.pos_operating_expenses WHERE id=p_id;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.pos_delete_expense(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_delete_expense(uuid) TO authenticated;

-- Once this migration is installed, readiness text must not claim reset is disabled.
CREATE OR REPLACE FUNCTION public.pos_reset_preflight()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_open bigint; v_sales bigint; v_returns bigint; v_expenses bigint; v_period bigint; v_stock bigint;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN
  RAISE EXCEPTION 'Administrator access required';
 END IF;
 SELECT count(*) INTO v_open FROM public.pos_cash_registers WHERE status='open';
 SELECT count(*) INTO v_sales FROM public.sales;
 SELECT count(*) INTO v_returns FROM public.sale_returns;
 SELECT count(*) INTO v_expenses FROM public.pos_operating_expenses;
 SELECT count(*) INTO v_stock FROM public.stock;
 SELECT id INTO v_period FROM public.pos_reporting_periods WHERE ended_at IS NULL;
 RETURN jsonb_build_object('ready',v_open=0 AND v_period IS NOT NULL,'open_registers',v_open,
   'historical_sales',v_sales,'historical_returns',v_returns,
   'historical_expenses',v_expenses,'stock_rows_preserved',v_stock,
   'active_period_id',v_period,
   'note','A reset starts a new reporting period; it preserves all historical records and stock. Confirm both shops have reconciled inventory.');
END $$;
REVOKE ALL ON FUNCTION public.pos_reset_preflight() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_reset_preflight() TO authenticated;

-- Admin-only invoice void is a full return, not deletion of financial evidence.
-- Stock is restored and the refund obligation must be reconciled separately.
CREATE OR REPLACE FUNCTION public.pos_admin_void_sale(p_sale_id uuid,p_reason text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_items jsonb; v_result jsonb;
BEGIN
 PERFORM public.pos_admin_required();
 IF p_sale_id IS NULL OR p_request_key IS NULL OR length(btrim(coalesce(p_reason,'')))<5 THEN
  RAISE EXCEPTION 'Sale, unique request key and detailed void reason required';
 END IF;
 -- Existing pos_return_sale serializes against other returns on this sale.
 SELECT jsonb_agg(jsonb_build_object('sale_item_id',si.id,'quantity',si.quantity,'restockable',true))
 INTO v_items FROM public.sale_items si WHERE si.sale_id=p_sale_id;
 IF v_items IS NULL THEN RAISE EXCEPTION 'Sale not found or contains no items'; END IF;
 IF EXISTS (SELECT 1 FROM public.sale_return_items ri JOIN public.sale_items si ON si.id=ri.sale_item_id
   JOIN public.sale_returns sr ON sr.id=ri.return_id
   WHERE si.sale_id=p_sale_id AND sr.status='completed') THEN
  RAISE EXCEPTION 'Sale has existing returns. Review manually; full void blocked';
 END IF;
 v_result:=public.pos_return_sale(p_sale_id,v_items,'ADMIN VOID: '||btrim(p_reason),p_request_key);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.pos_admin_void_sale(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_admin_void_sale(uuid,text,uuid) TO authenticated;

-- Inventory metrics remain lifetime/current physical values; only financial metrics get a period boundary.
CREATE OR REPLACE FUNCTION public.pos_financial_overview() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb; v_start timestamptz;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role()<>'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT started_at INTO v_start FROM public.pos_reporting_periods WHERE ended_at IS NULL;
 IF v_start IS NULL THEN RAISE EXCEPTION 'Active reporting period missing'; END IF;
 WITH inventory AS (
  SELECT coalesce(sum(st.quantity),0)::bigint AS stock_units,
   coalesce(sum(st.quantity*p.price),0)::numeric AS stock_selling_value,
   coalesce(sum(st.quantity*pc.purchase_cost),0)::numeric AS stock_cost_value,
   coalesce(sum(st.quantity) FILTER(WHERE pc.purchase_cost IS NULL),0)::bigint AS uncosted_stock_units,
   coalesce(sum(st.quantity) FILTER(WHERE pc.purchase_cost IS NOT NULL),0)::bigint AS costed_stock_units,
   coalesce(sum(st.quantity*(p.price-pc.purchase_cost)) FILTER(WHERE pc.purchase_cost IS NOT NULL),0)::numeric AS potential_margin
  FROM public.stock st JOIN public.products p ON p.id=st.product_id LEFT JOIN public.product_costs pc ON pc.product_id=p.id
 ),
 sale_agg AS (SELECT count(*)::bigint AS sales_count,coalesce(sum(total),0)::numeric AS gross_sales
  FROM public.sales WHERE created_at>=v_start),
 refunds AS (SELECT coalesce(sum(refund_amount),0)::numeric AS amount
  FROM public.sale_returns WHERE status='completed' AND completed_at>=v_start),
 current_sales_profit AS (
  SELECT coalesce(sum(si.quantity*(si.unit_price-si.unit_cost_at_sale)) FILTER(WHERE si.unit_cost_at_sale IS NOT NULL),0)::numeric AS profit,
   coalesce(sum(si.quantity) FILTER(WHERE si.unit_cost_at_sale IS NULL),0)::bigint AS unknown_units
  FROM public.sale_items si JOIN public.sales s ON s.id=si.sale_id WHERE s.created_at>=v_start
 ),
 current_returns_profit AS (
  SELECT coalesce(sum(ri.quantity*(si.unit_price-si.unit_cost_at_sale)) FILTER(WHERE si.unit_cost_at_sale IS NOT NULL),0)::numeric AS profit_reversed,
   coalesce(sum(ri.quantity) FILTER(WHERE si.unit_cost_at_sale IS NULL),0)::bigint AS unknown_units_reversed
  FROM public.sale_return_items ri JOIN public.sale_returns sr ON sr.id=ri.return_id
  JOIN public.sale_items si ON si.id=ri.sale_item_id
  WHERE sr.status='completed' AND sr.completed_at>=v_start
 )
 SELECT jsonb_build_object(
 'listed_products',(SELECT count(*) FROM public.products WHERE is_active),
 'schools_count',(SELECT count(*) FROM public.schools),
 'stock_units',inventory.stock_units,'stock_selling_value',inventory.stock_selling_value,
 'stock_cost_value',inventory.stock_cost_value,'uncosted_stock_units',inventory.uncosted_stock_units,
 'costed_stock_units',inventory.costed_stock_units,'potential_margin',inventory.potential_margin,
 'sales_count',sale_agg.sales_count,'net_sales',sale_agg.gross_sales-refunds.amount,
 'refunds',refunds.amount,
 'realized_gross_profit',current_sales_profit.profit-current_returns_profit.profit_reversed,
 'uncosted_sold_units',greatest(0,current_sales_profit.unknown_units-current_returns_profit.unknown_units_reversed),
 'period_started_at',v_start
 ) INTO v_result FROM inventory CROSS JOIN sale_agg CROSS JOIN refunds
 CROSS JOIN current_sales_profit CROSS JOIN current_returns_profit;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.pos_financial_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_financial_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_expense_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total numeric; v_start timestamptz;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT started_at INTO v_start FROM public.pos_reporting_periods WHERE ended_at IS NULL;
 SELECT coalesce(sum(amount),0) INTO v_total FROM public.pos_operating_expenses WHERE created_at>=v_start;
 RETURN jsonb_build_object('total_expenses',v_total);
END $$;
CREATE OR REPLACE FUNCTION public.pos_list_expenses()
RETURNS TABLE(id uuid,expense_date date,category text,amount numeric,note text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_start timestamptz;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT started_at INTO v_start FROM public.pos_reporting_periods WHERE ended_at IS NULL;
 RETURN QUERY SELECT e.id,e.expense_date,e.category,e.amount,e.note,e.created_at FROM public.pos_operating_expenses e
 WHERE e.created_at>=v_start ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.pos_expense_summary() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pos_list_expenses() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_expense_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_list_expenses() TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_reports(p_from date DEFAULT CURRENT_DATE-30,p_to date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_start timestamptz;
BEGIN
 PERFORM public.pos_admin_required();
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Invalid reporting period';END IF;
 SELECT started_at INTO v_start FROM public.pos_reporting_periods WHERE ended_at IS NULL;
 RETURN jsonb_build_object(
 'daily_sales',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT s.created_at::date AS sale_date,count(*) AS sales,sum(s.total) AS gross FROM public.sales s WHERE s.created_at>=p_from AND s.created_at<p_to+1 AND s.created_at>=v_start GROUP BY s.created_at::date ORDER BY sale_date) x),'[]'::jsonb),
 'branches',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.name,count(s.id) AS sales,coalesce(sum(s.total),0) AS gross FROM public.branches b LEFT JOIN public.sales s ON s.branch_id=b.id AND s.created_at>=p_from AND s.created_at<p_to+1 AND s.created_at>=v_start GROUP BY b.id,b.name ORDER BY b.name) x),'[]'::jsonb),
 'returns',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT r.branch_id,count(*) AS returns_count,coalesce(sum(r.refund_amount),0) AS refunds FROM public.sale_returns r WHERE r.status='completed' AND r.completed_at>=p_from AND r.completed_at<p_to+1 AND r.completed_at>=v_start GROUP BY r.branch_id) x),'[]'::jsonb),
 'stock',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.name AS branch,p.name AS product,st.quantity,p.price FROM public.stock st JOIN public.branches b ON b.id=st.branch_id JOIN public.products p ON p.id=st.product_id ORDER BY b.name,p.name LIMIT 10000) x),'[]'::jsonb),
 'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT created_at,action,entity_type,entity_id,branch_id,actor_id FROM public.audit_events WHERE created_at>=p_from AND created_at<p_to+1 ORDER BY created_at DESC LIMIT 1000) x),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION public.pos_reports(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_reports(date,date) TO authenticated;
COMMIT;
