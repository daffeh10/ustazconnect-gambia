// Maximum hourly rate a tutor may set. Deliberately NOT shown as guidance on the
// registration form -- it surfaces only when a tutor tries to exceed it, so it
// reads as a ceiling rather than a target rate to aim for.
export const MAX_TUTOR_HOURLY_RATE = 400

export function getHourlyRateError(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return 'Please enter a valid hourly rate greater than 0.'
  }

  if (rate > MAX_TUTOR_HOURLY_RATE) {
    return `Your hourly rate is above the maximum allowed on TutorConnect. The highest rate a tutor can charge is GMD ${MAX_TUTOR_HOURLY_RATE.toLocaleString()} per hour. Please enter GMD ${MAX_TUTOR_HOURLY_RATE.toLocaleString()} or less.`
  }

  return ''
}

// Single source of truth for every money calculation in the app.
//
// These functions are PURE and ISOMORPHIC: no secrets, no server-only imports,
// so they can be imported from React components (for estimates/display) AND from
// API routes (for the authoritative charge). Keeping both sides on the same code
// guarantees the amount a user is shown never drifts from what the server charges.
//
// IMPORTANT: never recompute money inline anywhere else — call these. The server
// is the authority (see app/api/payments/*); client-side use is for display only.

export const PRICING = {
  /** Family service fee added on top of the lesson cost (3%). */
  familyServiceFeeRate: 0.03,
  /** Commission deducted from a tutor's gross earnings (5%). */
  tutorCommissionRate: 0.05,
  /** Flat transport fee for a trial session — charged with no commission. (Reserved for P2.) */
  trialFeeAmount: 150,
  /** Default extra charge per additional child for hourly bookings. */
  additionalChildHourlyRate: 0.25,
  /** Default lesson length in minutes when a lesson row doesn't specify one. */
  defaultLessonMinutes: 120,
  /** Minimum chargeable amount, in GMD. */
  minPaymentAmount: 5,
} as const

/** All GMD amounts are whole dalasi; round consistently everywhere. */
export function roundGmd(amount: number): number {
  return Math.round(amount)
}

export interface BookingChargeInput {
  hourlyRate: number
  hoursPerMonth: number
  childrenCount?: number
}

export interface BookingCharge {
  monthlyTotal: number
  serviceFee: number
  grandTotal: number
}

function normalizeChildrenCount(childrenCount: number | null | undefined) {
  if (!Number.isFinite(childrenCount ?? 1)) return 1
  return Math.max(1, Math.floor(childrenCount ?? 1))
}

/** What a family pays for a monthly hourly booking: lesson cost + 3% service fee. */
export function computeBookingCharge({ hourlyRate, hoursPerMonth, childrenCount = 1 }: BookingChargeInput): BookingCharge {
  const extraChildren = Math.max(0, normalizeChildrenCount(childrenCount) - 1)
  const groupMultiplier = 1 + extraChildren * PRICING.additionalChildHourlyRate
  const monthlyTotal = roundGmd(hoursPerMonth * hourlyRate * groupMultiplier)
  const serviceFee = roundGmd(monthlyTotal * PRICING.familyServiceFeeRate)
  const grandTotal = monthlyTotal + serviceFee
  return { monthlyTotal, serviceFee, grandTotal }
}

export interface PackageChargeInput {
  monthlyPrice: number
  additionalChildAmount?: number | null
  childrenCount?: number | null
}

export function computePackageBookingCharge({
  monthlyPrice,
  additionalChildAmount = 0,
  childrenCount = 1,
}: PackageChargeInput): BookingCharge {
  const extraChildren = Math.max(0, normalizeChildrenCount(childrenCount) - 1)
  const monthlyTotal = roundGmd(monthlyPrice + extraChildren * Math.max(0, additionalChildAmount || 0))
  const serviceFee = roundGmd(monthlyTotal * PRICING.familyServiceFeeRate)
  const grandTotal = monthlyTotal + serviceFee
  return { monthlyTotal, serviceFee, grandTotal }
}

export function computeTrialBookingCharge(): BookingCharge {
  const monthlyTotal = PRICING.trialFeeAmount
  const serviceFee = roundGmd(monthlyTotal * PRICING.familyServiceFeeRate)
  const grandTotal = monthlyTotal + serviceFee
  return { monthlyTotal, serviceFee, grandTotal }
}

export interface LessonEarningInput {
  hourlyRate: number
  lessonHours: number
}

export interface LessonEarning {
  gross: number
  commission: number
  net: number
}

/** What a tutor earns from one completed lesson, after 5% commission. */
export function computeLessonEarning({ hourlyRate, lessonHours }: LessonEarningInput): LessonEarning {
  const gross = lessonHours * hourlyRate
  const commission = roundGmd(gross * PRICING.tutorCommissionRate)
  const net = gross - commission
  return { gross, commission, net }
}

/** Number of lessons a monthly booking generates, based on lesson length. */
export function lessonsForBooking(
  hoursPerMonth: number,
  lessonMinutes: number = PRICING.defaultLessonMinutes
): number {
  const hoursPerLesson = lessonMinutes / 60
  if (hoursPerLesson <= 0) return 0
  return Math.floor(hoursPerMonth / hoursPerLesson)
}

/** Number of visits represented by a four-week monthly package. */
export function lessonsForPackage(frequencyPerWeek: number): number {
  if (!Number.isFinite(frequencyPerWeek) || frequencyPerWeek <= 0) return 0
  return Math.max(1, Math.round(frequencyPerWeek * 4))
}

/** Convert a lesson's duration to whole billable hours (minimum 1). */
export function lessonHoursFromMinutes(durationMinutes: number | null | undefined): number {
  return Math.max(1, Math.round((durationMinutes ?? PRICING.defaultLessonMinutes) / 60))
}

function allocateWholeAmount(total: number, itemCount: number, itemNumber: number) {
  if (itemCount <= 0 || itemNumber <= 0 || itemNumber > itemCount) return 0
  const normalizedTotal = roundGmd(total)
  const baseAmount = Math.floor(normalizedTotal / itemCount)
  const remainder = normalizedTotal - baseAmount * itemCount
  return baseAmount + (itemNumber <= remainder ? 1 : 0)
}

/**
 * Allocate a paid monthly lesson total across its generated lessons. Across the
 * full booking, the allocations always add back to the exact 5% commission and
 * 95% tutor share, including package and sibling pricing.
 */
export function allocateMonthlyLessonEarning(params: {
  monthlyTotal: number
  lessonsCount: number
  lessonNumber: number
}): LessonEarning {
  const commissionTotal = roundGmd(params.monthlyTotal * PRICING.tutorCommissionRate)
  const netTotal = roundGmd(params.monthlyTotal) - commissionTotal

  return {
    gross: allocateWholeAmount(params.monthlyTotal, params.lessonsCount, params.lessonNumber),
    commission: allocateWholeAmount(commissionTotal, params.lessonsCount, params.lessonNumber),
    net: allocateWholeAmount(netTotal, params.lessonsCount, params.lessonNumber),
  }
}
