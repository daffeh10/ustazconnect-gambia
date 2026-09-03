-- =============================================================================
-- TutorConnect Gambia — cap the tutor hourly rate at GMD 400
-- =============================================================================
-- Run in the Supabase SQL editor. The app validates the cap in the registration
-- form and the tutor dashboard, but tutor_profiles rows are written from the
-- BROWSER, so client validation is cosmetic (see CLAUDE.md gotcha 1). This
-- constraint is the real boundary.
--
-- NOT VALID is deliberate: two existing unapproved profiles are above the cap
-- (Okunola Dolapo at 750, Malick Jallow at 600). NOT VALID enforces the rule on
-- every new insert and update while leaving those rows readable, so nothing
-- breaks and neither tutor is silently deleted. They must lower their rate
-- before they can save their profile again.
-- =============================================================================

alter table public.tutor_profiles
  drop constraint if exists tutor_profiles_hourly_rate_max;

alter table public.tutor_profiles
  add constraint tutor_profiles_hourly_rate_max
  check (hourly_rate is null or hourly_rate <= 400)
  not valid;

-- VERIFY: this must fail with a constraint violation.
--   update public.tutor_profiles set hourly_rate = 500
--   where id = (select id from public.tutor_profiles limit 1);
--
-- See who is currently above the cap:
--   select name, hourly_rate, is_approved from public.tutor_profiles
--   where hourly_rate > 400 order by hourly_rate desc;
--
-- LATER — once every profile is at or below 400, promote it to fully enforced:
--   alter table public.tutor_profiles validate constraint tutor_profiles_hourly_rate_max;
--
-- ROLLBACK:
--   alter table public.tutor_profiles drop constraint if exists tutor_profiles_hourly_rate_max;
