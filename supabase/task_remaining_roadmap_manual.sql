-- TutorConnect Gambia remaining roadmap support SQL.
-- Run manually in Supabase after deploying the app code from this session.
-- Do not run from Codex. Review first, then paste into Supabase SQL editor.

-- =============================================================================
-- T0.1b: Payout write hardening
-- =============================================================================
drop policy if exists "Tutors manage own payouts" on public.payouts;
drop policy if exists "Tutors read own payouts" on public.payouts;

create policy "Tutors read own payouts"
  on public.payouts for select
  to public
  using (tutor_id in (select id from public.tutor_profiles where user_id = auth.uid()));

-- =============================================================================
-- T0.3: Admin roles and audit logs
-- =============================================================================
alter table public.admin_users add column if not exists is_active boolean default true;
alter table public.admin_users add column if not exists created_by uuid references public.admin_users(id);
alter table public.admin_users alter column role set default 'admin';

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid references public.admin_users(id),
  actor_user_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
create policy "Admins read audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid() and coalesce(au.is_active, true) = true
    )
  );

-- Replace this email with Abdul's production admin email if needed before running.
update public.admin_users
set role = 'owner', is_active = true
where lower(email) = lower('tutorconnectgambia@gmail.com');

-- =============================================================================
-- P1/P2/P5: Booking model, packages, trials, online Quran
-- =============================================================================
create table if not exists public.tutor_packages (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutor_profiles(id) on delete cascade,
  title text not null,
  description text,
  frequency_per_week integer not null check (frequency_per_week between 1 and 7),
  hours_per_visit numeric not null check (hours_per_visit > 0),
  monthly_price integer not null check (monthly_price > 0),
  additional_child_amount integer not null default 0 check (additional_child_amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutor_packages enable row level security;

drop policy if exists "Tutors manage own packages" on public.tutor_packages;
create policy "Tutors manage own packages"
  on public.tutor_packages for all
  to authenticated
  using (tutor_id in (select id from public.tutor_profiles where user_id = auth.uid()))
  with check (tutor_id in (select id from public.tutor_profiles where user_id = auth.uid()));

drop policy if exists "Public reads active packages for approved tutors" on public.tutor_packages;
create policy "Public reads active packages for approved tutors"
  on public.tutor_packages for select
  to public
  using (
    is_active = true and exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_id and tp.is_approved = true and tp.is_active = true
    )
  );

alter table public.bookings add column if not exists booking_type text not null default 'monthly';
alter table public.bookings add column if not exists pricing_model text not null default 'hourly';
alter table public.bookings add column if not exists package_id uuid references public.tutor_packages(id);
alter table public.bookings add column if not exists package_title text;
alter table public.bookings add column if not exists frequency_per_week integer;
alter table public.bookings add column if not exists hours_per_visit numeric;
alter table public.bookings add column if not exists children_count integer not null default 1;
alter table public.bookings add column if not exists lesson_format text not null default 'in_person';
alter table public.bookings add column if not exists timezone text;
alter table public.bookings add column if not exists meeting_link text;
alter table public.bookings add column if not exists trial_confirmed_at timestamptz;
alter table public.bookings add column if not exists no_show_reported_at timestamptz;
alter table public.bookings add column if not exists refund_status text;

create unique index if not exists one_trial_per_family_tutor
  on public.bookings (family_id, tutor_id)
  where booking_type = 'trial';

alter table public.lessons add column if not exists booking_type text not null default 'monthly';
alter table public.lessons add column if not exists lesson_format text not null default 'in_person';
alter table public.lessons add column if not exists timezone text;
alter table public.lessons add column if not exists family_confirmed_at timestamptz;
alter table public.lessons add column if not exists no_show_reported_at timestamptz;
alter table public.lessons add column if not exists payout_due_at timestamptz;

create table if not exists public.quran_verifications (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutor_profiles(id) on delete cascade,
  recitation_video_url text,
  tajweed_assessment text,
  credential_summary text,
  scholar_reference text,
  status text not null default 'pending',
  reviewed_by uuid references public.admin_users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quran_verifications enable row level security;

drop policy if exists "Tutors manage own quran verification" on public.quran_verifications;
create policy "Tutors manage own quran verification"
  on public.quran_verifications for all
  to authenticated
  using (tutor_id in (select id from public.tutor_profiles where user_id = auth.uid()))
  with check (tutor_id in (select id from public.tutor_profiles where user_id = auth.uid()));

drop policy if exists "Admins manage quran verification" on public.quran_verifications;
create policy "Admins manage quran verification"
  on public.quran_verifications for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid() and coalesce(au.is_active, true) = true
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid() and coalesce(au.is_active, true) = true
    )
  );

-- =============================================================================
-- Moat/legal support: referrals, disputes, privacy requests
-- =============================================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  referred_name text not null,
  referred_contact text not null,
  referred_type text not null check (referred_type in ('family', 'tutor')),
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

drop policy if exists "Users manage own referrals" on public.referrals;
create policy "Users manage own referrals"
  on public.referrals for all
  to authenticated
  using (referrer_user_id = auth.uid())
  with check (referrer_user_id = auth.uid());

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  lesson_id uuid references public.lessons(id),
  reporter_user_id uuid not null,
  reason text not null,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disputes enable row level security;

drop policy if exists "Users create own disputes" on public.disputes;
create policy "Users create own disputes"
  on public.disputes for insert
  to authenticated
  with check (reporter_user_id = auth.uid());

drop policy if exists "Users read own disputes" on public.disputes;
create policy "Users read own disputes"
  on public.disputes for select
  to authenticated
  using (reporter_user_id = auth.uid());

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null default 'submitted',
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.privacy_requests enable row level security;

drop policy if exists "Users manage own privacy requests" on public.privacy_requests;
create policy "Users manage own privacy requests"
  on public.privacy_requests for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
