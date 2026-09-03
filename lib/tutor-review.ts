import { BASIC_TUTOR_GRACE_ENABLED } from '@/lib/features'

export const TUTOR_REVIEW_CONTACT_EMAIL = 'tutorconnectgambia@gmail.com'
export const BASIC_TUTOR_GRACE_PERIOD_DAYS = 90

const DAY_IN_MS = 1000 * 60 * 60 * 24

export type TutorVerificationStatus =
  | 'basic'
  | 'profile_reviewed'
  | 'qualification_verified'
  | 'premium'

export function formatPublicTutorName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'Tutor'
  if (parts.length === 1) return parts[0]

  const firstName = parts[0]
  const lastInitial = parts[parts.length - 1]?.charAt(0).toUpperCase()

  return lastInitial ? `${firstName} ${lastInitial}.` : firstName
}

export function normalizeTutorVerificationStatus(
  status?: string | null
): TutorVerificationStatus {
  const cleaned = (status || '').toLowerCase().trim()

  if (cleaned === 'qualification_verified' || cleaned === 'verified') {
    return 'qualification_verified'
  }

  if (cleaned === 'profile_reviewed') {
    return 'profile_reviewed'
  }

  if (cleaned === 'premium') {
    return 'premium'
  }

  return 'basic'
}

export function getBasicTutorGraceInfo(createdAt?: string | null, now = new Date()) {
  const nowTime = now.getTime()
  const createdAtTime = createdAt ? new Date(createdAt).getTime() : Number.NaN

  if (Number.isNaN(nowTime) || Number.isNaN(createdAtTime)) {
    return {
      isExpired: false,
      daysRemaining: BASIC_TUTOR_GRACE_PERIOD_DAYS,
      daysElapsed: 0,
    }
  }

  const daysElapsed = Math.max(0, Math.floor((nowTime - createdAtTime) / DAY_IN_MS))
  const daysRemaining = Math.max(0, BASIC_TUTOR_GRACE_PERIOD_DAYS - daysElapsed)

  return {
    isExpired: daysElapsed >= BASIC_TUTOR_GRACE_PERIOD_DAYS,
    daysRemaining,
    daysElapsed,
  }
}

export function isTutorPubliclyVisible({
  isApproved = true,
  isTestAccount = false,
  verificationStatus,
  createdAt,
  now,
}: {
  isApproved?: boolean | null
  isTestAccount?: boolean | null
  verificationStatus?: string | null
  createdAt?: string | null
  now?: Date
}) {
  if (!isApproved) return false

  // Internal QA profiles stay bookable by direct link but never surface publicly.
  if (isTestAccount) return false

  const normalizedStatus = normalizeTutorVerificationStatus(verificationStatus)
  if (normalizedStatus !== 'basic') return true
  if (!BASIC_TUTOR_GRACE_ENABLED) return true

  return !getBasicTutorGraceInfo(createdAt, now).isExpired
}

// The documents that count as evidence for a public listing. A CV is explicitly
// optional supporting material and national_id proves identity, not competence,
// so neither satisfies the listing requirement on its own.
export const REVIEW_DOCUMENT_TYPES = ['certificate', 'study_proof', 'teaching_reference'] as const

export interface TutorDocumentStatusRow {
  document_type: string
  status: string | null
}

/**
 * True when the tutor has at least one review document on file that an admin has
 * not rejected. Pending counts: the admin is looking at it when they approve, and
 * an approved document is what lifts the tutor above Basic.
 */
export function hasReviewDocumentOnFile(documents: TutorDocumentStatusRow[]) {
  return documents.some((document) => {
    const normalizedType = document.document_type.toLowerCase().trim()
    const normalizedStatus = (document.status || 'pending').toLowerCase().trim()

    return (
      (REVIEW_DOCUMENT_TYPES as readonly string[]).includes(normalizedType) &&
      normalizedStatus !== 'rejected'
    )
  })
}

export function getTutorReviewPathFromApprovedDocumentTypes(documentTypes: string[]) {
  const normalizedTypes = new Set(
    documentTypes.map((documentType) => documentType.toLowerCase().trim())
  )

  if (normalizedTypes.has('certificate')) {
    return 'qualification_verified' as const
  }

  if (
    normalizedTypes.has('study_proof') ||
    normalizedTypes.has('teaching_reference')
  ) {
    return 'profile_reviewed' as const
  }

  return null
}

export function getTutorDocumentTypeLabel(documentType: string) {
  const normalizedType = documentType.toLowerCase().trim()

  if (normalizedType === 'certificate') return 'Qualification document'
  if (normalizedType === 'study_proof') return 'Current study proof'
  if (normalizedType === 'teaching_reference') return 'Teaching reference'
  if (normalizedType === 'cv') return 'CV / resume'
  if (normalizedType === 'national_id') return 'National ID'

  return documentType.replace(/_/g, ' ')
}
