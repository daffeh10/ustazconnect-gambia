import { SUBJECT_CATEGORIES } from '@/lib/constants'

type SubjectGroup = {
  category: string
  subjects: string[]
}

function normalizeSubjectQuery(query: string) {
  return query.trim().toLowerCase()
}

function expandSubjectAliases(query: string) {
  const normalizedQuery = normalizeSubjectQuery(query)

  if (
    normalizedQuery === 'general mathematics' ||
    normalizedQuery === 'basic mathematics'
  ) {
    return ['general mathematics', 'basic mathematics']
  }

  return [normalizedQuery]
}

export function filterSubjectGroups(query: string): SubjectGroup[] {
  const normalizedQuery = normalizeSubjectQuery(query)

  if (!normalizedQuery) {
    return SUBJECT_CATEGORIES.map((group) => ({
      category: group.category,
      subjects: [...group.subjects],
    }))
  }

  return SUBJECT_CATEGORIES.map((group) => {
    const categoryMatches = group.category.toLowerCase().includes(normalizedQuery)
    const subjects = categoryMatches
      ? [...group.subjects]
      : group.subjects.filter((subject) =>
          subject.toLowerCase().includes(normalizedQuery)
        )

    return {
      category: group.category,
      subjects,
    }
  }).filter((group) => group.subjects.length > 0)
}

export function matchesSubjectSearch(
  subjects: string[] | null | undefined,
  query: string
) {
  const normalizedQuery = normalizeSubjectQuery(query)

  if (!normalizedQuery) return true

  const acceptableQueries = expandSubjectAliases(normalizedQuery)

  return (subjects || []).some((subject) => {
    const normalizedSubject = subject.toLowerCase()

    return acceptableQueries.some((candidate) =>
      normalizedSubject.includes(candidate)
    )
  })
}
