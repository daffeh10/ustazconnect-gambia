-- =============================================================================
-- TutorConnect Gambia — RLS hardening (TARGETED FIXES ONLY)
-- =============================================================================
--
-- CONTEXT
-- A live audit (June 2026) confirmed RLS is ENABLED on every public table and
-- the existing policies are correctly owner-scoped. DO NOT mass-apply a new
-- policy set. This file contains ONLY two targeted fixes for real gaps found in
-- the existing policies, plus one optional later hardening step.
--
-- STATUS: FIX 1 and FIX 2 were applied to the production database on 2026-06-29
--         and verified (tutor self-approval/badge blocked; admin approval still
--         works; tutor dashboard inquiries still load). The OPTIONAL step below
--         is not yet applied.
--
-- Each fix is independent, reversible, and written to avoid breaking current
-- app behavior. Apply ONE at a time in the Supabase SQL editor, then run the
-- verification query under it. Rollback statements are included.
-- =============================================================================


-- =============================================================================
-- FIX 1 — Stop tutors from self-approving / self-awarding verification badges
-- =============================================================================
-- GAP: policy "Tutors manage own profile" is FOR ALL with no WITH CHECK, so a
--      tutor can write ANY column on their own row, including is_approved and
--      verification_status. A malicious client can self-list with a fake badge.
--
-- WHY A TRIGGER (not column grants): the existing client code sends
--      is_approved:false on insert and is_active on profile save. A trigger lets
--      all of that keep working untouched while forcing the trust columns to
--      safe values for everyone EXCEPT the admin server (service_role key, which
--      is how /api/admin/* performs approvals). No app code change required.
--
-- NOTE: is_active is intentionally NOT locked — tutors legitimately toggle it,
--       and it alone cannot make a profile public (listing needs is_approved).

create or replace function public.enforce_tutor_trust_columns()
returns trigger
language plpgsql
as $$
begin
  -- The admin server authenticates with the service-role key; let it manage
  -- the trust columns. Everyone else gets them forced to safe values.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_approved := false;
    new.verification_status := 'basic';
  elsif tg_op = 'UPDATE' then
    new.is_approved := old.is_approved;
    new.verification_status := old.verification_status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tutor_trust_columns on public.tutor_profiles;
create trigger trg_enforce_tutor_trust_columns
  before insert or update on public.tutor_profiles
  for each row execute function public.enforce_tutor_trust_columns();

-- VERIFY (as a normal logged-in tutor, via the app or anon/authed key):
--   update tutor_profiles set is_approved = true, verification_status =
--     'Qualification Verified' where user_id = auth.uid();
--   -- then re-select: is_approved must still be false / unchanged.
-- And confirm the admin "approve" button in /admin/tutors still works.
--
-- ROLLBACK:
--   drop trigger if exists trg_enforce_tutor_trust_columns on public.tutor_profiles;
--   drop function if exists public.enforce_tutor_trust_columns();


-- =============================================================================
-- FIX 2 — Stop the public from reading every inquiry's name + phone
-- =============================================================================
-- GAP: policy "Inquiries are readable" is SELECT to public USING (true), so the
--      anon key can read all inquiries (family_name, family_phone). The app only
--      reads inquiries scoped to the owning tutor, which the separate policy
--      "Tutors can read own inquiries" already covers. This public policy is
--      pure PII over-exposure (PDPP relevant) with no functional use.

drop policy if exists "Inquiries are readable" on public.inquiries;

-- VERIFY: the tutor dashboard "inquiries" section still loads (it relies on
--   "Tutors can read own inquiries", which remains). An anonymous request to
--   read inquiries should now return no rows.
--
-- ROLLBACK (only if something unexpectedly depended on it):
--   create policy "Inquiries are readable" on public.inquiries
--     for select to public using (true);


-- =============================================================================
-- OPTIONAL LATER — hide approved tutors' phone/email columns from anon
-- =============================================================================
-- The public read policy on tutor_profiles correctly limits ROWS to approved
-- tutors, but still exposes ALL columns (incl. phone/email) to the anon key.
-- To column-scope it, expose a safe view and repoint the public client queries:
--
--   create or replace view public.public_tutors as
--     select id, name, location, subjects, experience_years, hourly_rate, bio,
--            available_days, available_times, profile_photo_url, offers_online,
--            verification_status, average_rating, created_at
--     from public.tutor_profiles
--     where is_active = true and is_approved = true;
--
--   revoke select on public.tutor_profiles from anon;
--   grant  select on public.public_tutors  to anon, authenticated;
--
-- Then change the public queries in app/find-tutor/FindUstazClient.tsx,
-- app/tutor/[id]/* and app/book/[tutorId] to read 'public_tutors'.
-- Deploy the view FIRST, then the client change. (Not urgent.)
-- =============================================================================
