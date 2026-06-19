import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface PaymentRow {
  id: string
  booking_id: string | null
  family_id: string | null
  status: string | null
  provider_payment_id: string | null
  wave_reference: string | null
}

interface BookingRow {
  id: string
  family_id: string | null
  tutor_id: string
  subjects: string[] | null
  hours_per_month: number
  status: string | null
}

async function ensureLessonsForBooking(supabase: ReturnType<typeof createAdminClient>, booking: BookingRow) {
  const { count, error: lessonsCountError } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', booking.id)

  if (lessonsCountError) throw lessonsCountError
  if (count) return

  const totalLessons = Math.floor(booking.hours_per_month / 2)
  const lessonRows = Array.from({ length: totalLessons }, (_, index) => ({
    booking_id: booking.id,
    tutor_id: booking.tutor_id,
    family_id: booking.family_id,
    lesson_number: index + 1,
    subject: booking.subjects?.[0] || null,
    status: 'scheduled',
  }))

  if (lessonRows.length === 0) return

  const { error: lessonInsertError } = await supabase.from('lessons').insert(lessonRows)
  if (lessonInsertError) throw lessonInsertError
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : ''
    const familyId = typeof body?.familyId === 'string' ? body.familyId.trim() : ''

    if (!bookingId || !familyId) {
      return NextResponse.json({ error: 'Missing booking confirmation details.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: completedPayment, error: completedPaymentError } = await supabase
      .from('payments')
      .select('id,booking_id,family_id,status,provider_payment_id,wave_reference')
      .eq('booking_id', bookingId)
      .eq('family_id', familyId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PaymentRow>()

    if (completedPaymentError) throw completedPaymentError

    if (completedPayment) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id,family_id,tutor_id,subjects,hours_per_month,status')
        .eq('id', bookingId)
        .eq('family_id', familyId)
        .maybeSingle<BookingRow>()

      if (bookingError) throw bookingError
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
      }

      if (booking.status !== 'active') {
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ status: 'active' })
          .eq('id', booking.id)

        if (bookingUpdateError) throw bookingUpdateError
      }

      await ensureLessonsForBooking(supabase, booking)

      return NextResponse.json({ status: 'completed' })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id,booking_id,family_id,status,provider_payment_id,wave_reference')
      .eq('booking_id', bookingId)
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PaymentRow>()

    if (paymentError) throw paymentError
    if (!payment?.provider_payment_id) {
      return NextResponse.json({ status: 'missing_payment' })
    }

    if (payment.status === 'completed') {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id,family_id,tutor_id,subjects,hours_per_month,status')
        .eq('id', bookingId)
        .eq('family_id', familyId)
        .maybeSingle<BookingRow>()

      if (bookingError) throw bookingError
      if (!booking) {
        return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 })
      }

      if (booking.status !== 'active') {
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', booking.id)

        if (bookingUpdateError) throw bookingUpdateError
      }

      await ensureLessonsForBooking(supabase, booking)
      return NextResponse.json({ status: 'completed' })
    }

    if (payment.status === 'failed' || payment.status === 'cancelled') {
      return NextResponse.json({ status: payment.status })
    }

    return NextResponse.json({ status: 'pending' })
  } catch (error) {
    console.error('payment confirm route failed', error)
    return NextResponse.json({ error: 'Could not confirm payment status.' }, { status: 500 })
  }
}
