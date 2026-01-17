create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

alter table public.calendar_events enable row level security;

create index if not exists calendar_events_starts_at_idx on public.calendar_events (starts_at);
create index if not exists calendar_events_ends_at_idx on public.calendar_events (ends_at);
