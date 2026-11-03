-- OdontoUdeC: perfil ampliado, onboarding y racha diaria.
-- Se mantiene la política actual de perfiles mientras se auditan sus consumidores.
alter table public.profiles
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.user_activity_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  created_at timestamptz not null default now(),
  constraint user_activity_days_user_date_unique unique (user_id, activity_date)
);

create index if not exists idx_user_activity_days_user_date
  on public.user_activity_days (user_id, activity_date desc);

alter table public.user_activity_days enable row level security;

drop policy if exists "Users read own activity days" on public.user_activity_days;
create policy "Users read own activity days"
  on public.user_activity_days for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users record own current activity day" on public.user_activity_days;
create policy "Users record own current activity day"
  on public.user_activity_days for insert to authenticated
  with check (
    auth.uid() = user_id
    and activity_date = (now() at time zone 'America/Bogota')::date
  );

-- No se habilitan UPDATE ni DELETE para conservar la integridad del registro diario.
