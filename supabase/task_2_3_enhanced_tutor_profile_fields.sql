ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS areas_covered text[] DEFAULT '{}';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS travel_radius_km integer DEFAULT 5;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{English}';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS age_groups text[] DEFAULT '{}';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS education text DEFAULT '';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS gender text DEFAULT '';
