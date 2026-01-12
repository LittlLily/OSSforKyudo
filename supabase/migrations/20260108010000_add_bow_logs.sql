create table if not exists public.bow_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  operator_id uuid references auth.users (id) on delete set null,
  bow_number text
);

create index if not exists bow_logs_created_at_idx
  on public.bow_logs (created_at desc);

create index if not exists bow_logs_operator_id_idx
  on public.bow_logs (operator_id, created_at desc);

alter table public.bow_logs enable row level security;

create policy "bow_logs_select_all"
on public.bow_logs
for select
to authenticated
using (true);
