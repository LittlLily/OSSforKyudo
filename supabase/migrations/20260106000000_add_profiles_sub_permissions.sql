alter table public.profiles
  add column if not exists sub_permissions jsonb not null default '[]'::jsonb;
