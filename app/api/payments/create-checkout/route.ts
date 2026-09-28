import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { reconcileBookingPayments, type PaymentRecord } from '@/lib/payment-reconciliation'
import { validCheckoutUrl, type WaychitResponse } from '@/lib/waychit'
import { normalizeTutorSubjects } from '@/lib/tutor-subjects'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSiteUrl, getWaychitApiKey, getWaychitApiUrl } from '@/lib/payments'
import { computeBookingCharge, computePackageBookingCharge, computeTrialBookingCharge } from '@/lib/pricing'

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
  booking_type?: string | null
  pricing_model?: string | null
  package_id?: string | null
  children_count?: number | null
}

interface TutorPackageRow {
  monthly_price: number
  additional_child_amount: number | null
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

    if (!user) {
      return NextResponse.json({ error: 'Please sign in before starting payment.' }, { status: 401 })
    }
    if (userError) throw userError

    const supabase = createAdminClient()
    const waychitApiKey = getWaychitApiKey()
    const siteUrl = getSiteUrl(request)

    let { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id,family_id,tutor_id,family_name,family_phone,subjects,hours_per_month,monthly_total,service_fee,grand_total,status,booking_type,pricing_model,package_id,children_count'
      )
      .eq('id', bookingId)
      .eq('family_id', user.id)
      .maybeSingle<BookingRow>()

    if (
      bookingError &&
      (
        bookingError.message.toLowerCase().includes('booking_type') ||
        bookingError.message.toLowerCase().includes('pricing_model') ||
        bookingError.message.toLowerCase().includes('package_id') ||
        bookingError.message.toLowerCase().includes('children_count') ||
        bookingError.message.toLowerCase().includes('column')
      )
    ) {
      const fallback = await supabase
        .from('bookings')
        .select(
          'id,family_id,tutor_id,family_name,family_phone,subjects,hours_per_month,monthly_total,service_fee,grand_total,status'
        )
        .eq('id', bookingId)
        .eq('family_id', user.id)
        .maybeSingle<BookingRow>()

      booking = fallback.data
      bookingError = fallback.error
    }

