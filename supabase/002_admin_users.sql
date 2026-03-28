-- Admin users table for DB-based admin authorization
-- Run after schema.sql in Supabase Dashboard → SQL Editor

create table if not exists public.admin_users (
    id         uuid primary key default gen_random_uuid(),
    email      text unique not null,
    created_at timestamptz not null default now()
);

-- Seed known admin
insert into public.admin_users (email)
values ('jhmedvani2026@gmail.com')
on conflict (email) do nothing;

-- RLS: only service-role or admin can read admin_users
alter table public.admin_users enable row level security;

create policy "admin_users_read_admin"
    on public.admin_users for select to authenticated
    using (public.current_user_role() = 'admin');
