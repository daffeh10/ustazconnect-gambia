import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getModemPayClient, getSiteUrl } from '@/lib/payments'

interface BookingRow {
  id: string
  family_id: string | null
  tutor_id: string
  family_name: string
  family_phone: string | null
  subjects: string[] | null
  hours_per_month: number
  monthly_total: number
  service_fee: number
  grand_total: number
  status: string | null
}

interface ModemPayIntentResponse {
  status?: boolean
  message?: string
  payment_intent_id?: string
  intent_secret?: string
  payment_link?: string
  data?: {
    id?: string
    intent_secret?: string
    payment_link?: string
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : ''

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const modemPay = getModemPayClient()
    const siteUrl = getSiteUrl(request)

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id,family_id,tutor_id,family_name,family_phone,subjects,hours_per_month,monthly_total,service_fee,grand_total,status'
      )
      .eq('id', bookingId)
      .maybeSingle<BookingRow>()

    if (bookingError) throw bookingError
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }
    if (!booking.family_id) {
      return NextResponse.json({ error: 'Booking is missing a family account.' }, { status: 400 })
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed bookings can be paid.' }, { status: 400 })
    }

    const paymentIntent = (await modemPay.paymentIntents.create({
      amount: booking.grand_total,
      currency: 'GMD',
      title: 'TutorConnect Gambia booking payment',
      description: `Booking ${booking.id.slice(0, 8)} for ${(booking.subjects || []).join(', ') || 'tutoring lessons'}`,
      customer_name: booking.family_name,
      customer_phone: booking.family_phone || undefined,
      metadata: {
        booking_id: booking.id,
        family_id: booking.family_id,
        tutor_id: booking.tutor_id,
      },
      return_url: `${siteUrl}/payment/success?bookingId=${encodeURIComponent(booking.id)}`,
      cancel_url: `${siteUrl}/payment/failed?bookingId=${encodeURIComponent(booking.id)}`,
      callback_url: `${siteUrl}/api/payments/webhook`,
    })) as ModemPayIntentResponse

    const providerPaymentId = paymentIntent.payment_intent_id || paymentIntent.data?.id || ''
    const intentSecret = paymentIntent.intent_secret || paymentIntent.data?.intent_secret || ''
    const paymentLink = paymentIntent.payment_link || paymentIntent.data?.payment_link || ''

    if (!providerPaymentId || !intentSecret || !paymentLink) {
      console.error('Unexpected ModemPay payment intent response', paymentIntent)
      throw new Error(paymentIntent.message || 'Could not create ModemPay checkout session.')
    }

    const { error: paymentInsertError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      family_id: booking.family_id,
      amount: booking.monthly_total,
      service_fee: booking.service_fee,
      total: booking.grand_total,
      payment_method: 'modempay',
      status: 'pending',
      intent_secret: intentSecret,
      provider_payment_id: providerPaymentId,
    })

    if (paymentInsertError) throw paymentInsertError

    return NextResponse.json({
      payment_link: paymentLink,
    })
  } catch (error) {
    console.error('create-checkout route failed', error)

    let message = 'Could not create payment session.'

    if (error instanceof Error && error.message.trim()) {
      message = error.message
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
