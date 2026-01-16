alter table public.profiles
  add column if not exists public_field_1 text,
  add column if not exists public_field_2 text,
  add column if not exists restricted_field_1 text,
  add column if not exists restricted_field_2 text;

alter table public.profiles
  add constraint profiles_public_field_1_format
    check (
      public_field_1 is null
      or public_field_1 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
    ),
  add constraint profiles_public_field_2_format
    check (
      public_field_2 is null
      or public_field_2 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
    ),
  add constraint profiles_restricted_field_1_format
    check (
      restricted_field_1 is null
      or restricted_field_1 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
    ),
  add constraint profiles_restricted_field_2_format
    check (
      restricted_field_2 is null
      or restricted_field_2 ~ E'^[A-Za-z0-9一-龠々ぁ-ゔァ-ヴー \-\(\)\{\}\[\]<>\.,;:/\\_\?!"#\$%&''=~\|\^]+$'
    );
