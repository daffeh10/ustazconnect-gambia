export interface UstazProfile {
  id: string
  name: string
  phone: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
  bio: string | null
  available_days: string[] | null
  created_at: string
}

export interface Inquiry {
  id: string
  ustaz_id: string
  family_name: string
  family_phone: string
  message: string | null
  created_at: string
}

export const LOCATIONS = [
  'Serrekunda',
  'Banjul',
  'Bakau',
  'Brikama',
  'Kololi',
  'Kotu',
  'Fajara'
] as const

export const SUBJECTS = [
  'Quran Reading',
  'Tajweed',
  'Hifz (Memorization)',
  'Arabic Language',
  'Islamic Studies'
] as const

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const