export const QURAN_READING_WITH_TAJWEED = 'Quran Reading with Tajweed'
export const HIFZ_QURAN_MEMORISATION = 'Hifz (Quran memorisation)'

const QURAN_READING_ALIASES = new Set([
  'quran reading',
  'tajweed',
  QURAN_READING_WITH_TAJWEED.toLowerCase(),
])

const HIFZ_ALIASES = new Set([
  'hifz',
  'hifz (memorization)',
  'hifz (memorisation)',
  HIFZ_QURAN_MEMORISATION.toLowerCase(),
])

const GENERAL_MATHEMATICS_ALIASES = new Set([
  'basic mathematics',
  'general mathematics',
])

const ARABIC_LANGUAGE_ALIASES = new Set([
  'arabic',
  'arabic language',
])

export function normalizeTutorSubject(subject: string) {
  const trimmedSubject = subject.trim()
  const normalizedSubject = trimmedSubject.toLowerCase()

  if (QURAN_READING_ALIASES.has(normalizedSubject)) {
    return QURAN_READING_WITH_TAJWEED
  }

  if (HIFZ_ALIASES.has(normalizedSubject)) {
    return HIFZ_QURAN_MEMORISATION
  }

  if (GENERAL_MATHEMATICS_ALIASES.has(normalizedSubject)) {
    return 'General Mathematics'
  }

  if (ARABIC_LANGUAGE_ALIASES.has(normalizedSubject)) {
    return 'Arabic Language'
  }

  return trimmedSubject
}

export function normalizeTutorSubjects(subjects: string[] | null | undefined) {
  return Array.from(
    new Set(
      (subjects || [])
        .map(normalizeTutorSubject)
        .filter(Boolean)
    )
  )
}

export function getTutorSubjectOptions(subjects: string[] | null | undefined) {
  const options = new Map<string, { value: string; label: string }>()

  for (const subject of subjects || []) {
    const label = normalizeTutorSubject(subject)
    if (!options.has(label)) {
      options.set(label, { value: subject, label })
    }
  }

  return Array.from(options.values())
}

export function getSubjectSearchAliases(query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (QURAN_READING_ALIASES.has(normalizedQuery)) {
    return Array.from(QURAN_READING_ALIASES)
  }

  if (HIFZ_ALIASES.has(normalizedQuery)) {
    return Array.from(HIFZ_ALIASES)
  }

  if (GENERAL_MATHEMATICS_ALIASES.has(normalizedQuery)) {
    return Array.from(GENERAL_MATHEMATICS_ALIASES)
  }

  if (ARABIC_LANGUAGE_ALIASES.has(normalizedQuery)) {
    return Array.from(ARABIC_LANGUAGE_ALIASES)
  }

  return [normalizedQuery]
}
