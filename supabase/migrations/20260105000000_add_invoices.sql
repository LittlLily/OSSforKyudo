create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  requester_id uuid not null references auth.users (id),
  amount integer not null check (amount >= 0),
  billed_at timestamptz not null default now(),
  approved_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  title text,
  description text
);

alter table public.invoices enable row level security;

create index if not exists invoices_status_billed_at_idx
  on public.invoices (status, billed_at desc);

create index if not exists invoices_account_id_idx
  on public.invoices (account_id);

create index if not exists invoices_requester_id_idx
  on public.invoices (requester_id);
