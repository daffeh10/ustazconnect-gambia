-- TutorConnect Gambia subject-name cleanup.
-- Run manually in the Supabase SQL editor after deploying the matching app code.
-- This script is idempotent: rerunning it makes no further changes.

-- Canonical names:
--   Quran Reading with Tajweed
--   Hifz (Quran memorisation)
--   Arabic Language
--   General Mathematics

-- =============================================================================
-- 1. Normalise tutor profile subjects and remove equivalent duplicates.
-- =============================================================================
with normalised_subject_rows as (
  select
    tutor.id,
    case
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'quran reading',
        'tajweed',
        'quran reading with tajweed'
      ) then 'Quran Reading with Tajweed'
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'hifz',
        'hifz (memorization)',
        'hifz (memorisation)',
        'hifz (quran memorization)',
        'hifz (quran memorisation)'
      ) then 'Hifz (Quran memorisation)'
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'arabic',
        'arabic language'
      ) then 'Arabic Language'
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'basic mathematics',
        'general mathematics'
      ) then 'General Mathematics'
      else trim(subject_row.raw_subject)
    end as subject_name,
    subject_row.position
  from public.tutor_profiles tutor
  cross join lateral unnest(tutor.subjects) with ordinality
    as subject_row(raw_subject, position)
  where subject_row.raw_subject is not null
    and trim(subject_row.raw_subject) <> ''
),
deduplicated_subject_rows as (
  select
    id,
    subject_name,
    min(position) as first_position
  from normalised_subject_rows
  group by id, subject_name
),
normalised_profiles as (
  select
    id,
    array_agg(subject_name order by first_position) as subjects
  from deduplicated_subject_rows
  group by id
)
update public.tutor_profiles as tutor
set subjects = normalised.subjects
from normalised_profiles as normalised
where tutor.id = normalised.id
  and tutor.subjects is distinct from normalised.subjects;

-- =============================================================================
-- 2. Apply the same display names to existing booking history.
-- =============================================================================
with normalised_subject_rows as (
  select
    booking.id,
    case
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'quran reading',
        'tajweed',
        'quran reading with tajweed'
      ) then 'Quran Reading with Tajweed'
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'hifz',
        'hifz (memorization)',
        'hifz (memorisation)',
        'hifz (quran memorization)',
        'hifz (quran memorisation)'
      ) then 'Hifz (Quran memorisation)'
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'arabic',
        'arabic language'
      ) then 'Arabic Language'
      when lower(regexp_replace(trim(subject_row.raw_subject), '\s+', ' ', 'g')) in (
        'basic mathematics',
        'general mathematics'
      ) then 'General Mathematics'
      else trim(subject_row.raw_subject)
    end as subject_name,
    subject_row.position
  from public.bookings booking
  cross join lateral unnest(booking.subjects) with ordinality
    as subject_row(raw_subject, position)
  where subject_row.raw_subject is not null
    and trim(subject_row.raw_subject) <> ''
),
deduplicated_subject_rows as (
  select
    id,
    subject_name,
    min(position) as first_position
  from normalised_subject_rows
  group by id, subject_name
),
normalised_bookings as (
  select
    id,
    array_agg(subject_name order by first_position) as subjects
  from deduplicated_subject_rows
  group by id
)
update public.bookings as booking
set subjects = normalised.subjects
from normalised_bookings as normalised
where booking.id = normalised.id
  and booking.subjects is distinct from normalised.subjects;

-- =============================================================================
-- 3. Verification. The first result lists the final subject vocabulary.
--    The second result should return no rows.
-- =============================================================================
select distinct subject_name
from public.tutor_profiles
cross join lateral unnest(subjects) as subject_name
order by subject_name;

select id, name, subjects
from public.tutor_profiles
where exists (
  select 1
  from unnest(subjects) as subject_name
  where lower(trim(subject_name)) in (
    'quran reading',
    'tajweed',
    'hifz',
    'hifz (memorization)',
    'hifz (memorisation)',
    'hifz (quran memorization)',
    'arabic',
    'basic mathematics'
  )
);
