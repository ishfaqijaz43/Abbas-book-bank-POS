-- Apply once in Supabase SQL Editor AFTER migration 008.
-- Operating expenses are distinct from purchases of resale inventory.
BEGIN;
CREATE TABLE IF NOT EXISTS public.pos_operating_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 expense_date date NOT NULL DEFAULT CURRENT_DATE,
 category text NOT NULL CHECK (category IN ('Rent','Tea & meals','Transport','Maintenance','Utilities','Salaries','Supplies','Other')),
 amount numeric(12,2) NOT NULL CHECK(amount > 0),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=500),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pos_operating_expenses_date_idx ON public.pos_operating_expenses(expense_date DESC);
ALTER TABLE public.pos_operating_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pos_operating_expenses FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pos_add_expense(p_amount numeric,p_category text,p_note text DEFAULT '',p_expense_date date DEFAULT CURRENT_DATE)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>9999999999.99 OR p_category IS NULL OR p_category NOT IN ('Rent','Tea & meals','Transport','Maintenance','Utilities','Salaries','Supplies','Other') OR p_expense_date IS NULL OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Invalid expense'; END IF;
 INSERT INTO public.pos_operating_expenses(amount,category,note,expense_date,created_by) VALUES(p_amount,p_category,coalesce(p_note,''),p_expense_date,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.pos_list_expenses()
RETURNS TABLE(id uuid,expense_date date,category text,amount numeric,note text,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 RETURN QUERY SELECT e.id,e.expense_date,e.category,e.amount,e.note,e.created_at FROM public.pos_operating_expenses e ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 100;
END $$;
CREATE OR REPLACE FUNCTION public.pos_delete_expense(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 DELETE FROM public.pos_operating_expenses WHERE id=p_id;
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.pos_expense_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_total numeric;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT coalesce(sum(amount),0) INTO v_total FROM public.pos_operating_expenses;
 RETURN jsonb_build_object('total_expenses',v_total);
END $$;
REVOKE ALL ON FUNCTION public.pos_add_expense(numeric,text,text,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pos_list_expenses() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pos_delete_expense(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pos_expense_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_add_expense(numeric,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_list_expenses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_delete_expense(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_expense_summary() TO authenticated;
COMMIT;
