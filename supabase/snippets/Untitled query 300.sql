create table if not exists public.survey_targets (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  account_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (survey_id, account_id)
);

alter table public.survey_targets enable row level security;

create index if not exists survey_targets_survey_id_idx
  on public.survey_targets (survey_id);

create index if not exists survey_targets_account_id_idx
  on public.survey_targets (account_id);
