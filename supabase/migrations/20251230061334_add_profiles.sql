-- profiles: auth.users と 1:1 で紐づくプロフィール
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- RLSを有効化
alter table public.profiles enable row level security;

-- 自分の行だけ読める
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- 自分の行だけ作れる（初回作成）
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

-- 自分の行だけ更新できる
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
