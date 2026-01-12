create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  prompt text not null,
  type text not null check (type in ('single', 'multiple')),
  allow_option_add boolean not null default false,
  position integer not null default 0
);

create table if not exists public.survey_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions (id) on delete cascade,
  label text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_target_groups (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  position integer not null default 0
);

create table if not exists public.survey_target_conditions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.survey_target_groups (id) on delete cascade,
  field text not null check (field in ('display_name', 'student_number', 'generation', 'gender')),
  op text not null check (op in ('ilike', 'eq')),
  value text not null
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  account_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, account_id)
);

create table if not exists public.survey_response_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  question_id uuid not null references public.survey_questions (id) on delete cascade,
  option_id uuid not null references public.survey_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (response_id, question_id, option_id)
);

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_options enable row level security;
alter table public.survey_target_groups enable row level security;
alter table public.survey_target_conditions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_response_answers enable row level security;

create index if not exists surveys_status_idx on public.surveys (status);
create index if not exists surveys_created_at_idx on public.surveys (created_at desc);
create index if not exists survey_questions_survey_id_idx on public.survey_questions (survey_id, position);
create index if not exists survey_options_question_id_idx on public.survey_options (question_id);
create index if not exists survey_target_groups_survey_id_idx on public.survey_target_groups (survey_id, position);
create index if not exists survey_target_conditions_group_id_idx on public.survey_target_conditions (group_id);
create index if not exists survey_responses_survey_id_idx on public.survey_responses (survey_id);
create index if not exists survey_responses_account_id_idx on public.survey_responses (account_id);
create index if not exists survey_response_answers_response_id_idx on public.survey_response_answers (response_id);
