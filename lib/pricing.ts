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
}

export interface BookingCharge {
  monthlyTotal: number
  serviceFee: number
  grandTotal: number
}

/** What a family pays for a monthly booking: lesson cost + 3% service fee. */
export function computeBookingCharge({ hourlyRate, hoursPerMonth }: BookingChargeInput): BookingCharge {
  const monthlyTotal = hoursPerMonth * hourlyRate
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

/** Convert a lesson's duration to whole billable hours (minimum 1). */
export function lessonHoursFromMinutes(durationMinutes: number | null | undefined): number {
  return Math.max(1, Math.round((durationMinutes ?? PRICING.defaultLessonMinutes) / 60))
}
