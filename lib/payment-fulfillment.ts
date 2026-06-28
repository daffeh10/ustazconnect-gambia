import { createAdminClient } from '@/lib/supabase/admin'

export interface PaymentBookingRow {
  id: string
  family_id: string | null
  tutor_id: string
  subjects: string[] | null
  hours_per_month: number
  status: string | null
}

export async function ensureLessonsForBooking(
  supabase: ReturnType<typeof createAdminClient>,
  booking: PaymentBookingRow
) {
  const totalLessons = Math.floor(booking.hours_per_month / 2)

  if (totalLessons <= 0) return

  const lessonRows = Array.from({ length: totalLessons }, (_, index) => ({
    booking_id: booking.id,
    tutor_id: booking.tutor_id,
    family_id: booking.family_id,
    lesson_number: index + 1,
    subject: booking.subjects?.[0] || null,
    status: 'scheduled',
  }))

  const { error: lessonUpsertError } = await supabase
    .from('lessons')
    .upsert(lessonRows, {
      onConflict: 'booking_id,lesson_number',
      ignoreDuplicates: true,
    })

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
  if (booking.status !== 'active') {
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', booking.id)

    if (bookingUpdateError) throw bookingUpdateError
  }

  await ensureLessonsForBooking(supabase, booking)
}
