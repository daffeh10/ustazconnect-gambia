// Authoritative payout calculation, shared by the server route (which creates the
// payout) and the tutor dashboard (which shows the estimate). Pure + isomorphic,
// so the two never drift. The SERVER is the authority — see app/api/payouts/request.
//
// A tutor is paid the net (after 5% commission) of their completed lessons that
// belong to active bookings and have not already been reserved by an existing
// pending/completed payout.

import { computeLessonEarning, lessonHoursFromMinutes } from '@/lib/pricing'

export interface PayoutLessonInput {
  booking_id: string
  duration_minutes: number | null
  status: string | null
  completed_at: string | null
  created_at: string
}

export interface PayoutBookingInfo {
  status: string | null
  hourly_rate: number | null
}

export interface PayoutReservationInput {
  status: string | null
  lessons_count: number | null
}

export interface PayableSummary {
  lessonsCount: number
  amount: number
  commissionDeducted: number
  periodStart: string | null
  periodEnd: string | null
}

/**
 * Regular payouts settle monthly: a lesson is payable only once its calendar
 * month has fully ended. (Trial sessions are paid on a separate 48h fast-track
 * and never flow through this calculator.)
 */
function isInEndedMonth(dateString: string, now: Date): boolean {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return false
  return (
    date.getFullYear() < now.getFullYear() ||
    (date.getFullYear() === now.getFullYear() && date.getMonth() < now.getMonth())
  )
}

export function computePayableSummary(params: {
  lessons: PayoutLessonInput[]
  bookingsById: Record<string, PayoutBookingInfo>
  existingPayouts: PayoutReservationInput[]
  now?: Date
}): PayableSummary {
  const { lessons, bookingsById, existingPayouts, now = new Date() } = params

  const completed = lessons
    .filter((lesson) => lesson.status === 'completed')
    .map((lesson) => {
      const booking = bookingsById[lesson.booking_id]
      if (!booking || booking.status !== 'active') return null

      const lessonHours = lessonHoursFromMinutes(lesson.duration_minutes)
      const { commission, net } = computeLessonEarning({
        hourlyRate: booking.hourly_rate ?? 0,
        lessonHours,
      })

      return {
        commission,
        net,
        completed_at: lesson.completed_at,
        completedAtSortable: lesson.completed_at || lesson.created_at,
      }
    })
    .filter((lesson): lesson is NonNullable<typeof lesson> => lesson !== null)
    // Only lessons from months that have already ended are payable.
    .filter((lesson) => isInEndedMonth(lesson.completedAtSortable, now))
    .sort(
      (a, b) => new Date(a.completedAtSortable).getTime() - new Date(b.completedAtSortable).getTime()
    )

  // Lessons already claimed by a pending or completed payout are not payable again.
  const reservedLessonCount = existingPayouts.reduce((sum, payout) => {
    if (payout.status === 'pending' || payout.status === 'completed') {
      return sum + (payout.lessons_count || 0)
    }
    return sum
  }, 0)

  const payable = completed.slice(Math.min(reservedLessonCount, completed.length))

  return {
    lessonsCount: payable.length,
    amount: payable.reduce((sum, lesson) => sum + lesson.net, 0),
    commissionDeducted: payable.reduce((sum, lesson) => sum + lesson.commission, 0),
    periodStart: payable[0]?.completed_at?.slice(0, 10) || null,
    periodEnd: payable[payable.length - 1]?.completed_at?.slice(0, 10) || null,
  }
}
