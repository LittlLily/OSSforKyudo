alter table public.profiles
  add column if not exists public_field_1 text,
  add column if not exists public_field_2 text,
  add column if not exists restricted_field_1 text,
  add column if not exists restricted_field_2 text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_public_field_1_format'
  ) then
    alter table public.profiles
      add constraint profiles_public_field_1_format
        check (
          public_field_1 is null
          or public_field_1 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
        );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_public_field_2_format'
  ) then
    alter table public.profiles
      add constraint profiles_public_field_2_format
        check (
          public_field_2 is null
          or public_field_2 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
        );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_restricted_field_1_format'
  ) then
    alter table public.profiles
      add constraint profiles_restricted_field_1_format
        check (
          restricted_field_1 is null
          or restricted_field_1 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
        );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_restricted_field_2_format'
  ) then
    alter table public.profiles
      add constraint profiles_restricted_field_2_format
        check (
          restricted_field_2 is null
          or restricted_field_2 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
        );
  end if;
end $$;
