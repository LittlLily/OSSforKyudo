create table if not exists public.account_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  operator_id uuid references auth.users (id) on delete set null,
  target_id uuid references auth.users (id) on delete set null,
  subject_user_id uuid references auth.users (id) on delete set null,
  target_label text
);

create index if not exists account_logs_created_at_idx
  on public.account_logs (created_at desc);

create index if not exists account_logs_subject_idx
  on public.account_logs (subject_user_id, created_at desc);

alter table public.account_logs enable row level security;

create policy "account_logs_select_own"
on public.account_logs
for select
to authenticated
using (subject_user_id = auth.uid() or operator_id = auth.uid());

create policy "account_logs_select_admin"
on public.account_logs
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.invoice_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  operator_id uuid references auth.users (id) on delete set null,
  subject_user_id uuid references auth.users (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  target_label text,
  detail text
);

create index if not exists invoice_logs_created_at_idx
  on public.invoice_logs (created_at desc);

create index if not exists invoice_logs_subject_idx
  on public.invoice_logs (subject_user_id, created_at desc);

alter table public.invoice_logs enable row level security;

create policy "invoice_logs_select_own"
on public.invoice_logs
for select
to authenticated
using (subject_user_id = auth.uid());

create policy "invoice_logs_select_admin"
on public.invoice_logs
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
