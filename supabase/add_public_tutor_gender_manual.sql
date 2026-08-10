-- TutorConnect Gambia public tutor gender display.
-- Run manually in the Supabase SQL editor before or after deploying the matching app code.
-- The app safely falls back to the current view until this script has been run.

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

-- Verification: values should be Male, Female, or blank for older profiles.
select gender, count(*) as public_tutor_count
from public.public_tutors
group by gender
order by gender nulls last;
