import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaychitWebhookSecret } from '@/lib/payments'
import { activateBookingAndEnsureLessons, type PaymentBookingRow } from '@/lib/payment-fulfillment'

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
  intent_secret: string | null
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

function getBookingIdFromClientReference(clientReference: string) {
  return clientReference.split(':attempt:')[0]?.trim() || ''
}

export async function POST(request: Request) {
  let webhookSecret = ''

  try {
    webhookSecret = getWaychitWebhookSecret()
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 500 })
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
    const clientReference = event.data?.clientReference?.trim() || ''
    const bookingId = getBookingIdFromClientReference(clientReference)
    const transactionReference = event.data?.transactionReference?.trim() || providerPaymentId || null

    if (!providerPaymentId && !clientReference && !bookingId) {
      console.error('Waychit webhook missing payment id and clientReference.')
      return NextResponse.json({ received: true })
    }

    let payment: PaymentRow | null = null

    if (providerPaymentId) {
      const { data, error } = await supabase
        .from('payments')
        .select('id,booking_id,family_id,status,provider_payment_id,intent_secret')
        .eq('provider_payment_id', providerPaymentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<PaymentRow>()

      if (error) throw error
      payment = data
    }

    if (!payment && clientReference) {
      const { data, error } = await supabase
        .from('payments')
        .select('id,booking_id,family_id,status,provider_payment_id,intent_secret')
        .eq('intent_secret', clientReference)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<PaymentRow>()

      if (error) throw error
      payment = data
    }

    if (!payment && bookingId) {
      const { data, error } = await supabase
        .from('payments')
        .select('id,booking_id,family_id,status,provider_payment_id,intent_secret')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<PaymentRow>()

      if (error) throw error
      payment = data
    }

    if (!payment?.booking_id) {
      console.error('No matching payment row found for webhook event.')
      return NextResponse.json({ error: 'Matching payment row not found.' }, { status: 500 })
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
        .select('*')
        .eq('id', payment.booking_id)
        .maybeSingle<PaymentBookingRow>()

      if (bookingError) throw bookingError
      if (!booking) {
        console.error('Matching booking row not found for webhook event.')
        return NextResponse.json({ error: 'Matching booking row not found.' }, { status: 500 })
      }

      await activateBookingAndEnsureLessons(supabase, booking)
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
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
