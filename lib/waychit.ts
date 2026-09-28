import crypto from 'crypto'
import { getWaychitApiKey, getWaychitApiUrl } from '@/lib/payments'

export interface WaychitPayment {
  id?: string
  amount?: number
  totalAmount?: number
  currency?: string
  status?: string
  paymentStatus?: string
  paymentRequestStatus?: string
  paymentSessionStatus?: string
  clientReference?: string | null
  transactionReference?: string | null
  paidDate?: string | null
  waychitLaunchUrl?: string
  metadata?: { paymentId?: string; bookingId?: string }
}

export interface WaychitResponse {
  success?: boolean
  paymentRequest?: WaychitPayment | null
  paymentSession?: WaychitPayment | null
}

export function validCheckoutUrl(value: string | undefined) {
  try {
    const url = new URL(value || '')
    return url.protocol === 'https:' && url.hostname === 'pay.waychit.com' && !url.username && !url.password
      ? url.href : null
  } catch { return null }
}

export function verifyWaychitSignature(header: string, body: string, secret: string, now = Date.now()) {
  const parts = header.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || ''
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest()
  return parts.filter((part) => part.startsWith('v1=')).some((part) => {
    const hex = part.slice(3)
    if (!/^[a-fA-F0-9]{64}$/.test(hex)) return false
    return crypto.timingSafeEqual(expected, Buffer.from(hex, 'hex'))
  })
}

export function verifyPaymentEvidence(payment: {
  provider_payment_id: string | null
  intent_secret: string | null
  total: number
  booking_id: string | null
  id: string
}, evidence: WaychitPayment) {
  if (!evidence.id || (payment.provider_payment_id && evidence.id !== payment.provider_payment_id)) {
    throw new Error('Waychit payment reference does not match this attempt.')
  }
  if (!payment.provider_payment_id && (!payment.intent_secret || evidence.clientReference !== payment.intent_secret)) {
    throw new Error('Waychit did not return the exact checkout attempt reference.')
  }
  if (evidence.clientReference && evidence.clientReference !== payment.intent_secret) {
    throw new Error('Waychit checkout attempt reference does not match.')
  }
  if (evidence.metadata?.paymentId && evidence.metadata.paymentId !== payment.id) {
    throw new Error('Waychit payment metadata does not match.')
  }
  if (evidence.metadata?.bookingId && evidence.metadata.bookingId !== payment.booking_id) {
    throw new Error('Waychit booking metadata does not match.')
  }
  const amount = evidence.amount ?? evidence.totalAmount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount !== Number(payment.total) || evidence.currency?.toUpperCase() !== 'GMD') {
    throw new Error('Waychit amount or currency does not match the stored charge.')
  }
}

export function waychitPaymentState(evidence: WaychitPayment) {
  const paymentStatus = evidence.paymentStatus?.toLowerCase()
  const requestStatus = (evidence.status || evidence.paymentRequestStatus || evidence.paymentSessionStatus)?.toLowerCase()
  if (paymentStatus === 'succeeded') return 'completed'
  // An active request may allow another attempt after a failed payment method.
  // Never release its checkout reservation until Waychit closes the request.
  if (requestStatus === 'active' || requestStatus === 'open') return 'pending'
  if (requestStatus === 'closed' && paymentStatus === 'failed') return 'failed'
  if (requestStatus === 'cancelled' || requestStatus === 'expired') return 'cancelled'
  if (requestStatus === 'closed') return 'review'
  return 'pending'
}

export async function retrieveWaychitPayment(id: string, kind: string) {
  try {
    if (kind !== 'request' && kind !== 'session') throw new Error('Unsupported Waychit payment type.')
    const path = kind === 'session' ? '/payment-sessions/card/' : '/payment-requests/'
    const response = await fetch(getWaychitApiUrl(`${path}${encodeURIComponent(id)}`), {
      headers: { Authorization: `Bearer ${getWaychitApiKey()}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Waychit verification unavailable (HTTP ${response.status}).`)
    const payload = await response.json() as WaychitResponse
    const payment = kind === 'session' ? payload.paymentSession : payload.paymentRequest
    if (!payload.success || !payment) throw new Error('Waychit returned no verifiable payment details.')
    return payment
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Waychit verification unavailable.')
  }
}
