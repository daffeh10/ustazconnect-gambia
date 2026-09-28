import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWaychitWebhookSecret } from '@/lib/payments'
import { applyPaymentEvidence, type PaymentRecord } from '@/lib/payment-reconciliation'
import { verifyWaychitSignature, type WaychitPayment } from '@/lib/waychit'

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    if (!verifyWaychitSignature(request.headers.get('Waychit-Signature') || '', rawBody, getWaychitWebhookSecret())) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }
    const event = JSON.parse(rawBody) as { type?: string; data?: WaychitPayment }
    if (!['payment.request.completed', 'payment.session.completed'].includes(event.type || '')) {
      return NextResponse.json({ received: true })
    }
    const evidence = event.data
    if (!evidence || typeof evidence.id !== 'string' || !evidence.id) {
      return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 })
    }
    const db = createAdminClient()
    const { data: byId, error } = await db.from('payments').select('*')
      .eq('payment_method', 'waychit').eq('provider_payment_id', evidence.id).maybeSingle<PaymentRecord>()
    if (error) throw error
    let payment = byId
    if (!payment && typeof evidence.clientReference === 'string' && evidence.clientReference) {
      const result = await db.from('payments').select('*').eq('payment_method', 'waychit')
        .eq('intent_secret', evidence.clientReference).maybeSingle<PaymentRecord>()
      if (result.error) throw result.error
      payment = result.data
    }
    // Never fall back to "latest payment for the booking": that can credit an
    // unrelated retry and lose the reference of the attempt actually charged.
    if (!payment) return NextResponse.json({ error: 'Payment attempt not found.' }, { status: 500 })
    const kind = event.type === 'payment.session.completed' ? 'session' : 'request'
    if (payment.provider_kind !== kind) return NextResponse.json({ error: 'Payment type mismatch.' }, { status: 400 })
    try {
      await applyPaymentEvidence(db, payment, evidence)
    } catch (error) {
      const { error: saveError } = await db.from('payments').update({
        verification_error: error instanceof Error ? error.message : 'Webhook verification failed.',
        last_checked_at: new Date().toISOString(),
      }).eq('id', payment.id)
      if (saveError) console.error('Could not save webhook verification error', { paymentId: payment.id })
      throw error
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Waychit webhook processing failed', error)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
