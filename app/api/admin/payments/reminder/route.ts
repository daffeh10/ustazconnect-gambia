import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminRole } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { PAYMENT_REMINDER_SELECT, sendPaymentReminderEmail, type PaymentReminderBooking } from '@/lib/payment-reminders'
import { createAdminClient } from '@/lib/supabase/admin'

// Stops a double click, or two admins at once, from emailing the family twice.
const MIN_MINUTES_BETWEEN_REMINDERS = 60

type ReminderBookingRow = PaymentReminderBooking & { status: string | null; payment_reminder_sent_at: string | null }

export async function POST(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin || !hasAdminRole(admin, ['owner', 'admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body: { bookingId?: unknown } = await request.json()
    if (typeof body.bookingId !== 'string') return NextResponse.json({ error: 'Missing booking reference.' }, { status: 400 })

    const db = createAdminClient()
    const [bookingResult, paidResult] = await Promise.all([
      db.from('bookings').select(`${PAYMENT_REMINDER_SELECT},status,payment_reminder_sent_at`)
        .eq('id', body.bookingId).maybeSingle<ReminderBookingRow>(),
      db.from('payments').select('id').eq('booking_id', body.bookingId).eq('status', 'completed').limit(1),
    ])
    if (bookingResult.error) throw bookingResult.error
    if (paidResult.error) throw paidResult.error
    const booking = bookingResult.data
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    if (booking.status !== 'confirmed' || (paidResult.data || []).length > 0) {
      return NextResponse.json({ error: 'Reminders are only for accepted bookings with no payment received.' }, { status: 409 })
    }

    const lastSent = booking.payment_reminder_sent_at ? new Date(booking.payment_reminder_sent_at).getTime() : 0
    if (Date.now() - lastSent < MIN_MINUTES_BETWEEN_REMINDERS * 60 * 1000) {
      return NextResponse.json({ error: `A reminder was sent less than ${MIN_MINUTES_BETWEEN_REMINDERS} minutes ago.` }, { status: 429 })
    }

    const result = await sendPaymentReminderEmail(db, booking)
    if (!result.sent) {
      return NextResponse.json({
        error: result.skipped ? 'Email is not configured on the server (RESEND_API_KEY missing), so nothing was sent.' : result.error || 'The email could not be sent.',
      }, { status: 502 })
    }

    // The email has already gone out, so bookkeeping failures below must not
    // be reported to the admin as "not sent".
    const sentAt = new Date().toISOString()
    const message = `Payment reminder emailed to ${booking.family_name || 'the family'}.`
    try {
      const { error: updateError } = await db.from('bookings').update({ payment_reminder_sent_at: sentAt }).eq('id', booking.id)
      if (updateError) throw updateError
      await writeAdminAuditLog({ admin, action: 'booking.payment_reminder_sent', targetType: 'booking', targetId: booking.id })
    } catch (recordError) {
      console.error('Payment reminder sent but not recorded', recordError)
      return NextResponse.json({ sentAt, message: `${message} The send time could not be saved, so do not resend yet.` })
    }
    return NextResponse.json({ sentAt, message })
  } catch (error) {
    console.error('Admin payment reminder failed', error)
    return NextResponse.json({ error: 'Could not send the payment reminder.' }, { status: 500 })
  }
}
