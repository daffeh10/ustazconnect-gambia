import { normalizeTutorSubjects } from '@/lib/tutor-subjects'
import { normalizeTutorVerificationStatus } from '@/lib/tutor-review'

// The homepage shows four tutors. Rank a wider pool so the four on show are the
// strongest supply we have, not simply the four most recent signups.
export const HOMEPAGE_TUTOR_POOL_SIZE = 24
export const HOMEPAGE_TUTOR_COUNT = 4

export interface RankableTutor {
  subjects: string[] | null
  verification_status: string | null
  created_at?: string | null
  reviewAverage?: number | null
  reviewCount?: number
}

function matchesAny(subjects: string[], terms: string[]) {
  return subjects.some((subject) => {
    const normalized = subject.toLowerCase()
    return terms.some((term) => normalized.includes(term))
  })
}

export function teachesQuran(subjects: string[] | null) {
  return matchesAny(normalizeTutorSubjects(subjects), ['quran', 'tajweed', 'hifz'])
}

export function teachesMaths(subjects: string[] | null) {
  return matchesAny(normalizeTutorSubjects(subjects), ['math'])
}

export function isVerifiedTutor(verificationStatus: string | null | undefined) {
  return normalizeTutorVerificationStatus(verificationStatus) !== 'basic'
}

/**
 * Lower tier wins. Verified Quran teachers lead because the diaspora Quran
 * product is where the revenue is going; maths is the strongest in-person
 * demand; everything unverified sorts last regardless of subject.
 */
export function getHomepageTutorTier(tutor: RankableTutor) {
  if (!isVerifiedTutor(tutor.verification_status)) return 3
  if (teachesQuran(tutor.subjects)) return 0
  if (teachesMaths(tutor.subjects)) return 1
  return 2
}

export function compareHomepageTutors(a: RankableTutor, b: RankableTutor) {
  const tierDelta = getHomepageTutorTier(a) - getHomepageTutorTier(b)
  if (tierDelta !== 0) return tierDelta

  // A rated tutor outranks an unrated one, so early reviews earn visibility.
  const ratingDelta = (b.reviewAverage ?? -1) - (a.reviewAverage ?? -1)
  if (ratingDelta !== 0) return ratingDelta

  const reviewCountDelta = (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
  if (reviewCountDelta !== 0) return reviewCountDelta

  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
  if (Number.isNaN(aCreated) || Number.isNaN(bCreated)) return 0
  return bCreated - aCreated
}
