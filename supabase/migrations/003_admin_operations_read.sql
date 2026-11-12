-- ABBAS POS: admin-only read API for purchasing and transfers.
-- Install AFTER abbas_pos_operations.sql. No stock changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.pos_admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.pos_admin_required();
  RETURN jsonb_build_object(
    'suppliers', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM (SELECT id,name,contact_name,phone,email,enabled FROM public.suppliers ORDER BY name LIMIT 500) s),'[]'::jsonb),
    'branches', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.name) FROM (SELECT id,name,enabled FROM public.branches ORDER BY name LIMIT 100) b),'[]'::jsonb),
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.name) FROM (SELECT id,name,sku,price,is_active FROM public.products ORDER BY name LIMIT 2000) p),'[]'::jsonb),
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC) FROM (SELECT id,branch_id,supplier_id,status,reference,created_at FROM public.purchase_orders ORDER BY created_at DESC LIMIT 200) o),'[]'::jsonb),
    'transfers', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM (SELECT id,from_branch_id,to_branch_id,status,created_at FROM public.stock_transfers ORDER BY created_at DESC LIMIT 200) t),'[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.pos_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_admin_overview() TO authenticated;
COMMIT;
