import { createAdminClient } from '@/lib/supabase/admin'
import { composeEmail, sendEmail } from '@/lib/email'
import { lessonsForBooking, lessonsForPackage, PRICING } from '@/lib/pricing'

export interface PaymentBookingRow {
  id: string
  family_id: string | null
  tutor_id: string
  subjects: string[] | null
  hours_per_month: number
  status: string | null
  booking_type?: string | null
  pricing_model?: string | null
  frequency_per_week?: number | null
  hours_per_visit?: number | null
  lesson_format?: string | null
  timezone?: string | null
}

export async function ensureLessonsForBooking(
  supabase: ReturnType<typeof createAdminClient>,
  booking: PaymentBookingRow
) {
  const totalLessons =
    booking.booking_type === 'trial'
      ? 1
      : booking.pricing_model === 'package'
        ? lessonsForPackage(booking.frequency_per_week ?? 0)
        : lessonsForBooking(booking.hours_per_month)

  if (totalLessons <= 0) return

  const durationMinutes =
    booking.booking_type === 'trial'
      ? 45
      : booking.pricing_model === 'package' && booking.hours_per_visit
        ? Math.max(30, Math.round(booking.hours_per_visit * 60))
        : PRICING.defaultLessonMinutes

  const lessonRows = Array.from({ length: totalLessons }, (_, index) => ({
    booking_id: booking.id,
    tutor_id: booking.tutor_id,
    family_id: booking.family_id,
    lesson_number: index + 1,
    duration_minutes: durationMinutes,
    subject: booking.subjects?.[0] || null,
    status: 'scheduled',
    booking_type: booking.booking_type || 'monthly',
    lesson_format: booking.lesson_format || 'in_person',
    timezone: booking.timezone || null,
  }))

  let { error: lessonUpsertError } = await supabase
    .from('lessons')
    .upsert(lessonRows, {
      onConflict: 'booking_id,lesson_number',
      ignoreDuplicates: true,
    })

  if (
    lessonUpsertError &&
    (
      lessonUpsertError.message.toLowerCase().includes('booking_type') ||
      lessonUpsertError.message.toLowerCase().includes('lesson_format') ||
      lessonUpsertError.message.toLowerCase().includes('timezone') ||
      lessonUpsertError.message.toLowerCase().includes('column')
    )
  ) {
    const legacyLessonRows = lessonRows.map((lesson) => ({
      booking_id: lesson.booking_id,
      tutor_id: lesson.tutor_id,
      family_id: lesson.family_id,
      lesson_number: lesson.lesson_number,
      duration_minutes: lesson.duration_minutes,
      subject: lesson.subject,
      status: lesson.status,
    }))

    const legacyResult = await supabase
      .from('lessons')
      .upsert(legacyLessonRows, {
        onConflict: 'booking_id,lesson_number',
        ignoreDuplicates: true,
      })

    lessonUpsertError = legacyResult.error
  }

  if (!lessonUpsertError) return
  if (lessonUpsertError.code !== '42P10') throw lessonUpsertError

  console.error(
    'Missing lessons_booking_lesson_number_key unique index. Falling back to non-concurrent lesson insert.'
  )

  const { data: existingLessons, error: existingLessonsError } = await supabase
    .from('lessons')
    .select('lesson_number')
    .eq('booking_id', booking.id)

  if (existingLessonsError) throw existingLessonsError

  const existingLessonNumbers = new Set(
    (existingLessons ?? [])
      .map((lesson) => lesson.lesson_number)
      .filter((lessonNumber): lessonNumber is number => typeof lessonNumber === 'number')
  )
  const missingLessonRows = lessonRows.filter((lesson) => !existingLessonNumbers.has(lesson.lesson_number))

  if (missingLessonRows.length === 0) return

  const { error: lessonInsertError } = await supabase.from('lessons').insert(missingLessonRows)

  if (lessonInsertError?.code === '23505') return
  if (lessonInsertError) throw lessonInsertError
}

export async function activateBookingAndEnsureLessons(
  supabase: ReturnType<typeof createAdminClient>,
  booking: PaymentBookingRow
) {
  const wasAlreadyActive = booking.status === 'active'

  if (booking.status !== 'active') {
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', booking.id)

    if (bookingUpdateError) throw bookingUpdateError
  }

  await ensureLessonsForBooking(supabase, booking)

  if (wasAlreadyActive) return

  const [{ data: tutor }, familyResult] = await Promise.all([
    supabase
      .from('tutor_profiles')
      .select('name,email')
      .eq('id', booking.tutor_id)
      .maybeSingle<{ name: string | null; email: string | null }>(),
    booking.family_id ? supabase.auth.admin.getUserById(booking.family_id) : Promise.resolve({ data: { user: null }, error: null }),
  ])

  if (tutor?.email) {
    await sendEmail({
      to: tutor.email,
      subject: 'Booking payment completed',
      text: composeEmail([
        `Hi ${tutor.name || 'Tutor'},`,
        '',
        `A ${booking.booking_type === 'trial' ? 'trial' : 'monthly'} booking has been paid and activated. Check your dashboard for the lesson plan.`,
      ]),
    })
  }

  const familyEmail = familyResult.data.user?.email
  if (familyEmail) {
    await sendEmail({
      to: familyEmail,
      subject: 'Your TutorConnect booking is active',
      text: composeEmail([
        'Hi,',
        '',
        `Your ${booking.booking_type === 'trial' ? 'trial' : 'monthly'} booking is paid and active. You can track lessons from your family dashboard.`,
      ]),
    })
  }
}
