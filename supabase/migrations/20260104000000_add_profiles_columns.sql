alter table public.profiles
  add column if not exists student_number text,
  add column if not exists name_kana text,
  add column if not exists generation text,
  add column if not exists gender text,
  add column if not exists department text,
  add column if not exists ryuha text,
  add column if not exists position text;

alter table public.profiles
  add constraint profiles_student_number_format
    check (student_number is null or student_number ~ '^[A-Za-z0-9]+$'),
  add constraint profiles_name_kana_format
    check (name_kana is null or name_kana ~ '^[ァ-ヶー ]+$'),
  add constraint profiles_display_name_format
    check (display_name is null or display_name ~ '^[一-龠々ぁ-ゔァ-ヴー ]+$'),
  add constraint profiles_generation_format
    check (generation is null or generation ~ '^[0-9]+$'),
  add constraint profiles_gender_values
    check (gender is null or gender in ('male', 'female', 'other')),
  add constraint profiles_department_format
    check (department is null or department ~ '^[一-龠々ぁ-ゔァ-ヴー]+$'),
  add constraint profiles_ryuha_format
    check (ryuha is null or ryuha ~ '^[一-龠々ぁ-ゔァ-ヴー]+$'),
  add constraint profiles_position_format
    check (position is null or position ~ '^[一-龠々ぁ-ゔァ-ヴー]+$');
