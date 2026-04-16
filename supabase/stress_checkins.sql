-- Run in Supabase SQL editor. Stores stress check-ins per user (RLS: own rows only).

create table if not exists public.stress_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stress_level text not null
    check (stress_level in ('chill', 'okay', 'stressed', 'overwhelmed')),
  created_at timestamptz not null default now()
);

create index if not exists stress_checkins_user_created_idx
  on public.stress_checkins (user_id, created_at desc);

alter table public.stress_checkins enable row level security;

create policy "stress_checkins_select_own"
on public.stress_checkins
for select
to authenticated
using (auth.uid() = user_id);

create policy "stress_checkins_insert_own"
on public.stress_checkins
for insert
to authenticated
with check (auth.uid() = user_id);
