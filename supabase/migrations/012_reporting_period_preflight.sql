-- STAGING ONLY: reporting period infrastructure and read-only reset readiness.
-- This migration does NOT execute a reset or change existing reports.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pos_reporting_periods (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 initiated_by uuid REFERENCES auth.users(id),
 reason text NOT NULL DEFAULT 'Initial historical period',
 CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS pos_one_open_reporting_period
 ON public.pos_reporting_periods ((true)) WHERE ended_at IS NULL;
ALTER TABLE public.pos_reporting_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_reporting_periods FROM PUBLIC, anon, authenticated;
INSERT INTO public.pos_reporting_periods(started_at,reason)
 SELECT '-infinity'::timestamptz, 'Existing historical records before first reset'
 WHERE NOT EXISTS (SELECT 1 FROM public.pos_reporting_periods);
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
 RETURN jsonb_build_object('ready',v_open=0,'open_registers',v_open,
   'historical_sales',v_sales,'historical_returns',v_returns,
   'historical_expenses',v_expenses,'stock_rows_preserved',v_stock,
   'active_period_id',v_period,
   'note','Read-only preview. Reset is not enabled; backup and stock reconciliation are still required.');
END $$;
REVOKE ALL ON FUNCTION public.pos_reset_preflight() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_reset_preflight() TO authenticated;
COMMIT;
