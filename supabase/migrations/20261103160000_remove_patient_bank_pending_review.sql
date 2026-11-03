-- Retirar la moderación previa del Banco de pacientes.
alter table public.patient_bank_case_events
  drop constraint if exists patient_bank_case_events_action_check;
alter table public.patient_bank_case_events
  add constraint patient_bank_case_events_action_check
  check (action = any (array[
    'patient_submitted','student_shared','claimed','released','completed',
    'review_approved','review_rejected','published_without_review'
  ]::text[]));

alter table public.patient_bank_cases
  alter column status set default 'available';

with published as (
  update public.patient_bank_cases
     set status = 'available',
         updated_at = now()
   where status = 'pending_review'
   returning id
)
insert into public.patient_bank_case_events(case_id, actor_id, action)
select id, null, 'published_without_review'
from published;

alter table public.patient_bank_cases
  drop constraint if exists patient_bank_cases_status_check;
alter table public.patient_bank_cases
  add constraint patient_bank_cases_status_check
  check (status = any (array['available','claimed','completed','rejected','removed']::text[]));

drop function if exists public.patient_bank_admin_pending();
drop function if exists public.patient_bank_admin_review(uuid, boolean);
drop function if exists public.patient_bank_is_admin();
