-- Private agenda and reminders for each student.
create table if not exists public.student_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text,
  reminder_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_student_reminders_user_date on public.student_reminders(user_id, reminder_at);
alter table public.student_reminders enable row level security;
drop policy if exists "Users read own reminders" on public.student_reminders;
create policy "Users read own reminders" on public.student_reminders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own reminders" on public.student_reminders;
create policy "Users create own reminders" on public.student_reminders for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own reminders" on public.student_reminders;
create policy "Users update own reminders" on public.student_reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own reminders" on public.student_reminders;
create policy "Users delete own reminders" on public.student_reminders for delete to authenticated using ((select auth.uid()) = user_id);
