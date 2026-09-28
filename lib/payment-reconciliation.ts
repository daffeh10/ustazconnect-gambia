import { createAdminClient } from '@/lib/supabase/admin'
import { activateBookingAndEnsureLessons, type PaymentBookingRow } from '@/lib/payment-fulfillment'
import { retrieveWaychitPayment, validCheckoutUrl, verifyPaymentEvidence, waychitPaymentState, type WaychitPayment } from '@/lib/waychit'

export interface PaymentRecord {
  id: string
  booking_id: string | null
  family_id: string | null
  amount: number
  service_fee: number
  total: number
  status: string | null
  payment_method: string | null
  provider_payment_id: string | null
  intent_secret: string | null
  wave_reference: string | null
  paid_at: string | null
  created_at: string
  provider_kind: string
  provider_status: string | null
  checkout_url: string | null
  last_checked_at: string | null
  verification_error: string | null
}

type Database = ReturnType<typeof createAdminClient>

export async function fulfillPayment(db: Database, payment: PaymentRecord) {
  try {
    const { data: booking, error } = await db.from('bookings').select('*')
      .eq('id', payment.booking_id).maybeSingle<PaymentBookingRow>()
    if (error) throw error
    if (!booking || booking.family_id !== payment.family_id) throw new Error('Payment booking ownership does not match.')
    if (booking.status === 'completed') return
    if (!['confirmed', 'active'].includes(booking.status || '')) {
      throw new Error('Payment received, but this booking needs admin review before activation.')
    }
    if (booking.status === 'confirmed') {
      const { error: amountError } = await db.from('bookings').update({
        monthly_total: payment.amount, service_fee: payment.service_fee, grand_total: payment.total,
      }).eq('id', booking.id).eq('status', 'confirmed')
      if (amountError) throw amountError
    }
    await activateBookingAndEnsureLessons(db, booking)
  } catch (error) { throw error }
}

export async function applyPaymentEvidence(db: Database, payment: PaymentRecord, evidence: WaychitPayment) {
  try {
    verifyPaymentEvidence(payment, evidence)
    const state = waychitPaymentState(evidence)
    const now = new Date().toISOString()
    const review = state === 'review' ? 'Waychit closed this request without explicit payment success. Reconcile with the merchant dashboard.' : null
    const paidDate = evidence.paidDate && Number.isFinite(Date.parse(evidence.paidDate)) ? evidence.paidDate : now
    const { error } = await db.from('payments').update({
      provider_payment_id: evidence.id,
      provider_status: state === 'completed' ? 'succeeded' : evidence.status || evidence.paymentRequestStatus || evidence.paymentSessionStatus || evidence.paymentStatus || 'unknown',
      last_checked_at: now,
      verification_error: review,
      ...(validCheckoutUrl(evidence.waychitLaunchUrl) ? { checkout_url: validCheckoutUrl(evidence.waychitLaunchUrl) } : {}),
      ...(state === 'completed' ? { status: 'completed', paid_at: paidDate, wave_reference: evidence.transactionReference || null }
        : state === 'failed' || state === 'cancelled' ? { status: state } : {}),
    }).eq('id', payment.id).neq('status', 'completed')
    if (error) throw error
    // Re-read after the conditional write: a concurrent success always wins.
    const { data: current, error: readError } = await db.from('payments').select('*').eq('id', payment.id).single<PaymentRecord>()
    if (readError) throw readError
    if (current.status === 'completed') await fulfillPayment(db, current)
    return current
  } catch (error) { throw error }
}

export async function reconcilePayment(db: Database, payment: PaymentRecord) {
  try {
    if (payment.status === 'completed') {
      await fulfillPayment(db, payment)
      if (payment.verification_error) {
        const { error } = await db.from('payments').update({ verification_error: null }).eq('id', payment.id)
        if (error) throw error
      }
      return { ...payment, verification_error: null }
    }
    if (!payment.provider_payment_id) {
      throw new Error('Checkout has no Waychit reference. Its creation may still be in progress or unresolved; check the merchant dashboard before retrying.')
    }
    const evidence = await retrieveWaychitPayment(payment.provider_payment_id, payment.provider_kind)
    return await applyPaymentEvidence(db, payment, evidence)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment verification could not finish.'
    const { error: saveError } = await db.from('payments').update({
      last_checked_at: new Date().toISOString(), verification_error: message,
    }).eq('id', payment.id)
    if (saveError) console.error('Could not save payment verification error', { paymentId: payment.id, code: saveError.code })
    throw new Error(message)
  }
}

export async function recoverPendingPayments(db: Database) {
  try {
    const [pending, unfulfilled] = await Promise.all([
      db.from('payments').select('*').eq('payment_method', 'waychit').eq('status', 'pending')
        .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(6),
      db.from('payments').select('*,bookings!inner(status)').eq('status', 'completed').eq('bookings.status', 'confirmed')
        .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(3),
    ])
    if (pending.error) throw pending.error
    if (unfulfilled.error) throw unfulfilled.error
    const candidates = [...(pending.data || []), ...(unfulfilled.data || [])] as PaymentRecord[]
    let checked = 0
    let errors = 0
    for (let offset = 0; offset < candidates.length; offset += 3) {
      const results = await Promise.allSettled(candidates.slice(offset, offset + 3).map((payment) => reconcilePayment(db, payment)))
      checked += results.filter((result) => result.status === 'fulfilled').length
      errors += results.filter((result) => result.status === 'rejected').length
    }
    return { checked, errors }
  } catch (error) {
    console.error('Scheduled payment recovery failed', error)
    return { checked: 0, errors: 1 }
  }
}

export async function reconcileBookingPayments(db: Database, bookingId: string) {
  try {
    const { data, error } = await db.from('payments').select('*').eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const payments = (data || []) as PaymentRecord[]
    const completed = payments.find((payment) => payment.status === 'completed')
    if (completed) return await reconcilePayment(db, completed)
    // Check all unresolved attempts, not only the newest. Older attempts can be
    // paid after a family returns to the website and opens another tab.
    let firstError: unknown = null
    let unresolved: PaymentRecord | null = null
    for (const payment of payments.filter((row) => row.status === 'pending')) {
      try {
        const checked = await reconcilePayment(db, payment)
        if (checked.status === 'completed') return checked
        if (checked.status === 'pending') unresolved = checked
      } catch (error) { firstError ||= error }
    }
    if (firstError) throw firstError
    if (unresolved) return unresolved
    const { data: latest, error: latestError } = await db.from('payments').select('*').eq('booking_id', bookingId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle<PaymentRecord>()
    if (latestError) throw latestError
    return latest
  } catch (error) { throw error }
}
