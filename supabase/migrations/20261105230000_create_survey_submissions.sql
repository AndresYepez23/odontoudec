-- Survey submissions for OdontoUdeC.
-- Keep the table in a non-exposed schema; all access is mediated by the Edge Function.
create schema if not exists private;

create table if not exists private.survey_submissions (
  id uuid primary key default gen_random_uuid(),
  survey_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  constraint survey_submissions_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint survey_submissions_one_per_user unique (survey_key, user_id)
);

create index if not exists survey_submissions_survey_submitted_idx
  on private.survey_submissions (survey_key, submitted_at desc);

alter table private.survey_submissions enable row level security;

-- No direct table access for browser roles. The Edge Function performs
-- authentication, input validation, duplicate protection and admin checks.
revoke all on schema private from public, anon, authenticated;
revoke all on table private.survey_submissions from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on table private.survey_submissions to service_role;

comment on table private.survey_submissions is
  'Respuestas identificadas de la encuesta estudiantil. Acceso mediado exclusivamente por Edge Function.';