    if (bookingError) throw bookingError
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }
    if (!booking.family_id) {
      return NextResponse.json({ error: 'Booking is missing a family account.' }, { status: 400 })
    }
    const existingPayment = await reconcileBookingPayments(supabase, booking.id)
    if (existingPayment?.status === 'completed') {
      return NextResponse.json({ already_paid: true })
    }
    if (existingPayment?.status === 'pending') {
      const link = validCheckoutUrl(existingPayment.checkout_url || undefined)
      if (link && !existingPayment.verification_error && ['active', 'open'].includes(existingPayment.provider_status || '')) {
        return NextResponse.json({ payment_link: link })
      }
      return NextResponse.json({ error: 'An earlier checkout is still unresolved. Please check payment status or contact support before paying again.' }, { status: 409 })
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only accepted bookings awaiting payment can be paid.' }, { status: 400 })
    }

    // Recompute every charge from authoritative tutor/package data. This also
    // protects older booking rows created before booking creation moved server-side.
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('hourly_rate')
      .eq('id', booking.tutor_id)
      .maybeSingle<{ hourly_rate: number | null }>()

    if (tutorError) throw tutorError
    if (!tutor || ((!booking.booking_type || booking.booking_type === 'monthly') && (!booking.pricing_model || booking.pricing_model === 'hourly') && (typeof tutor.hourly_rate !== 'number' || tutor.hourly_rate <= 0))) {
      return NextResponse.json({ error: 'This tutor cannot be booked right now.' }, { status: 400 })
    }

    const bookingType = booking.booking_type || 'monthly'
    const pricingModel = booking.pricing_model || 'hourly'
    const hoursPerMonth = booking.hours_per_month
    if (bookingType !== 'trial' && (!Number.isInteger(hoursPerMonth) || hoursPerMonth <= 0 || hoursPerMonth > 400)) {
      return NextResponse.json({ error: 'This booking has invalid lesson hours.' }, { status: 400 })
    }

    // Authoritative amounts, computed by the shared pricing engine.
    let packageRow: TutorPackageRow | null = null
    if (bookingType === 'monthly' && pricingModel === 'package') {
      if (!booking.package_id) {
        return NextResponse.json({ error: 'This package booking is missing package details.' }, { status: 400 })
      }

      const { data: packageData, error: packageError } = await supabase
        .from('tutor_packages')
        .select('monthly_price,additional_child_amount')
        .eq('id', booking.package_id)
        .eq('tutor_id', booking.tutor_id)
        .maybeSingle<TutorPackageRow>()

      if (packageError) throw packageError
      if (!packageData) {
        return NextResponse.json({ error: 'This package is no longer available.' }, { status: 400 })
      }
      packageRow = packageData
    }

    const { monthlyTotal, serviceFee, grandTotal } =
      bookingType === 'trial'
        ? computeTrialBookingCharge()
        : packageRow
          ? computePackageBookingCharge({
              monthlyPrice: packageRow.monthly_price,
              additionalChildAmount: packageRow.additional_child_amount,
              childrenCount: booking.children_count || 1,
            })
          : computeBookingCharge({
              hourlyRate: tutor.hourly_rate || 0,
              hoursPerMonth,
              childrenCount: booking.children_count || 1,
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
    // Reserve before contacting Waychit. The partial unique index prevents two
    // browser tabs or server instances from creating payable requests together.
    const { data: attempt, error: reserveError } = await supabase.from('payments').insert({
      booking_id: booking.id, family_id: booking.family_id,
      amount: monthlyTotal, service_fee: serviceFee, total: grandTotal,
      payment_method: 'waychit', status: 'pending', intent_secret: clientReference,
      provider_kind: 'request', provider_status: 'creating',
    }).select('*').single<PaymentRecord>()
    if (reserveError?.code === '23505') {
      return NextResponse.json({ error: 'A checkout is already being opened. Please wait a moment and check payment status.' }, { status: 409 })
    }
    if (reserveError) throw reserveError

    // A previous attempt may have completed between reconciliation and the
    // reservation. Do not issue another provider request in that case.
    const { data: paid, error: paidError } = await supabase.from('payments').select('id')
      .eq('booking_id', booking.id).eq('status', 'completed').limit(1).maybeSingle()
    if (paidError) throw paidError
    if (paid) {
      const { error: releaseError } = await supabase.from('payments').update({ status: 'cancelled', provider_status: 'not_created' }).eq('id', attempt.id)
      if (releaseError) throw releaseError
      return NextResponse.json({ already_paid: true })
    }

    try {
      const response = await fetch(getWaychitApiUrl('/payment-requests'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${waychitApiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          amount: grandTotal,
          description: `Booking ${booking.id.slice(0, 8)} for ${normalizeTutorSubjects(booking.subjects).join(', ') || 'tutoring lessons'}`,
          clientReference,
          metadata: { bookingId: booking.id, paymentId: attempt.id },
          successRedirectUrl: `${siteUrl}/payment/success?bookingId=${encodeURIComponent(booking.id)}`,
          failureRedirectUrl: `${siteUrl}/payment/failed?bookingId=${encodeURIComponent(booking.id)}`,
        }),
      })
      const payload = await response.json() as WaychitResponse
      if (!response.ok || !payload.success) {
        // A timeout, 5xx or malformed response may follow a successful creation.
        // Only a definitive rejection allows another attempt automatically.
        if (response.status >= 400 && response.status < 500 && payload.success === false) {
          const { error } = await supabase.from('payments').update({ status: 'failed', provider_status: 'rejected' })
            .eq('id', attempt.id).eq('status', 'pending')
          if (error) throw error
        }
        throw new Error('Waychit could not create a verified checkout.')
      }
      const provider = payload.paymentRequest
      const link = validCheckoutUrl(provider?.waychitLaunchUrl)
      if (typeof provider?.id === 'string' && provider.id) {
        const { error: referenceError } = await supabase.from('payments').update({ provider_payment_id: provider.id })
          .eq('id', attempt.id).eq('status', 'pending')
        if (referenceError) throw referenceError
      }
      if (!provider?.id || !link || provider.amount !== grandTotal || provider.currency?.toUpperCase() !== 'GMD') {
        throw new Error('Waychit returned unexpected checkout details.')
      }
      const { error } = await supabase.from('payments').update({
        provider_payment_id: provider.id, checkout_url: link,
        provider_status: provider.status || 'active', verification_error: null,
      }).eq('id', attempt.id).eq('status', 'pending')
      if (error) throw error
      return NextResponse.json({ payment_link: link })
    } catch (error) {
      const { error: saveError } = await supabase.from('payments').update({
        verification_error: 'Checkout creation could not be confirmed. Check Waychit before starting another payment.',
      }).eq('id', attempt.id).eq('status', 'pending')
      if (saveError) console.error('Could not save checkout error', { paymentId: attempt.id })
      throw error
    }
  } catch (error) {
    console.error('create-checkout route failed', error)
    return NextResponse.json({ error: 'Could not open checkout safely. Check payment status or contact support before trying again.' }, { status: 502 })
  }
}
