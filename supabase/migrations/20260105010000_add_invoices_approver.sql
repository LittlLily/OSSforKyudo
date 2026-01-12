alter table public.invoices
  add column if not exists approver_id uuid references auth.users (id);

create index if not exists invoices_approver_id_idx
  on public.invoices (approver_id);
