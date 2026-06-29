import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSiteUrl, getWaychitApiKey, getWaychitApiUrl } from '@/lib/payments'
import { computeBookingCharge } from '@/lib/pricing'

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

function createClientReference(bookingId: string) {
  return `${bookingId}:attempt:${crypto.randomUUID()}`
}

function isValidPaymentAmount(amount: number) {
  return Number.isFinite(amount) && amount >= 5
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : ''

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (userError) throw userError
    if (!user) {
      return NextResponse.json({ error: 'Please sign in before starting payment.' }, { status: 401 })
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
      .eq('family_id', user.id)
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

    // Never trust monetary values that originated in the browser. The booking row
    // is inserted client-side, so its amounts could be tampered with. Recompute
    // the charge from the tutor's authoritative hourly rate and only ever charge
    // that server-computed amount.
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('hourly_rate')
      .eq('id', booking.tutor_id)
      .maybeSingle<{ hourly_rate: number | null }>()

    if (tutorError) throw tutorError
    if (!tutor || typeof tutor.hourly_rate !== 'number' || tutor.hourly_rate <= 0) {
      return NextResponse.json({ error: 'This tutor cannot be booked right now.' }, { status: 400 })
    }

    const hoursPerMonth = booking.hours_per_month
    if (!Number.isInteger(hoursPerMonth) || hoursPerMonth <= 0 || hoursPerMonth > 400) {
      return NextResponse.json({ error: 'This booking has invalid lesson hours.' }, { status: 400 })
    }

    // Authoritative amounts, computed by the shared pricing engine.
    const { monthlyTotal, serviceFee, grandTotal } = computeBookingCharge({
      hourlyRate: tutor.hourly_rate,
      hoursPerMonth,
    })

    if (!isValidPaymentAmount(grandTotal)) {
      console.error('Invalid recomputed booking total for Waychit checkout.', {
        bookingId: booking.id,
        grandTotal,
      })
      return NextResponse.json({ error: 'This booking cannot be paid right now.' }, { status: 400 })
    }

    // If the stored totals disagree with the authoritative amount, repair the
    // booking before charging so payment records stay consistent, and log it as
    // a possible tampering attempt.
    if (
      booking.monthly_total !== monthlyTotal ||
      booking.service_fee !== serviceFee ||
      booking.grand_total !== grandTotal
    ) {
      console.error('Booking total mismatch detected; repairing before charge.', {
        bookingId: booking.id,
        stored: {
          monthlyTotal: booking.monthly_total,
          serviceFee: booking.service_fee,
          grandTotal: booking.grand_total,
        },
        authoritative: { monthlyTotal, serviceFee, grandTotal },
      })

      const { error: repairError } = await supabase
        .from('bookings')
        .update({
          hourly_rate: tutor.hourly_rate,
          monthly_total: monthlyTotal,
          service_fee: serviceFee,
          grand_total: grandTotal,
        })
        .eq('id', booking.id)

      if (repairError) throw repairError
    }

    const clientReference = createClientReference(booking.id)

    const waychitResponse = await fetch(getWaychitApiUrl('/payment-requests'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${waychitApiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount: grandTotal,
        description: `Booking ${booking.id.slice(0, 8)} for ${(booking.subjects || []).join(', ') || 'tutoring lessons'}`,
        clientReference,
        successRedirectUrl: `${siteUrl}/payment/success?bookingId=${encodeURIComponent(booking.id)}`,
        failureRedirectUrl: `${siteUrl}/payment/failed?bookingId=${encodeURIComponent(booking.id)}`,
      }),
    })

    const paymentRequest = (await waychitResponse.json()) as WaychitPaymentRequestResponse

    if (!waychitResponse.ok || !paymentRequest.success) {
      console.error('Waychit payment request failed', paymentRequest)
      return NextResponse.json(
        { error: 'Could not start payment. Please try again in a moment.' },
        { status: 502 }
      )
    }

    const providerPaymentId = paymentRequest.paymentRequest?.id || ''
    const paymentLink = paymentRequest.paymentRequest?.waychitLaunchUrl || ''

    if (!providerPaymentId || !paymentLink) {
      console.error('Unexpected Waychit payment request response', paymentRequest)
      return NextResponse.json(
        { error: 'Could not start payment. Please try again in a moment.' },
        { status: 502 }
      )
    }

    const { error: paymentInsertError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      family_id: booking.family_id,
      amount: monthlyTotal,
      service_fee: serviceFee,
      total: grandTotal,
      payment_method: 'waychit',
      status: 'pending',
      intent_secret: clientReference,
      provider_payment_id: providerPaymentId || null,
    })

    if (paymentInsertError) throw paymentInsertError

    return NextResponse.json({
      payment_link: paymentLink,
    })
  } catch (error) {
    console.error('create-checkout route failed', error)

    return NextResponse.json({ error: 'Could not create payment session.' }, { status: 500 })
  }
}
