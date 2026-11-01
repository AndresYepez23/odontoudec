alter table public.academic_progress
  drop constraint if exists academic_progress_user_id_subject_name_key;

alter table public.academic_progress
  add constraint academic_progress_user_subject_semester_key
  unique (user_id, subject_name, curriculum_semester);
