import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = getString(body?.bookingId)

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing trial booking.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    if (userError) throw userError

    const supabase = createAdminClient()
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,family_id,tutor_id,booking_type,status,trial_confirmed_at,no_show_reported_at')
      .eq('id', bookingId)
      .eq('family_id', user.id)
      .maybeSingle<{
        id: string
        family_id: string
        tutor_id: string
        booking_type: string | null
        status: string | null
        trial_confirmed_at: string | null
        no_show_reported_at: string | null
      }>()

    if (bookingError) throw bookingError
    if (!booking || booking.booking_type !== 'trial') {
      return NextResponse.json({ error: 'Trial booking not found.' }, { status: 404 })
    }
    if (booking.status !== 'active') {
      return NextResponse.json({ error: 'Only paid, active trials can report a no-show.' }, { status: 400 })
    }
    if (booking.trial_confirmed_at) {
      return NextResponse.json({ error: 'A confirmed trial cannot be reported as a no-show.' }, { status: 409 })
    }
    if (booking.no_show_reported_at) {
      return NextResponse.json({ ok: true, refundStatus: 'requested' })
    }

    const { data: completedPayment, error: paymentError } = await supabase
      .from('payments')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('family_id', user.id)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (paymentError) throw paymentError
    if (!completedPayment) {
      return NextResponse.json({ error: 'No completed trial payment was found.' }, { status: 400 })
    }

    const reportedAt = new Date().toISOString()
    const { data: updatedBooking, error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({
        no_show_reported_at: reportedAt,
        refund_status: 'requested',
        status: 'cancelled',
        updated_at: reportedAt,
      })
      .eq('id', booking.id)
      .is('trial_confirmed_at', null)
      .is('no_show_reported_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (bookingUpdateError) throw bookingUpdateError
    if (!updatedBooking) {
      return NextResponse.json({ error: 'This trial was updated elsewhere.' }, { status: 409 })
    }

    const { error: lessonUpdateError } = await supabase
      .from('lessons')
      .update({ no_show_reported_at: reportedAt })
      .eq('booking_id', booking.id)

    if (lessonUpdateError) throw lessonUpdateError

    await sendEmail({
      to: 'tutorconnectgambia@gmail.com',
      subject: 'Trial no-show refund requested',
      text: composeEmail([
        'A family reported a tutor no-show for a trial session.',
        '',
        `Booking ID: ${booking.id}`,
        'Waychit does not currently publish a merchant refund endpoint. Review the payment and process the refund in the merchant dashboard.',
      ]),
    })

    return NextResponse.json({ ok: true, refundStatus: 'requested' })
  } catch (error) {
    console.error('trial no-show failed', error)
    return NextResponse.json({ error: 'Could not report this trial no-show.' }, { status: 500 })
  }
}
