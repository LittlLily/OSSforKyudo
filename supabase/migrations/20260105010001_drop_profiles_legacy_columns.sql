alter table public.profiles
  drop constraint if exists profiles_self_intro_format,
  drop constraint if exists profiles_hobby_format,
  drop constraint if exists profiles_emergency_contact_format,
  drop constraint if exists profiles_admin_note_format;

alter table public.profiles
  drop column if exists self_intro,
  drop column if exists hobby,
  drop column if exists emergency_contact,
  drop column if exists admin_note;
