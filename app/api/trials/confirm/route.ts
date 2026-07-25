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
      .select('id,family_id,tutor_id,booking_type,status')
      .eq('id', bookingId)
      .eq('family_id', user.id)
      .maybeSingle<{ id: string; family_id: string; tutor_id: string; booking_type: string | null; status: string | null }>()

    if (bookingError) throw bookingError
    if (!booking || booking.booking_type !== 'trial') {
      return NextResponse.json({ error: 'Trial booking not found.' }, { status: 404 })
    }

    const confirmedAt = new Date().toISOString()
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({ trial_confirmed_at: confirmedAt, updated_at: confirmedAt })
      .eq('id', booking.id)

    if (bookingUpdateError) throw bookingUpdateError

    const { error: lessonUpdateError } = await supabase
      .from('lessons')
      .update({ family_confirmed_at: confirmedAt, payout_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() })
      .eq('booking_id', booking.id)

    if (lessonUpdateError) throw lessonUpdateError

    const { data: tutor } = await supabase
      .from('tutor_profiles')
      .select('email,name')
      .eq('id', booking.tutor_id)
      .maybeSingle<{ email: string | null; name: string | null }>()

    if (tutor?.email) {
      await sendEmail({
        to: tutor.email,
        subject: 'Trial session confirmed',
        text: composeEmail([
          `Hi ${tutor.name || 'Tutor'},`,
          '',
          'The family confirmed the trial session. The GMD 150 trial payout is now ready for fast-track processing.',
        ]),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('trial confirm failed', error)
    return NextResponse.json({ error: 'Could not confirm this trial.' }, { status: 500 })
  }
}
