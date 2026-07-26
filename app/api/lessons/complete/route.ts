import { NextResponse } from 'next/server'
import { PRICING } from '@/lib/pricing'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface LessonRow {
  id: string
  booking_id: string
  tutor_id: string
  status: string | null
}

interface BookingRow {
  id: string
  status: string | null
  booking_type: string | null
  pricing_model: string | null
  hours_per_visit: number | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const lessonId = getString(body?.lessonId)
    const notes = getString(body?.notes)

    if (!lessonId) {
      return NextResponse.json({ error: 'Missing lesson.' }, { status: 400 })
    }
    if (notes.length > 2000) {
      return NextResponse.json({ error: 'Lesson notes are too long.' }, { status: 400 })
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
      return NextResponse.json({ error: 'This lesson has already been completed.' }, { status: 409 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,booking_type,pricing_model,hours_per_visit')
      .eq('id', lesson.booking_id)
      .eq('tutor_id', tutor.id)
      .maybeSingle<BookingRow>()

    if (bookingError) throw bookingError
    if (!booking || booking.status !== 'active') {
      return NextResponse.json({ error: 'Only active booking lessons can be completed.' }, { status: 400 })
    }

    const durationMinutes =
      booking.booking_type === 'trial'
        ? 45
        : booking.pricing_model === 'package' && booking.hours_per_visit
          ? Math.max(30, Math.round(booking.hours_per_visit * 60))
          : PRICING.defaultLessonMinutes
    const completedAt = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('lessons')
      .update({
        status: 'completed',
        duration_minutes: durationMinutes,
        tutor_notes: notes || null,
        completed_at: completedAt,
      })
      .eq('id', lesson.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle<{ id: string }>()

    if (updateError) throw updateError
    if (!updated) {
      return NextResponse.json({ error: 'This lesson was updated elsewhere.' }, { status: 409 })
    }

    return NextResponse.json({ ok: true, completedAt, durationMinutes })
  } catch (error) {
    console.error('lesson completion failed', error)
    return NextResponse.json({ error: 'Could not complete this lesson.' }, { status: 500 })
  }
}
