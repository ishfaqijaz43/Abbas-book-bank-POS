-- Abbas Book Bank: one-time product category migration.
-- Existing products retain their prices, SKU and branch stock.
BEGIN;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Books & textbooks';
UPDATE public.products SET category = 'Books & textbooks' WHERE category IS NULL;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_allowed;
ALTER TABLE public.products ADD CONSTRAINT products_category_allowed CHECK (category IN (
  'Books & textbooks','School courses','Pens & pencils','Notebooks & registers',
  'Geometry & mathematics','Art & craft','Office stationery','Other products'
));
COMMIT;
