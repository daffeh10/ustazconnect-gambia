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
update public.admin_users set is_active = true where is_active is null;
alter table public.admin_users alter column is_active set not null;

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

alter table public.bookings
  drop constraint if exists bookings_booking_type_check;
alter table public.bookings
  add constraint bookings_booking_type_check
  check (booking_type in ('monthly', 'trial')) not valid;

alter table public.bookings
  drop constraint if exists bookings_pricing_model_check;
alter table public.bookings
  add constraint bookings_pricing_model_check
  check (pricing_model in ('hourly', 'package', 'trial')) not valid;

alter table public.bookings
  drop constraint if exists bookings_lesson_format_check;
alter table public.bookings
  add constraint bookings_lesson_format_check
  check (lesson_format in ('in_person', 'online')) not valid;

create unique index if not exists one_trial_per_family_tutor
  on public.bookings (family_id, tutor_id)
  where booking_type = 'trial';

alter table public.lessons add column if not exists booking_type text not null default 'monthly';
alter table public.lessons add column if not exists lesson_format text not null default 'in_person';
alter table public.lessons add column if not exists timezone text;
alter table public.lessons add column if not exists family_confirmed_at timestamptz;
alter table public.lessons add column if not exists no_show_reported_at timestamptz;
alter table public.lessons add column if not exists payout_due_at timestamptz;
alter table public.lessons add column if not exists scheduled_at timestamptz;
alter table public.lessons add column if not exists meeting_link text;
alter table public.lessons add column if not exists reminder_sent_at timestamptz;

create or replace function public.protect_lesson_financial_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.status := 'scheduled';
      new.duration_minutes := null;
      new.completed_at := null;
      new.family_confirmed_at := null;
      new.no_show_reported_at := null;
      new.payout_due_at := null;
      new.scheduled_at := null;
      new.meeting_link := null;
      new.reminder_sent_at := null;
    else
      new.status := old.status;
      new.duration_minutes := old.duration_minutes;
      new.completed_at := old.completed_at;
      new.family_confirmed_at := old.family_confirmed_at;
      new.no_show_reported_at := old.no_show_reported_at;
      new.payout_due_at := old.payout_due_at;
      new.scheduled_at := old.scheduled_at;
      new.meeting_link := old.meeting_link;
      new.reminder_sent_at := old.reminder_sent_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_lesson_financial_fields on public.lessons;
create trigger trg_protect_lesson_financial_fields
  before insert or update on public.lessons
  for each row execute function public.protect_lesson_financial_fields();

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
drop policy if exists "Tutors read own quran verification" on public.quran_verifications;
create policy "Tutors read own quran verification"
  on public.quran_verifications for select
  to authenticated
  using (tutor_id in (select id from public.tutor_profiles where user_id = auth.uid()));

drop policy if exists "Tutors submit own quran verification" on public.quran_verifications;
create policy "Tutors submit own quran verification"
  on public.quran_verifications for insert
  to authenticated
  with check (
    tutor_id in (select id from public.tutor_profiles where user_id = auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
  );

alter table public.quran_verifications
  drop constraint if exists quran_verifications_status_check;
alter table public.quran_verifications
  add constraint quran_verifications_status_check
  check (status in ('pending', 'approved', 'rejected')) not valid;

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
drop policy if exists "Users submit own referrals" on public.referrals;
create policy "Users submit own referrals"
  on public.referrals for insert
  to authenticated
  with check (referrer_user_id = auth.uid() and status = 'submitted');

drop policy if exists "Users read own referrals" on public.referrals;
create policy "Users read own referrals"
  on public.referrals for select
  to authenticated
  using (referrer_user_id = auth.uid());

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
drop policy if exists "Users submit own privacy requests" on public.privacy_requests;
create policy "Users submit own privacy requests"
  on public.privacy_requests for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'submitted' and completed_at is null);

drop policy if exists "Users read own privacy requests" on public.privacy_requests;
create policy "Users read own privacy requests"
  on public.privacy_requests for select
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- Review remediation: payout integrity, admin constraints, and public privacy
-- =============================================================================
alter table public.payouts add column if not exists payout_type text not null default 'regular';
alter table public.payouts add column if not exists booking_id uuid references public.bookings(id);

alter table public.payouts
  drop constraint if exists payouts_payout_type_check;
alter table public.payouts
  add constraint payouts_payout_type_check
  check (payout_type in ('regular', 'trial')) not valid;

