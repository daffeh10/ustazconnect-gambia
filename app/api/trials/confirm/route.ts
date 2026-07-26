import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { queueTrialPayout } from '@/lib/trials'

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
      return NextResponse.json({ error: 'Only paid, active trials can be confirmed.' }, { status: 400 })
    }
    if (booking.no_show_reported_at) {
      return NextResponse.json({ error: 'This trial already has a no-show report.' }, { status: 409 })
    }

    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id,status,completed_at,no_show_reported_at')
      .eq('booking_id', booking.id)
      .limit(1)
      .maybeSingle<{
        id: string
        status: string | null
        completed_at: string | null
        no_show_reported_at: string | null
      }>()

    if (lessonError) throw lessonError
    if (!lesson || lesson.status !== 'completed' || !lesson.completed_at) {
      return NextResponse.json(
        { error: 'The tutor must mark the trial lesson complete before confirmation.' },
        { status: 400 }
      )
    }
    if (lesson.no_show_reported_at) {
      return NextResponse.json({ error: 'This trial already has a no-show report.' }, { status: 409 })
    }

    const confirmedAt = booking.trial_confirmed_at || new Date().toISOString()
    if (!booking.trial_confirmed_at) {
      const { data: updatedBooking, error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({ trial_confirmed_at: confirmedAt, updated_at: confirmedAt })
        .eq('id', booking.id)
        .is('trial_confirmed_at', null)
        .is('no_show_reported_at', null)
        .select('id')
        .maybeSingle<{ id: string }>()

      if (bookingUpdateError) throw bookingUpdateError
      if (!updatedBooking) {
        return NextResponse.json({ error: 'This trial was updated elsewhere.' }, { status: 409 })
      }
    }

    const { error: lessonUpdateError } = await supabase
      .from('lessons')
      .update({ family_confirmed_at: confirmedAt, payout_due_at: confirmedAt })
      .eq('booking_id', booking.id)

    if (lessonUpdateError) throw lessonUpdateError

    const payoutCreated = await queueTrialPayout({
      supabase,
      bookingId: booking.id,
      tutorId: booking.tutor_id,
      confirmedAt,
    })

    const { data: tutor } = await supabase
      .from('tutor_profiles')
      .select('email,name')
      .eq('id', booking.tutor_id)
      .maybeSingle<{ email: string | null; name: string | null }>()

    if (tutor?.email && payoutCreated) {
      await sendEmail({
        to: tutor.email,
        subject: 'Trial session confirmed',
        text: composeEmail([
          `Hi ${tutor.name || 'Tutor'},`,
          '',
          'The family confirmed the trial session. Your GMD 150 trial payout is now queued for fast-track processing.',
        ]),
      })
    }

    return NextResponse.json({ ok: true, payoutQueued: true })
  } catch (error) {
    console.error('trial confirm failed', error)
    return NextResponse.json({ error: 'Could not confirm this trial.' }, { status: 500 })
  }
}
