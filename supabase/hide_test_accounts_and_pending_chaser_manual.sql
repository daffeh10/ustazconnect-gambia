-- =============================================================================
-- TutorConnect Gambia — hide internal test tutors + chase unanswered bookings
-- =============================================================================
-- Run this in the Supabase SQL editor BEFORE deploying the matching app code.
-- The app code queries these columns; deploying first would make the public
-- listings fall back to their legacy queries until this has run.
--
-- Each step is independent and reversible. Run one at a time.
-- =============================================================================


-- =============================================================================
-- STEP 1 — add the internal test-account flag
-- =============================================================================
alter table public.tutor_profiles
  add column if not exists is_test_account boolean not null default false;


-- =============================================================================
-- STEP 2 — make is_test_account a trust column (service-role writes only)
-- =============================================================================
-- Same reasoning as is_approved / verification_status: a tutor must not be able
-- to unhide themselves from the browser with the anon key. This replaces the
-- existing function body; the trigger created in rls_policies.sql FIX 1 stays.

create or replace function public.enforce_tutor_trust_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_approved := false;
    new.verification_status := 'basic';
    new.is_test_account := false;
  elsif tg_op = 'UPDATE' then
    new.is_approved := old.is_approved;
    new.verification_status := old.verification_status;
    new.is_test_account := old.is_test_account;
  end if;

  return new;
end;
$$;

-- VERIFY (as a logged-in tutor, not the service role):
--   update tutor_profiles set is_test_account = false where user_id = auth.uid();
--   -- re-select: the value must be unchanged.


-- =============================================================================
-- STEP 3 — expose the flag on the public view + retire the 90-day Basic grace
-- =============================================================================
-- NOTE: the flag is exposed as a COLUMN rather than filtered in the WHERE clause.
-- Discovery surfaces (home, /find-tutor, /tutor/[id], sitemap, /online-quran)
-- filter on it explicitly, while /book/[tutorId] and the payment page do not —
-- that is what keeps a test tutor bookable by direct link for internal QA while
-- never appearing anywhere a real family can find one.
-- create or replace view can only APPEND columns, so is_test_account goes last.

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
  end as gender,
  is_test_account
from public.tutor_profiles
where is_active = true
  and is_approved = true;

-- The 90-day Basic grace period is PAUSED while we build tutor supply: approved
-- Basic tutors now stay listed indefinitely. Six real tutors had already aged
-- out silently. The app mirrors this with BASIC_TUTOR_GRACE_ENABLED in
-- lib/features.ts — flip BOTH back together to re-arm it:
--
--   and (
--     coalesce(lower(trim(verification_status)), 'basic') <> 'basic'
--     or created_at >= now() - interval '90 days'
--   );

revoke all on public.public_tutors from public;
grant select on public.public_tutors to anon, authenticated;


-- =============================================================================
-- STEP 4 — mark the two internal test tutors
-- =============================================================================
-- CHECK FIRST. Confirm this returns exactly these two rows and nothing else.

select id, name, email, is_approved, verification_status, is_test_account
from public.tutor_profiles
where id in (
  '69b3e576-cde7-473a-b7b2-f872a30539ff',  -- Abdou Daffeh
  'eff52053-31a4-4621-9e16-4fea84902042'   -- Ali Jammeh
);

-- Then flag them.
update public.tutor_profiles
set is_test_account = true, updated_at = now()
where id in (
  '69b3e576-cde7-473a-b7b2-f872a30539ff',
  'eff52053-31a4-4621-9e16-4fea84902042'
);

-- VERIFY: neither id may appear in the public listing.
--   select id, name from public.public_tutors where is_test_account = false;
-- With the grace period retired in STEP 3 this should return 11 tutors: the 13
-- approved-and-active profiles, minus these two.

-- ROLLBACK (put one back on the public site):
--   update public.tutor_profiles set is_test_account = false
--   where id = '69b3e576-cde7-473a-b7b2-f872a30539ff';


-- =============================================================================
-- STEP 5 — track the tutor nudge on pending bookings
-- =============================================================================
-- Used by /api/cron/maintenance so a tutor is nudged once, not every day.

alter table public.bookings
  add column if not exists tutor_nudge_sent_at timestamptz;

create index if not exists bookings_pending_created_at_idx
  on public.bookings (status, created_at)
  where status = 'pending';

-- VERIFY: the daily cron returns pendingNudgesSent / pendingBookingsExpired.
--   Requests are nudged at 24h and auto-cancelled at 120h (5 days).
--
-- ROLLBACK:
--   drop index if exists public.bookings_pending_created_at_idx;
--   alter table public.bookings drop column if exists tutor_nudge_sent_at;
