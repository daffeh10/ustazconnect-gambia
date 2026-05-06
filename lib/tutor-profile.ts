export const LANGUAGE_OPTIONS = [
  'English',
  'Wolof',
  'Mandinka',
  'Fula',
  'Jola',
  'Arabic',
  'French',
  'Other',
] as const

export const AGE_GROUP_OPTIONS = [
  'Children 5-12',
  'Teens 13-17',
  'Adults 18+',
] as const

export const EDUCATION_OPTIONS = [
  'Secondary',
  'Diploma',
  "Bachelor's",
  "Master's",
  'PhD',
  'Islamic Seminary',
  'Other',
] as const

export const TRAVEL_RADIUS_OPTIONS = [
  { label: '1 km', value: 1 },
  { label: '2 km', value: 2 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '15 km', value: 15 },
  { label: '20 km+', value: 20 },
] as const

const GAMBIA_COUNTRY_CODE = '220'
const GAMBIA_LOCAL_DIGIT_COUNT = 7

export const TUTOR_PROFILE_TASK_2_3_SQL = `ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS areas_covered text[] DEFAULT '{}';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS travel_radius_km integer DEFAULT 5;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{English}';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS age_groups text[] DEFAULT '{}';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS education text DEFAULT '';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;`

export function sanitizeGambiaPhoneDigits(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  const withoutCountryCode = digitsOnly.startsWith(GAMBIA_COUNTRY_CODE)
    ? digitsOnly.slice(GAMBIA_COUNTRY_CODE.length)
    : digitsOnly

  return withoutCountryCode.slice(0, GAMBIA_LOCAL_DIGIT_COUNT)
}

export function extractGambiaPhoneDigits(value: string | null | undefined) {
  if (!value) return ''
  return sanitizeGambiaPhoneDigits(value)
}

export function formatGambiaPhoneFromDigits(value: string) {
  const digits = sanitizeGambiaPhoneDigits(value)
  return digits ? `+220 ${digits}` : ''
}

export function isValidGambiaPhoneDigits(value: string) {
  return sanitizeGambiaPhoneDigits(value).length === GAMBIA_LOCAL_DIGIT_COUNT
}

export function isMissingEnhancedTutorProfileColumnError(message: string) {
  const normalized = message.toLowerCase()

  return [
    'areas_covered',
    'travel_radius_km',
    'languages',
    'age_groups',
    'education',
    'consent_given_at',
    'offers_online',
    'available_days',
    'available_times',
    'column',
  ].some((term) => normalized.includes(term))
}
