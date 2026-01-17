alter table public.profiles
  drop constraint if exists profiles_public_field_1_format,
  drop constraint if exists profiles_public_field_2_format,
  drop constraint if exists profiles_restricted_field_1_format,
  drop constraint if exists profiles_restricted_field_2_format;
