alter table public.calendar_events
  add column if not exists color text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_color_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_color_check
      check (
        color is null
        or color in (
          '#cfe8d8',
          '#cfe1f2',
          '#f2d2d7',
          '#e2d4f0',
          '#f3e2c8',
          '#d9dde3'
        )
      );
  end if;
end $$;
