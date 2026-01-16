alter table public.calendar_events
  drop column if exists repeat_type,
  drop column if exists repeat_until;

drop index if exists calendar_events_repeat_type_idx;
drop index if exists calendar_events_repeat_until_idx;
