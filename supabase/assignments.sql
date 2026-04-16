-- Run this in the Supabase SQL editor (Dashboard → SQL).
-- Creates the assignments table, enables RLS, and restricts rows to the owning user.

create extension if not exists "pgcrypto";

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  subject text not null,
  due_at timestamptz not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists assignments_user_id_idx on public.assignments (user_id);
create index if not exists assignments_due_at_idx on public.assignments (due_at);

alter table public.assignments enable row level security;

create policy "assignments_select_own"
on public.assignments
for select
to authenticated
using (auth.uid() = user_id);

create policy "assignments_insert_own"
on public.assignments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "assignments_update_own"
on public.assignments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "assignments_delete_own"
on public.assignments
for delete
to authenticated
using (auth.uid() = user_id);

-- Optional: live updates in the client (AssignmentTracker subscribes to postgres_changes).
alter publication supabase_realtime add table public.assignments;
