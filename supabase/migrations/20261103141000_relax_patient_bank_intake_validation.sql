-- Ajustar validaciones del formulario del Banco de pacientes.
alter table public.patient_bank_cases
  drop constraint if exists patient_bank_cases_reason_summary_check;
alter table public.patient_bank_cases
  add constraint patient_bank_cases_reason_summary_check
  check (char_length(reason_summary) between 5 and 500);

alter table public.patient_bank_private
  drop constraint if exists patient_bank_private_phone_check;
alter table public.patient_bank_private
  add constraint patient_bank_private_phone_check
  check (
    char_length(phone) between 6 and 30
    and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 6 and 15
  );
