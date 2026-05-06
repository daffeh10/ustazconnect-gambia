import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getModemPayClient } from '@/lib/payments'

interface ModemPayEventPayload {
  payment_intent_id?: string
  transaction_reference?: string
  metadata?: {
    booking_id?: string
    family_id?: string
    tutor_id?: string
  }
}

interface PaymentRow {
  id: string
  booking_id: string | null
  family_id: string | null
  status: string | null
  provider_payment_id: string | null
}

interface BookingRow {
  id: string
  family_id: string | null
  tutor_id: string
  subjects: string[] | null
  hours_per_month: number
  status: string | null
}

function normalizeEventPayload(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {} as ModemPayEventPayload
  }

  return value as ModemPayEventPayload
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
  const modemSecret = process.env.MODEMPAY_WEBHOOK_SECRET?.trim() || ''

  if (!modemSecret) {
    console.error('Missing MODEMPAY_WEBHOOK_SECRET.')
    return NextResponse.json({ received: true })
  }

  const signature = request.headers.get('x-modem-signature') || ''
  const rawBody = await request.text()

  try {
    const modemPay = getModemPayClient()
    const event = modemPay.webhooks.composeEventDetails(rawBody, signature, modemSecret)
    const payload = normalizeEventPayload(event.payload)
    const supabase = createAdminClient()

    const providerPaymentId = payload.payment_intent_id?.trim() || ''
    const metadataBookingId = payload.metadata?.booking_id?.trim() || ''
    const metadataFamilyId = payload.metadata?.family_id?.trim() || ''

    let paymentQuery = supabase
      .from('payments')
      .select('id,booking_id,family_id,status,provider_payment_id')
      .order('created_at', { ascending: false })
      .limit(1)

    if (providerPaymentId) {
      paymentQuery = paymentQuery.eq('provider_payment_id', providerPaymentId)
    } else if (metadataBookingId) {
      paymentQuery = paymentQuery.eq('booking_id', metadataBookingId)
      if (metadataFamilyId) {
        paymentQuery = paymentQuery.eq('family_id', metadataFamilyId)
      }
    } else {
      console.error('Webhook missing both payment_intent_id and booking metadata.')
      return NextResponse.json({ received: true })
    }

    const { data: payment, error: paymentError } = await paymentQuery.maybeSingle<PaymentRow>()

    if (paymentError) throw paymentError
    if (!payment?.booking_id) {
      console.error('No matching payment row found for webhook event.')
      return NextResponse.json({ received: true })
    }

    if (event.event === 'charge.succeeded') {
      if (payment.status !== 'completed') {
        const { error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            wave_reference: payload.transaction_reference || providerPaymentId || null,
            paid_at: new Date().toISOString(),
          })
          .eq('id', payment.id)

        if (paymentUpdateError) throw paymentUpdateError
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id,family_id,tutor_id,subjects,hours_per_month,status')
        .eq('id', payment.booking_id)
        .maybeSingle<BookingRow>()

      if (bookingError) throw bookingError
      if (!booking) {
        console.error('Matching booking row not found for webhook event.')
        return NextResponse.json({ received: true })
      }

      if (booking.status !== 'active') {
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', booking.id)

        if (bookingUpdateError) throw bookingUpdateError
      }

      await ensureLessonsForBooking(supabase, booking)
      return NextResponse.json({ received: true })
    }

    if (event.event === 'charge.failed' || event.event === 'charge.cancelled') {
      const nextStatus = event.event === 'charge.failed' ? 'failed' : 'cancelled'

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          status: nextStatus,
          wave_reference: payload.transaction_reference || providerPaymentId || null,
        })
        .eq('id', payment.id)

      if (paymentUpdateError) throw paymentUpdateError
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('ModemPay webhook handling failed', error)
    return NextResponse.json({ received: true })
  }
}
