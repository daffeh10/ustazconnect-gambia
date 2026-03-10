-- Sets up the inquiries table used by the "Contact This Tutor" form.
-- Safe to run multiple times.
-- Also upgrades legacy tables that only have ustaz_id.

create extension if not exists pgcrypto;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid,
  family_name text,
  family_phone text,
  message text,
  created_at timestamptz not null default now()
);

alter table public.inquiries add column if not exists tutor_id uuid;
alter table public.inquiries add column if not exists family_name text;
alter table public.inquiries add column if not exists family_phone text;
alter table public.inquiries add column if not exists message text;
alter table public.inquiries add column if not exists created_at timestamptz default now();

-- Backfill tutor_id from legacy ustaz_id when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inquiries'
      and column_name = 'ustaz_id'
  ) then
    update public.inquiries
    set tutor_id = ustaz_id
    where tutor_id is null;
  end if;
end $$;

create index if not exists inquiries_tutor_id_idx on public.inquiries (tutor_id);
create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);

alter table public.inquiries enable row level security;

drop policy if exists "Public can submit inquiries" on public.inquiries;
create policy "Public can submit inquiries"
on public.inquiries
for insert
to anon, authenticated
with check (
  tutor_id is not null
  and family_name is not null
  and length(trim(family_name)) > 0
  and family_phone is not null
  and length(trim(family_phone)) > 0
);

drop policy if exists "Tutors can read own inquiries" on public.inquiries;
create policy "Tutors can read own inquiries"
on public.inquiries
for select
to authenticated
using (
  exists (
    select 1
    from public.tutor_profiles tp
    where tp.id = inquiries.tutor_id
      and tp.user_id = auth.uid()
  )
);
