'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type State = 'checking' | 'completed' | 'pending' | 'failed' | 'missing_payment'
interface Receipt { id: string; total: number; serviceFee: number; reference: string | null; paidAt: string | null }

export default function PaymentSuccessClient() {
  const params = useSearchParams()
  const bookingId = params.get('bookingId') || ''
  const [state, setState] = useState<State>('checking')
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const check = useCallback(async (signal?: AbortSignal) => {
    setState('checking')
    setMessage('')
    try {
      if (!bookingId) throw new Error('Missing booking details. Please return to your family dashboard.')
      const response = await fetch('/api/payments/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId }), signal })
      const payload = await response.json() as { status?: string; error?: string; needsReview?: boolean; receipt?: Receipt }
      if (!response.ok) throw new Error(payload.error || 'Payment verification is unavailable. Check again before making another payment.')
      if (signal?.aborted) return
      if (payload.status === 'completed') { setState('completed'); setReceipt(payload.receipt || null); return }
      if (payload.status === 'missing_payment') { setState('missing_payment'); setMessage('No payment attempt is recorded for this booking. If you were charged, contact support with your receipt before paying again.'); return }
      if (payload.status === 'failed' || payload.status === 'cancelled') { setState('failed'); setMessage('The previous checkout ended without a verified successful payment.'); return }
      setState('pending')
      setMessage(payload.needsReview ? 'This payment needs support review. Please do not pay again until it has been checked.' : 'Payment has not been verified yet. If you completed checkout, check again shortly before paying again.')
    } catch (error) {
      if (!signal?.aborted) { setState('pending'); setMessage(error instanceof Error ? error.message : 'Could not verify payment. Please check again.') }
    }
  }, [bookingId])

  useEffect(() => {
    const controller = new AbortController()
    void check(controller.signal)
    return () => controller.abort()
  }, [check])

  return <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
    <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      {state === 'checking' ? <div className="mb-4 h-12 animate-pulse rounded-lg bg-gray-200" aria-label="Checking payment" /> : null}
      <h1 className="text-2xl font-bold text-gray-900">{state === 'completed' ? 'Payment confirmed' : state === 'checking' ? 'Checking payment…' : state === 'failed' ? 'Checkout not completed' : state === 'missing_payment' ? 'No payment recorded' : 'Payment not yet verified'}</h1>
      <p role="status" className="mt-3 text-gray-600">{state === 'completed' ? 'Your booking is paid and active. Your lessons are available in your dashboard.' : state === 'checking' ? 'Checking your payment and booking activation.' : message}</p>
      {receipt && state === 'completed' && <dl className="mt-5 space-y-3 rounded-lg bg-emerald-50 p-4 text-sm text-gray-800">
        <div><dt>Amount paid</dt><dd className="font-semibold">GMD {receipt.total.toLocaleString()}</dd></div>
        <div><dt>Included family service fee</dt><dd>GMD {receipt.serviceFee.toLocaleString()}</dd></div>
        <div><dt>Payment record</dt><dd className="break-all">{receipt.id}</dd></div>
        <div><dt>Waychit reference</dt><dd className="break-all">{receipt.reference || 'Not supplied'}</dd></div>
        <div><dt>Paid at</dt><dd>{receipt.paidAt ? new Date(receipt.paidAt).toLocaleString('en-GB') : 'Not supplied'}</dd></div>
      </dl>}
      <div className="mt-6 flex flex-col gap-3">
        {state !== 'completed' && <button onClick={() => void check()} disabled={state === 'checking'} className="min-h-12 rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Check payment status</button>}
        <Link href="/family/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 px-4 font-medium text-gray-700">Go to my dashboard</Link>
        {state !== 'completed' && state !== 'checking' && <a href="mailto:tutorconnectgambia@gmail.com" className="inline-flex min-h-12 items-center justify-center text-emerald-700 underline">Contact support</a>}
      </div>
    </div>
  </div>
}
