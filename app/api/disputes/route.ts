import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

interface BookingOwnershipRow {
  id: string
  family_id: string | null
  tutor_id: string
}

interface LessonOwnershipRow {
  id: string
  booking_id: string
  family_id: string | null
  tutor_id: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = getString(body?.bookingId)
    const lessonId = getString(body?.lessonId)
    const reason = getString(body?.reason)

    if (!reason || (!bookingId && !lessonId)) {
      return NextResponse.json({ error: 'Please explain the issue.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()

    if (tutorError) throw tutorError

    if (bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id,family_id,tutor_id')
        .eq('id', bookingId)
        .maybeSingle<BookingOwnershipRow>()

      if (bookingError) throw bookingError
      if (!booking || (booking.family_id !== user.id && booking.tutor_id !== tutor?.id)) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
      }
    }

    if (lessonId) {
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('id,booking_id,family_id,tutor_id')
        .eq('id', lessonId)
        .maybeSingle<LessonOwnershipRow>()

      if (lessonError) throw lessonError
      if (!lesson || (lesson.family_id !== user.id && lesson.tutor_id !== tutor?.id)) {
        return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
      }
      if (bookingId && lesson.booking_id !== bookingId) {
        return NextResponse.json({ error: 'Lesson does not belong to this booking.' }, { status: 400 })
      }
    }

    const { error } = await supabase.from('disputes').insert({
      booking_id: bookingId || null,
      lesson_id: lessonId || null,
      reporter_user_id: user.id,
      reason,
      status: 'open',
    })

    if (error) throw error

    await sendEmail({
      to: 'tutorconnectgambia@gmail.com',
      subject: 'New dispute/refund request',
      text: composeEmail([
        'A user submitted a dispute or refund request.',
        '',
        `User ID: ${user.id}`,
        bookingId ? `Booking ID: ${bookingId}` : 'Booking ID: not provided',
        lessonId ? `Lesson ID: ${lessonId}` : 'Lesson ID: not provided',
        `Reason: ${reason}`,
      ]),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('dispute submit failed', error)
    return NextResponse.json({ error: 'Could not submit dispute. Make sure the remaining roadmap SQL has been applied.' }, { status: 500 })
  }
}
