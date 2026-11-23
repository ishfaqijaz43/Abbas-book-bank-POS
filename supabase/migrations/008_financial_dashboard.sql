-- Abbas Book Bank: cost tracking and financially honest admin overview.
-- Apply in the Abbas Book Bank Supabase SQL Editor before deploying the frontend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.product_costs (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 purchase_cost numeric(12,2) NOT NULL CHECK(purchase_cost>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages purchase costs" ON public.product_costs;
CREATE POLICY "Admin manages purchase costs" ON public.product_costs FOR ALL TO authenticated
 USING (public.current_pos_role()='admin') WITH CHECK (public.current_pos_role()='admin');
REVOKE ALL ON public.product_costs FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.product_costs TO authenticated;
-- Snapshot purchase cost at time of sale. Do not backfill historical costs from today's price.
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS unit_cost_at_sale numeric(12,2) CHECK(unit_cost_at_sale>=0);
CREATE OR REPLACE FUNCTION public.abb_snapshot_sale_cost() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 SELECT pc.purchase_cost INTO NEW.unit_cost_at_sale FROM public.product_costs pc WHERE pc.product_id=NEW.product_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.abb_snapshot_sale_cost() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS abb_sale_cost_snapshot ON public.sale_items;
CREATE TRIGGER abb_sale_cost_snapshot BEFORE INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.abb_snapshot_sale_cost();
CREATE OR REPLACE FUNCTION public.pos_financial_overview() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role()<>'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 WITH
 inventory AS (
  SELECT coalesce(sum(st.quantity),0)::bigint AS stock_units,
   coalesce(sum(st.quantity*p.price),0)::numeric AS stock_selling_value,
   coalesce(sum(st.quantity*pc.purchase_cost),0)::numeric AS stock_cost_value,
   coalesce(sum(st.quantity) FILTER(WHERE pc.purchase_cost IS NULL),0)::bigint AS uncosted_stock_units,
   coalesce(sum(st.quantity) FILTER(WHERE pc.purchase_cost IS NOT NULL),0)::bigint AS costed_stock_units,
   coalesce(sum(st.quantity*(p.price-pc.purchase_cost)) FILTER(WHERE pc.purchase_cost IS NOT NULL),0)::numeric AS potential_margin
  FROM public.stock st JOIN public.products p ON p.id=st.product_id LEFT JOIN public.product_costs pc ON pc.product_id=p.id
 ),
 sale_agg AS (SELECT count(*)::bigint AS sales_count,coalesce(sum(total),0)::numeric AS gross_sales FROM public.sales),
 refunds AS (SELECT coalesce(sum(refund_amount),0)::numeric AS amount FROM public.sale_returns WHERE status='completed'),
 line_returns AS (SELECT ri.sale_item_id, sum(ri.quantity)::bigint AS returned_qty
  FROM public.sale_return_items ri JOIN public.sale_returns sr ON sr.id=ri.return_id WHERE sr.status='completed' GROUP BY ri.sale_item_id),
 realized AS (
  SELECT coalesce(sum((si.quantity-coalesce(lr.returned_qty,0))*(si.unit_price-si.unit_cost_at_sale)) FILTER(WHERE si.unit_cost_at_sale IS NOT NULL),0)::numeric AS profit,
   coalesce(sum(si.quantity-coalesce(lr.returned_qty,0)) FILTER(WHERE si.unit_cost_at_sale IS NULL),0)::bigint AS unknown_units
  FROM public.sale_items si LEFT JOIN line_returns lr ON lr.sale_item_id=si.id
 )
 SELECT jsonb_build_object(
 'listed_products',(SELECT count(*) FROM public.products WHERE is_active),
 'schools_count',(SELECT count(*) FROM public.schools),
 'stock_units',inventory.stock_units,'stock_selling_value',inventory.stock_selling_value,
 'stock_cost_value',inventory.stock_cost_value,'uncosted_stock_units',inventory.uncosted_stock_units,
 'costed_stock_units',inventory.costed_stock_units,'potential_margin',inventory.potential_margin,
 'sales_count',sale_agg.sales_count,'net_sales',sale_agg.gross_sales-refunds.amount,
 'refunds',refunds.amount,'realized_gross_profit',realized.profit,'uncosted_sold_units',realized.unknown_units
 ) INTO v_result FROM inventory CROSS JOIN sale_agg CROSS JOIN refunds CROSS JOIN realized;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.pos_financial_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_financial_overview() TO authenticated;
COMMIT;
