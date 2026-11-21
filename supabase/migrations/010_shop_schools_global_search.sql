-- Apply after 009. Existing schools are initially assigned to all existing shops
-- to preserve current access. Administrators must review and unassign as needed.
BEGIN;
DO $bootstrap$
DECLARE v_existing boolean := to_regclass('public.school_branches') IS NOT NULL;
BEGIN
IF NOT v_existing THEN
CREATE TABLE public.school_branches (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  PRIMARY KEY (school_id,branch_id)
);
-- Backfill only on first creation, never on a subsequent rerun.
INSERT INTO public.school_branches(school_id,branch_id)
SELECT s.id,b.id FROM public.schools s CROSS JOIN public.branches b
ON CONFLICT DO NOTHING;
END IF;
END $bootstrap$;
CREATE INDEX IF NOT EXISTS school_branches_branch_idx ON public.school_branches(branch_id,school_id);
ALTER TABLE public.school_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school branch admin" ON public.school_branches;
DROP POLICY IF EXISTS "school branch seller" ON public.school_branches;
CREATE POLICY "school branch admin" ON public.school_branches FOR ALL TO authenticated
USING (public.current_pos_role()='admin') WITH CHECK (public.current_pos_role()='admin');
CREATE POLICY "school branch seller" ON public.school_branches FOR SELECT TO authenticated
USING (public.current_pos_role()='seller' AND branch_id=(SELECT a.branch_id FROM public.active_access a WHERE a.user_id=auth.uid() AND a.expires_at>now()));

-- Restrict seller reads at database level, not only in React.
DROP POLICY IF EXISTS "read schools" ON public.schools;
DROP POLICY IF EXISTS "read grades" ON public.grades;
DROP POLICY IF EXISTS "read grade books" ON public.grade_books;
CREATE POLICY "read schools" ON public.schools FOR SELECT TO authenticated USING (
 public.current_pos_role()='admin' OR (public.current_pos_role()='seller' AND EXISTS (
 SELECT 1 FROM public.school_branches sb WHERE sb.school_id=schools.id
 )));
CREATE POLICY "read grades" ON public.grades FOR SELECT TO authenticated USING (
 public.current_pos_role()='admin' OR (public.current_pos_role()='seller' AND EXISTS (
 SELECT 1 FROM public.school_branches sb WHERE sb.school_id=grades.school_id
 )));
CREATE POLICY "read grade books" ON public.grade_books FOR SELECT TO authenticated USING (
 public.current_pos_role()='admin' OR (public.current_pos_role()='seller' AND EXISTS (
 SELECT 1 FROM public.grades g JOIN public.school_branches sb ON sb.school_id=g.school_id
 WHERE g.id=grade_books.grade_id
 )));

CREATE OR REPLACE FUNCTION public.pos_create_school_for_shops(p_name text,p_branch_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role()<>'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF length(trim(coalesce(p_name,'')))<2 THEN RAISE EXCEPTION 'School name must contain at least 2 characters'; END IF;
 IF p_branch_ids IS NULL OR cardinality(p_branch_ids)=0 THEN RAISE EXCEPTION 'Choose at least one shop'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_branch_ids) id WHERE NOT EXISTS(SELECT 1 FROM public.branches b WHERE b.id=id)) THEN RAISE EXCEPTION 'Unknown shop'; END IF;
 INSERT INTO public.schools(name) VALUES(trim(p_name)) RETURNING id INTO v_id;
 INSERT INTO public.school_branches(school_id,branch_id) SELECT v_id,id FROM unnest(p_branch_ids) id ON CONFLICT DO NOTHING;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.pos_set_school_shop(p_school_id uuid,p_branch_id uuid,p_assigned boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_pos_role()<>'admin' THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=p_school_id) THEN RAISE EXCEPTION 'Unknown school'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.branches WHERE id=p_branch_id) THEN RAISE EXCEPTION 'Unknown shop'; END IF;
 IF p_assigned THEN
  INSERT INTO public.school_branches(school_id,branch_id) VALUES(p_school_id,p_branch_id) ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM public.school_branches WHERE school_id=p_school_id AND branch_id=p_branch_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.pos_create_school_for_shops(text,uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pos_set_school_shop(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_create_school_for_shops(text,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_set_school_shop(uuid,uuid,boolean) TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.school_branches TO authenticated;
COMMIT;
