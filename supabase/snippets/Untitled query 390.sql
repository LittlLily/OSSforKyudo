create table if not exists public.japanese_bows (
  id uuid primary key default gen_random_uuid(),
  bow_number text not null,
  name text not null,
  strength numeric not null check (strength >= 0),
  length text not null check (length in ('並寸', '二寸伸', '四寸伸', '三寸詰')),
  borrower_profile_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.bow_loans (
  id uuid primary key default gen_random_uuid(),
  bow_id uuid not null references public.japanese_bows (id) on delete cascade,
  borrower_profile_id uuid references public.profiles (id) on delete set null,
  loaned_at timestamptz not null default now(),
  returned_at timestamptz,
  check (returned_at is null or returned_at >= loaned_at)
);

alter table public.japanese_bows enable row level security;
alter table public.bow_loans enable row level security;

create policy "japanese_bows_select_all"
on public.japanese_bows
for select
to authenticated
using (true);

create policy "japanese_bows_insert_all"
on public.japanese_bows
for insert
to authenticated
with check (true);

create policy "japanese_bows_update_all"
on public.japanese_bows
for update
to authenticated
using (true)
with check (true);

create policy "japanese_bows_delete_all"
on public.japanese_bows
for delete
to authenticated
using (true);

create policy "bow_loans_select_all"
on public.bow_loans
for select
to authenticated
using (true);

create policy "bow_loans_insert_all"
on public.bow_loans
for insert
to authenticated
with check (true);

create policy "bow_loans_update_all"
on public.bow_loans
for update
to authenticated
using (true)
with check (true);

create policy "bow_loans_delete_all"
on public.bow_loans
for delete
to authenticated
using (true);

create index if not exists japanese_bows_bow_number_idx
  on public.japanese_bows (bow_number);

create index if not exists japanese_bows_borrower_profile_id_idx
  on public.japanese_bows (borrower_profile_id);

create index if not exists bow_loans_bow_id_loaned_at_idx
  on public.bow_loans (bow_id, loaned_at desc);

create index if not exists bow_loans_borrower_profile_id_idx
  on public.bow_loans (borrower_profile_id);
