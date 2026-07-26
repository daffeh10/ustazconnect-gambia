import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface LessonRow {
  id: string
  booking_id: string
  tutor_id: string
  status: string | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeMeetingLink(value: string) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const lessonId = getString(body?.lessonId)
    const scheduledAtInput = getString(body?.scheduledAt)
    const meetingLinkInput = getString(body?.meetingLink)

    if (!lessonId || !scheduledAtInput) {
      return NextResponse.json({ error: 'Lesson date and time are required.' }, { status: 400 })
    }

    const scheduledAt = new Date(scheduledAtInput)
    const latestAllowed = Date.now() + 366 * 24 * 60 * 60 * 1000
    if (
      Number.isNaN(scheduledAt.getTime()) ||
      scheduledAt.getTime() <= Date.now() ||
      scheduledAt.getTime() > latestAllowed
    ) {
      return NextResponse.json({ error: 'Choose a valid future lesson time.' }, { status: 400 })
    }

    const meetingLink = normalizeMeetingLink(meetingLinkInput)
    if (meetingLinkInput && !meetingLink) {
      return NextResponse.json({ error: 'Meeting links must be valid HTTPS links.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    if (userError) throw userError

    const supabase = createAdminClient()
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()

    if (tutorError) throw tutorError
    if (!tutor) return NextResponse.json({ error: 'Tutor profile not found.' }, { status: 403 })

    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id,booking_id,tutor_id,status')
      .eq('id', lessonId)
      .eq('tutor_id', tutor.id)
      .maybeSingle<LessonRow>()

    if (lessonError) throw lessonError
    if (!lesson) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
    if (lesson.status !== 'scheduled') {
      return NextResponse.json({ error: 'Completed lessons cannot be rescheduled.' }, { status: 409 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', lesson.booking_id)
      .eq('status', 'active')
      .maybeSingle<{ id: string }>()

    if (bookingError) throw bookingError
    if (!booking) {
      return NextResponse.json({ error: 'Only active booking lessons can be scheduled.' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('lessons')
      .update({
        scheduled_at: scheduledAt.toISOString(),
        meeting_link: meetingLink,
        reminder_sent_at: null,
      })
      .eq('id', lesson.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle<{ id: string }>()

    if (updateError) throw updateError
    if (!updated) {
      return NextResponse.json({ error: 'This lesson was updated elsewhere.' }, { status: 409 })
    }

    return NextResponse.json({
      ok: true,
      scheduledAt: scheduledAt.toISOString(),
      meetingLink,
    })
  } catch (error) {
    console.error('lesson scheduling failed', error)
    return NextResponse.json({ error: 'Could not schedule this lesson.' }, { status: 500 })
  }
}
