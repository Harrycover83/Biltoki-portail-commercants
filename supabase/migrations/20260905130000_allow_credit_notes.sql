-- Pennylane credit notes ("avoirs") carry negative amounts and must be kept in
-- the historical charges so monthly totals reconcile with Pennylane.
alter table public.service_charges
  drop constraint if exists service_charges_amount_excl_tax_check,
  drop constraint if exists service_charges_amount_tax_check,
  drop constraint if exists service_charges_amount_incl_tax_check;

-- Future allocations of a credit note must also be able to reduce a merchant's balance.
alter table public.allocations
  drop constraint if exists allocations_allocated_amount_check;