-- Apply manually in Supabase SQL Editor after reviewing the current schema.
-- Never delete products that have any inventory, school assignments, or historical dependencies.
CREATE OR REPLACE FUNCTION public.pos_safe_delete_product(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_qty bigint;
BEGIN
  PERFORM public.pos_admin_required();
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=p_product_id) THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  SELECT coalesce(sum(quantity),0) INTO v_qty FROM public.stock WHERE product_id=p_product_id;
  IF v_qty<>0 THEN
    RAISE EXCEPTION 'Product has stock. Settle physical stock first; archive instead.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.grade_books WHERE product_id=p_product_id) THEN
    RAISE EXCEPTION 'Product is assigned to a grade. Remove the assignment first or archive.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.sale_items WHERE product_id=p_product_id) THEN
    RAISE EXCEPTION 'Product has sales history. Archive instead.';
  END IF;
  -- All other FK dependencies must block deletion, not cascade silently.
  DELETE FROM public.stock WHERE product_id=p_product_id AND quantity=0;
  DELETE FROM public.product_costs WHERE product_id=p_product_id;
  DELETE FROM public.products WHERE id=p_product_id;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Product is referenced by other records. Archive instead.';
END $$;
REVOKE ALL ON FUNCTION public.pos_safe_delete_product(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_safe_delete_product(uuid) TO authenticated;
