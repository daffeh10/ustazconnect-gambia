import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activateBookingAndEnsureLessons, type PaymentBookingRow } from '@/lib/payment-fulfillment'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface PaymentRow {
  id: string
  booking_id: string | null
  family_id: string | null
  status: string | null
  provider_payment_id: string | null
  wave_reference: string | null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : ''

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking confirmation details.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please sign in to confirm this payment.' }, { status: 401 })
    }
    if (userError) throw userError

    const supabase = createAdminClient()
    const familyId = user.id

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
        .select('*')
        .eq('id', bookingId)
        .eq('family_id', familyId)
        .maybeSingle<PaymentBookingRow>()

      if (bookingError) throw bookingError
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
      }

      await activateBookingAndEnsureLessons(supabase, booking)

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
        .select('*')
        .eq('id', bookingId)
        .eq('family_id', familyId)
        .maybeSingle<PaymentBookingRow>()

      if (bookingError) throw bookingError
      if (!booking) {
        return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 })
      }

      await activateBookingAndEnsureLessons(supabase, booking)
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
