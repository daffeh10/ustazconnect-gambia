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
      .select('id,family_id,tutor_id,booking_type')
      .eq('id', bookingId)
      .eq('family_id', user.id)
      .maybeSingle<{ id: string; family_id: string; tutor_id: string; booking_type: string | null }>()

    if (bookingError) throw bookingError
    if (!booking || booking.booking_type !== 'trial') {
      return NextResponse.json({ error: 'Trial booking not found.' }, { status: 404 })
    }

    const reportedAt = new Date().toISOString()
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({
        no_show_reported_at: reportedAt,
        refund_status: 'requested',
        updated_at: reportedAt,
      })
      .eq('id', booking.id)

    if (bookingUpdateError) throw bookingUpdateError

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
        'Review Waychit payment details and process the refund manually if valid.',
      ]),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('trial no-show failed', error)
    return NextResponse.json({ error: 'Could not report this trial no-show.' }, { status: 500 })
  }
}
