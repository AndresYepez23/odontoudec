-- Banco de pacientes: separar datos de contacto de la ficha visible.
create table if not exists public.patient_bank_cases (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default ('OD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  reason_summary text not null check (char_length(reason_summary) between 10 and 500),
  general_area text,
  availability text,
  source text not null check (source in ('patient','student')),
  consent_recorded boolean not null default false check (consent_recorded = true),
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-11-03-v1',
  status text not null default 'pending_review' check (status in ('pending_review','available','claimed','completed','rejected','removed')),
  created_by_student uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_bank_claim_state check (
    (status = 'claimed' and claimed_by is not null and claimed_at is not null)
    or (status <> 'claimed' and claimed_by is null and claimed_at is null)
  )
);

create table if not exists public.patient_bank_private (
  case_id uuid primary key references public.patient_bank_cases(id) on delete cascade,
  patient_name text not null check (char_length(patient_name) between 2 and 100),
  phone text not null check (char_length(phone) between 7 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.patient_bank_case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.patient_bank_cases(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('patient_submitted','student_shared','claimed','released','completed','review_approved','review_rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.patient_bank_intake_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists patient_bank_cases_status_created_idx
  on public.patient_bank_cases(status, created_at desc);
create index if not exists patient_bank_cases_claimed_by_idx
  on public.patient_bank_cases(claimed_by) where claimed_by is not null;
create index if not exists patient_bank_cases_created_by_idx
  on public.patient_bank_cases(created_by_student) where created_by_student is not null;
create index if not exists patient_bank_case_events_case_created_idx
  on public.patient_bank_case_events(case_id, created_at desc);
create index if not exists patient_bank_case_events_case_created_idx
  on public.patient_bank_case_events(case_id, created_at desc);

alter table public.patient_bank_cases enable row level security;
alter table public.patient_bank_private enable row level security;
alter table public.patient_bank_intake_limits enable row level security;
alter table public.patient_bank_case_events enable row level security;
alter table public.patient_bank_case_events enable row level security;

revoke all on public.patient_bank_cases from anon, authenticated;
revoke all on public.patient_bank_private from anon, authenticated;
revoke all on public.patient_bank_intake_limits from anon, authenticated;
revoke all on public.patient_bank_case_events from anon, authenticated;
revoke all on public.patient_bank_case_events from anon, authenticated;
grant all on public.patient_bank_cases to service_role;
grant all on public.patient_bank_private to service_role;
grant all on public.patient_bank_intake_limits to service_role;
grant all on public.patient_bank_case_events to service_role;
grant all on public.patient_bank_case_events to service_role;

create or replace function public.patient_bank_list_cases()
returns table (
  id uuid, public_code text, reason_summary text, general_area text,
  availability text, source text, status text, created_at timestamptz, is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.public_code, c.reason_summary, c.general_area,
         c.availability, c.source, c.status, c.created_at,
         (c.claimed_by = (select auth.uid())) as is_mine
  from public.patient_bank_cases c
  where auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
    and c.status in ('available','claimed','completed')
  order by case c.status when 'available' then 0 when 'claimed' then 1 else 2 end,
           c.created_at desc;
$$;

create or replace function public.patient_bank_claim_case(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
  ) then
    raise exception 'Debes iniciar sesión con tu cuenta estudiantil.';
  end if;
  update public.patient_bank_cases
     set status = 'claimed', claimed_by = (select auth.uid()),
         claimed_at = now(), updated_at = now()
   where id = p_case_id and status = 'available';
  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    insert into public.patient_bank_case_events(case_id, actor_id, action)
    values (p_case_id, (select auth.uid()), 'claimed');
  end if;
  return v_updated = 1;
end;
$$;

create or replace function public.patient_bank_release_case(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update public.patient_bank_cases
     set status = 'available', claimed_by = null,
         claimed_at = null, updated_at = now()
   where id = p_case_id and status = 'claimed'
     and claimed_by = (select auth.uid());
  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    insert into public.patient_bank_case_events(case_id, actor_id, action)
    values (p_case_id, (select auth.uid()), 'released');
  end if;
  return v_updated = 1;
end;
$$;

create or replace function public.patient_bank_complete_case(p_case_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update public.patient_bank_cases
     set status = 'completed', claimed_by = null, claimed_at = null,
         completed_at = now(), updated_at = now()
   where id = p_case_id and status = 'claimed'
     and claimed_by = (select auth.uid());
  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    insert into public.patient_bank_case_events(case_id, actor_id, action)
    values (p_case_id, (select auth.uid()), 'completed');
  end if;
  return v_updated = 1;
end;
$$;

create or replace function public.patient_bank_my_contact(p_case_id uuid)
returns table (patient_name text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.patient_name, d.phone
  from public.patient_bank_private d
  join public.patient_bank_cases c on c.id = d.case_id
  where c.id = p_case_id
    and (c.claimed_by = (select auth.uid()) or public.is_admin());
$$;

create or replace function public.patient_bank_submit(
  p_ip_hash text,
  p_name text,
  p_phone text,
  p_summary text,
  p_area text default null,
  p_availability text default null,
  p_source text default 'patient',
  p_student_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_case_id uuid; v_limit public.patient_bank_intake_limits%rowtype;
begin
  if p_ip_hash is null or char_length(p_ip_hash) <> 64 then
    raise exception 'Solicitud no válida.';
  end if;
  insert into public.patient_bank_intake_limits(ip_hash, window_started_at, submission_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
    set submission_count = case
          when public.patient_bank_intake_limits.window_started_at < now() - interval '1 hour' then 1
          else public.patient_bank_intake_limits.submission_count + 1 end,
        window_started_at = case
          when public.patient_bank_intake_limits.window_started_at < now() - interval '1 hour' then now()
          else public.patient_bank_intake_limits.window_started_at end,
        updated_at = now()
  returning * into v_limit;
  if v_limit.submission_count > 3 then
    raise exception 'Has enviado varias solicitudes. Inténtalo más tarde.';
  end if;
  if p_source not in ('patient','student') or (p_source = 'student' and p_student_id is null) then
    raise exception 'Tipo de solicitud no válido.';
  end if;
  if p_student_id is not null and not exists (
    select 1 from public.profiles p where p.id = p_student_id
  ) then
    raise exception 'Cuenta estudiantil no válida.';
  end if;
  insert into public.patient_bank_cases(reason_summary, general_area, availability, source, consent_recorded, consent_at, consent_version, created_by_student)
  values (left(trim(p_summary),500), nullif(trim(p_area),''), nullif(trim(p_availability),''), p_source, true, now(), '2026-11-03-v1', p_student_id)
  returning id into v_case_id;
  insert into public.patient_bank_private(case_id, patient_name, phone)
  values (v_case_id, trim(p_name), trim(p_phone));
  insert into public.patient_bank_case_events(case_id, actor_id, action)
  values (v_case_id, p_student_id, case when p_source = 'student' then 'student_shared' else 'patient_submitted' end);
  return v_case_id;
end;
$$;

revoke all on function public.patient_bank_list_cases() from public, anon;
revoke all on function public.patient_bank_claim_case(uuid) from public, anon;
revoke all on function public.patient_bank_release_case(uuid) from public, anon;
revoke all on function public.patient_bank_complete_case(uuid) from public, anon;
revoke all on function public.patient_bank_my_contact(uuid) from public, anon;
revoke all on function public.patient_bank_submit(text,text,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.patient_bank_list_cases() to authenticated;
grant execute on function public.patient_bank_claim_case(uuid) to authenticated;
grant execute on function public.patient_bank_release_case(uuid) to authenticated;
grant execute on function public.patient_bank_complete_case(uuid) to authenticated;
grant execute on function public.patient_bank_my_contact(uuid) to authenticated;
grant execute on function public.patient_bank_submit(text,text,text,text,text,text,text,uuid) to service_role;

comment on table public.patient_bank_private is 'Datos de contacto sensibles; no accesibles directamente por anon/authenticated.';
comment on column public.patient_bank_cases.claimed_by is 'Identidad interna del estudiante responsable; nunca se devuelve en la lista pública del banco.';

create or replace function public.patient_bank_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_admin(); $$;

create or replace function public.patient_bank_admin_pending()
returns table (
 id uuid, public_code text, reason_summary text, general_area text,
 availability text, source text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
 select c.id,c.public_code,c.reason_summary,c.general_area,c.availability,c.source,c.created_at
 from public.patient_bank_cases c
 where (select auth.uid()) is not null and public.is_admin() and c.status='pending_review'
 order by c.created_at asc;
$$;

create or replace function public.patient_bank_admin_review(p_case_id uuid,p_approve boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_updated integer;
begin
 if (select auth.uid()) is null or not public.is_admin() then
   raise exception 'No tienes permisos para revisar solicitudes.';
 end if;
 update public.patient_bank_cases
 set status=case when p_approve then 'available' else 'rejected' end,
     updated_at=now()
 where id=p_case_id and status='pending_review';
 get diagnostics v_updated=row_count;
 if v_updated=1 then
   insert into public.patient_bank_case_events(case_id,actor_id,action)
   values (p_case_id,(select auth.uid()),case when p_approve then 'review_approved' else 'review_rejected' end);
 end if;
 return v_updated=1;
end;
$$;

revoke all on function public.patient_bank_is_admin() from public,anon;
revoke all on function public.patient_bank_admin_pending() from public,anon;
revoke all on function public.patient_bank_admin_review(uuid,boolean) from public,anon;
grant execute on function public.patient_bank_is_admin() to authenticated;
grant execute on function public.patient_bank_admin_pending() to authenticated;
grant execute on function public.patient_bank_admin_review(uuid,boolean) to authenticated;
