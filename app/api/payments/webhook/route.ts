import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaychitWebhookSecret } from '@/lib/payments'

interface WaychitEventPayload {
  id?: string
  type?: string
  data?: {
    id?: string
    clientReference?: string
    transactionReference?: string
    paymentStatus?: string
    paymentError?: string
    paymentRequestStatus?: string
    paymentSessionStatus?: string
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
    return {} as WaychitEventPayload
  }

  return value as WaychitEventPayload
}

function isWaychitSignatureValid(signatureHeader: string, rawBody: string, webhookSecret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim()).filter(Boolean)
  const timestamp = parts.find((part) => part.startsWith('t='))?.split('=')[1]
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.split('=')[1])
    .filter(Boolean)

  if (!timestamp || signatures.length === 0) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds)
  if (ageSeconds > 5 * 60) return false

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  return signatures.some((signature) => {
    const expected = Buffer.from(expectedSignature, 'hex')
    const received = Buffer.from(signature, 'hex')
    return expected.length === received.length && crypto.timingSafeEqual(expected, received)
  })
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
  let webhookSecret = ''

  try {
    webhookSecret = getWaychitWebhookSecret()
  } catch (error) {
    console.error(error)
    return NextResponse.json({ received: true })
  }

  const signature = request.headers.get('Waychit-Signature') || ''
  const rawBody = await request.text()

  if (!isWaychitSignatureValid(signature, rawBody, webhookSecret)) {
    console.error('Invalid Waychit webhook signature.')
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  try {
    const event = normalizeEventPayload(JSON.parse(rawBody))
    const supabase = createAdminClient()

    const providerPaymentId = event.data?.id?.trim() || ''
    const bookingId = event.data?.clientReference?.trim() || ''
    const transactionReference = event.data?.transactionReference?.trim() || providerPaymentId || null

    let paymentQuery = supabase
      .from('payments')
      .select('id,booking_id,family_id,status,provider_payment_id')
      .order('created_at', { ascending: false })
      .limit(1)

    if (providerPaymentId) {
      paymentQuery = paymentQuery.eq('provider_payment_id', providerPaymentId)
    } else if (bookingId) {
      paymentQuery = paymentQuery.eq('booking_id', bookingId)
    } else {
      console.error('Waychit webhook missing payment id and clientReference.')
      return NextResponse.json({ received: true })
    }

    const { data: payment, error: paymentError } = await paymentQuery.maybeSingle<PaymentRow>()

    if (paymentError) throw paymentError
    if (!payment?.booking_id) {
      console.error('No matching payment row found for webhook event.')
      return NextResponse.json({ received: true })
    }

    const eventType = event.type?.trim() || ''
    const paymentStatus = event.data?.paymentStatus?.toLowerCase().trim() || ''
    const isCompletedEvent =
      eventType === 'payment.request.completed' ||
      eventType === 'payment.session.completed'

    if (isCompletedEvent && paymentStatus === 'succeeded') {
      if (payment.status !== 'completed') {
        const { error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            wave_reference: transactionReference,
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

    if (isCompletedEvent && paymentStatus && paymentStatus !== 'succeeded') {
      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          status: 'failed',
          wave_reference: transactionReference,
        })
        .eq('id', payment.id)

      if (paymentUpdateError) throw paymentUpdateError
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Waychit webhook handling failed', error)
    return NextResponse.json({ received: true })
  }
}
