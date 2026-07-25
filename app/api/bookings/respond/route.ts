import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface BookingRow {
  id: string
  tutor_id: string
  family_id: string | null
  family_name: string
  subjects: string[] | null
  status: string | null
  booking_type?: string | null
}

interface TutorRow {
  id: string
  user_id: string
  name: string | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = getString(body?.bookingId)
    const action = getString(body?.action).toLowerCase()
    const reason = getString(body?.reason)

    if (!bookingId || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid booking response.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    }
    if (userError) throw userError

    const supabase = createAdminClient()
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('id,user_id,name')
      .eq('user_id', user.id)
      .maybeSingle<TutorRow>()

    if (tutorError) throw tutorError
    if (!tutor) {
      return NextResponse.json({ error: 'Tutor profile not found.' }, { status: 403 })
    }

    let { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,tutor_id,family_id,family_name,subjects,status,booking_type')
      .eq('id', bookingId)
      .eq('tutor_id', tutor.id)
      .maybeSingle<BookingRow>()

    if (
      bookingError &&
      (bookingError.message.toLowerCase().includes('booking_type') || bookingError.message.toLowerCase().includes('column'))
    ) {
      const fallback = await supabase
        .from('bookings')
        .select('id,tutor_id,family_id,family_name,subjects,status')
        .eq('id', bookingId)
        .eq('tutor_id', tutor.id)
        .maybeSingle<BookingRow>()
      booking = fallback.data
      bookingError = fallback.error
    }

    if (bookingError) throw bookingError
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }
    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'This booking has already been handled.' }, { status: 400 })
    }

    const nextStatus = action === 'accept' ? 'confirmed' : 'cancelled'
    const updatePayload = action === 'accept'
      ? { status: nextStatus, updated_at: new Date().toISOString() }
      : {
          status: nextStatus,
          special_requests: reason ? `Decline reason: ${reason}` : null,
          updated_at: new Date().toISOString(),
        }

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking.id)

    if (updateError) throw updateError

    if (booking.family_id) {
      const { data: family } = await supabase.auth.admin.getUserById(booking.family_id)
      const familyEmail = family.user?.email
      if (familyEmail) {
        const accepted = action === 'accept'
        await sendEmail({
          to: familyEmail,
          subject: accepted ? 'Your tutor accepted your booking' : 'Your tutor declined your booking',
          text: composeEmail([
            `Hi ${booking.family_name || 'there'},`,
            '',
            accepted
              ? `${tutor.name || 'Your tutor'} accepted your ${booking.booking_type === 'trial' ? 'trial' : 'monthly'} booking request. You can now complete payment from your family dashboard.`
              : `${tutor.name || 'The tutor'} declined your booking request.${reason ? ` Reason: ${reason}` : ''}`,
          ]),
        })
      }
    }

    return NextResponse.json({ ok: true, status: nextStatus })
  } catch (error) {
    console.error('booking respond failed', error)
    return NextResponse.json({ error: 'Could not update this booking.' }, { status: 500 })
  }
}
