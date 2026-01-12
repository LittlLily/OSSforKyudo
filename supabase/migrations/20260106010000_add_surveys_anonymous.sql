alter table public.surveys
  add column if not exists is_anonymous boolean not null default false;
