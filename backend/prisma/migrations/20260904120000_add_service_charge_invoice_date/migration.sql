-- Store the actual Pennylane invoice date on service_charges (distinct from
-- created_at, which is row-insertion time). Needed to browse historical
-- invoices chronologically by year/month.
ALTER TABLE "public"."service_charges" ADD COLUMN IF NOT EXISTS "invoice_date" DATE;

CREATE INDEX IF NOT EXISTS "idx_charges_invoice_date" ON "public"."service_charges"("invoice_date");
