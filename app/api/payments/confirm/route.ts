import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { reconcileBookingPayments } from '@/lib/payment-reconciliation'

export async function POST(request: Request) {
  try {
    const body: { bookingId?: unknown } = await request.json()
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : ''
    if (!bookingId) return NextResponse.json({ error: 'Missing booking details.' }, { status: 400 })
    const auth = await createClient()
    const { data: { user }, error: authError } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
    if (authError) throw authError
    const db = createAdminClient()
    const { data: booking, error } = await db.from('bookings').select('id')
      .eq('id', bookingId).eq('family_id', user.id).maybeSingle()
    if (error) throw error
    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    const payment = await reconcileBookingPayments(db, bookingId)
    return NextResponse.json({ status: payment?.status || 'missing_payment', needsReview: Boolean(payment?.verification_error), receipt: payment?.status === 'completed' ? { id: payment.id, total: Number(payment.total), serviceFee: Number(payment.service_fee), reference: payment.wave_reference || payment.provider_payment_id, paidAt: payment.paid_at } : undefined })
  } catch (error) {
    console.error('Payment confirmation could not finish', error)
    return NextResponse.json({ error: 'We could not verify your payment yet. Please check again or contact support before paying again.' }, { status: 502 })
  }
}
