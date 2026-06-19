import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSiteUrl, getWaychitApiKey, getWaychitApiUrl } from '@/lib/payments'

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

interface WaychitPaymentRequestResponse {
  success?: boolean
  message?: string
  paymentRequest?: {
    id?: string
    amount?: number
    currency?: string
    status?: string
    waychitLaunchUrl?: string
    successRedirectUrl?: string
    failureRedirectUrl?: string
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
    const waychitApiKey = getWaychitApiKey()
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

    const waychitResponse = await fetch(getWaychitApiUrl('/payment-requests'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${waychitApiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount: booking.grand_total,
        description: `Booking ${booking.id.slice(0, 8)} for ${(booking.subjects || []).join(', ') || 'tutoring lessons'}`,
        clientReference: booking.id,
        successRedirectUrl: `${siteUrl}/payment/success?bookingId=${encodeURIComponent(booking.id)}`,
        failureRedirectUrl: `${siteUrl}/payment/failed?bookingId=${encodeURIComponent(booking.id)}`,
      }),
    })

    const paymentRequest = (await waychitResponse.json()) as WaychitPaymentRequestResponse

    if (!waychitResponse.ok || !paymentRequest.success) {
      console.error('Waychit payment request failed', paymentRequest)
      throw new Error(paymentRequest.message || 'Could not create Waychit payment request.')
    }

    const providerPaymentId = paymentRequest.paymentRequest?.id || ''
    const paymentLink = paymentRequest.paymentRequest?.waychitLaunchUrl || ''

    if (!providerPaymentId || !paymentLink) {
      console.error('Unexpected Waychit payment request response', paymentRequest)
      throw new Error(paymentRequest.message || 'Could not create Waychit checkout session.')
    }

    const { error: paymentInsertError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      family_id: booking.family_id,
      amount: booking.monthly_total,
      service_fee: booking.service_fee,
      total: booking.grand_total,
      payment_method: 'waychit',
      status: 'pending',
      intent_secret: providerPaymentId,
      provider_payment_id: providerPaymentId || null,
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
