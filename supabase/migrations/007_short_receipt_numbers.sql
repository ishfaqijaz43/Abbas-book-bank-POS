-- One-time short sequential receipt number for Abbas Book Bank POS.
-- Run in Supabase SQL Editor on the Abbas Book Bank project.
-- Does not change sale UUIDs, prices, stock, or payments.
BEGIN;
LOCK TABLE public.sales IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS receipt_no bigint;
CREATE SEQUENCE IF NOT EXISTS public.abb_receipt_no_seq AS bigint START WITH 1 INCREMENT BY 1;
ALTER SEQUENCE public.abb_receipt_no_seq OWNED BY public.sales.receipt_no;
-- Preserve already assigned numbers if the migration is retried.
SELECT setval('public.abb_receipt_no_seq', GREATEST(COALESCE((SELECT max(receipt_no) FROM public.sales),0),1), (SELECT count(*)>0 FROM public.sales WHERE receipt_no IS NOT NULL));
-- Backfill old sales in chronological order. No existing receipt IDs are changed.
WITH missing AS (
 SELECT id, row_number() OVER (ORDER BY created_at,id) AS rn
 FROM public.sales WHERE receipt_no IS NULL
), offset_no AS (
 SELECT COALESCE(max(receipt_no),0) AS n FROM public.sales
)
UPDATE public.sales s SET receipt_no = missing.rn + offset_no.n
FROM missing CROSS JOIN offset_no WHERE s.id=missing.id;
SELECT setval('public.abb_receipt_no_seq', GREATEST(COALESCE((SELECT max(receipt_no) FROM public.sales),0),1), (SELECT count(*)>0 FROM public.sales));
ALTER TABLE public.sales ALTER COLUMN receipt_no SET DEFAULT nextval('public.abb_receipt_no_seq'::regclass);
ALTER TABLE public.sales ALTER COLUMN receipt_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_receipt_no_unique ON public.sales(receipt_no);
COMMIT;
