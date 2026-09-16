ALTER TABLE public.service_charges
  ADD COLUMN IF NOT EXISTS supplier_name TEXT;

CREATE INDEX IF NOT EXISTS idx_charges_supplier_name
  ON public.service_charges (supplier_name);

NOTIFY pgrst, 'reload schema';