do $$
begin
  if exists (
    select 1
    from public.payouts
    where status = 'pending' and payout_type = 'regular'
    group by tutor_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate regular pending payouts exist. Resolve them in the admin dashboard before rerunning this SQL.';
  end if;
end
$$;

create unique index if not exists one_pending_regular_payout_per_tutor
  on public.payouts (tutor_id)
  where status = 'pending' and payout_type = 'regular';

create unique index if not exists one_trial_payout_per_booking
  on public.payouts (booking_id)
  where payout_type = 'trial' and booking_id is not null;

alter table public.admin_users
  drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('owner', 'admin', 'quran_verifier')) not valid;

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_owner_count integer;
  removes_owner boolean;
begin
  if tg_op = 'DELETE' then
    removes_owner := old.role = 'owner' and old.is_active = true;
  else
    removes_owner :=
      old.role = 'owner'
      and old.is_active = true
      and (new.role <> 'owner' or new.is_active = false);
  end if;

  if removes_owner then
    perform pg_advisory_xact_lock(87542026);
    select count(*)
      into active_owner_count
      from public.admin_users
      where id <> old.id and role = 'owner' and is_active = true;

    if active_owner_count = 0 then
      raise exception 'Cannot remove the last active owner.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_last_owner_removal on public.admin_users;
create trigger trg_prevent_last_owner_removal
  before update or delete on public.admin_users
  for each row execute function public.prevent_last_owner_removal();

create or replace view public.public_tutors
with (security_barrier = true)
as
select
  id,
  regexp_replace(trim(name), '^(\S+)(?:\s+.*)?\s+(\S)\S*$', '\1 \2.') as name,
  location,
  subjects,
  experience_years,
  hourly_rate,
  bio,
  available_days,
  available_times,
  profile_photo_url,
  offers_online,
  languages,
  areas_covered,
  age_groups,
  education,
  verification_status,
  average_rating,
  created_at,
  case lower(trim(gender))
    when 'male' then 'Male'
    when 'female' then 'Female'
    else null
  end as gender
from public.tutor_profiles
where is_active = true
  and is_approved = true
  and (
    coalesce(lower(trim(verification_status)), 'basic') <> 'basic'
    or created_at >= now() - interval '90 days'
  );

revoke all on public.public_tutors from public;
grant select on public.public_tutors to anon, authenticated;
revoke select on public.tutor_profiles from anon;

create or replace view public.public_tutor_packages
with (security_barrier = true)
as
select
  package.id,
  package.tutor_id,
  package.title,
  package.description,
  package.frequency_per_week,
  package.hours_per_visit,
  package.monthly_price,
  package.additional_child_amount
from public.tutor_packages package
join public.tutor_profiles tutor on tutor.id = package.tutor_id
where package.is_active = true
  and tutor.is_active = true
  and tutor.is_approved = true
  and (
    coalesce(lower(trim(tutor.verification_status)), 'basic') <> 'basic'
    or tutor.created_at >= now() - interval '90 days'
  );

revoke all on public.public_tutor_packages from public;
grant select on public.public_tutor_packages to anon, authenticated;
revoke select on public.tutor_packages from anon;
drop policy if exists "Public reads active packages for approved tutors"
  on public.tutor_packages;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tutor_profiles'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.tutor_profiles', policy_row.policyname);
  end loop;
end
$$;

create policy "Tutors read own profile"
  on public.tutor_profiles for select
  to authenticated
  using (user_id = auth.uid());

-- Booking, lesson, report, and payout writes now pass through authenticated
-- server routes. Keep browser access read-only so payload fields cannot be forged.
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.lessons from anon, authenticated;
revoke insert, update, delete on public.reports from anon, authenticated;
revoke insert, update, delete on public.payouts from anon, authenticated;

-- =============================================================================
-- Marketplace UX: privacy-safe funnel events
-- =============================================================================
create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  path text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.funnel_events enable row level security;

alter table public.funnel_events
  drop constraint if exists funnel_events_event_name_check;
alter table public.funnel_events
  add constraint funnel_events_event_name_check
  check (
    event_name in (
      'marketplace_search',
      'service_selected',
      'tutor_profile_viewed',
      'booking_started',
      'booking_request_sent',
      'tutor_registration_started',
      'tutor_registration_completed'
    )
  );

revoke all on public.funnel_events from anon, authenticated;

create index if not exists funnel_events_name_created_at_idx
  on public.funnel_events (event_name, created_at desc);
