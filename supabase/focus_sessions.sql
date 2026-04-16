-- Run in Supabase SQL editor. Stores completed timer runs for daily stats (RLS: own rows only).

create table if not exists public.focus_session_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_at timestamptz not null default now(),
  preset text not null check (preset in ('focus', 'quick', 'break')),
  duration_seconds int not null check (duration_seconds > 0)
);

create index if not exists focus_completions_user_completed_idx
  on public.focus_session_completions (user_id, completed_at desc);

alter table public.focus_session_completions enable row level security;

create policy "focus_completions_select_own"
on public.focus_session_completions
for select
to authenticated
using (auth.uid() = user_id);

create policy "focus_completions_insert_own"
on public.focus_session_completions
for insert
to authenticated
with check (auth.uid() = user_id);
