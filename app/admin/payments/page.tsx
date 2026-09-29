'use client'

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import type { AdminPaymentBooking } from '@/lib/admin-payments'
import { bookingStatusLabel } from '@/lib/booking-status'

function money(amount: number) { return `GMD ${Number(amount).toLocaleString()}` }
function date(value: string | null) { return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Banjul' }) + ' GMT' : '—' }

function PaymentsContent() {
  const params = useSearchParams()
  const [search, setSearch] = useState(params.get('search') || '')
  const [query, setQuery] = useState(params.get('search') || '')
  const [page, setPage] = useState(1)
  const [bookings, setBookings] = useState<AdminPaymentBooking[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [reminding, setReminding] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/payments?page=${page}&search=${encodeURIComponent(query)}`, { signal })
      const payload = await response.json() as { bookings?: AdminPaymentBooking[]; total?: number; error?: string }
      if (!response.ok || !payload.bookings) throw new Error(payload.error || 'Could not load payments.')
      if (signal?.aborted) return
      setBookings(payload.bookings)
      setTotal(payload.total || 0)
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : 'Could not load payments.')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [page, query])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function check(paymentId: string) {
    setChecking(paymentId)
    setMessage('')
    try {
      const response = await fetch('/api/admin/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) })
      const payload = await response.json() as { message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Payment check failed.')
      setMessageIsError(false)
      setMessage(payload.message || 'Payment checked.')
    } catch (error) {
      setMessageIsError(true)
      setMessage(error instanceof Error ? error.message : 'Payment check failed.')
    } finally { await load(); setChecking(null) }
  }

  async function remind(booking: AdminPaymentBooking) {
    if (!window.confirm(`Email ${booking.family_name} a reminder to pay ${money(booking.grand_total)}?`)) return
    setReminding(booking.id)
    setMessage('')
    try {
      const response = await fetch('/api/admin/payments/reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) })
      const payload = await response.json() as { message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not send the payment reminder.')
      setMessageIsError(false)
      setMessage(payload.message || 'Payment reminder sent.')
    } catch (error) {
      setMessageIsError(true)
      setMessage(error instanceof Error ? error.message : 'Could not send the payment reminder.')
    } finally { await load(); setReminding(null) }
  }

  function submit(event: FormEvent) { event.preventDefault(); setPage(1); setQuery(search.trim()) }

  return <div className="min-w-0 space-y-6">
    <div><h1 className="text-3xl font-bold text-gray-900">Bookings & payments</h1>
      <p className="mt-2 text-gray-600">Track payment evidence separately from tutor acceptance. Amounts received here are recorded family payments, not your Waychit available balance.</p></div>
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <label className="min-w-0 flex-1"><span className="text-sm font-medium text-gray-700">Family name or full booking ID</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-4 focus:ring-2 focus:ring-emerald-500" /></label>
      <button className="min-h-12 self-end rounded-lg bg-emerald-600 px-6 text-white hover:bg-emerald-700">Search</button>
      <button type="button" onClick={() => void load()} disabled={loading} className="min-h-12 self-end rounded-lg border border-gray-300 px-5 disabled:opacity-50">Refresh</button>
    </form>
    {message && <p role={messageIsError ? 'alert' : 'status'} className={messageIsError ? 'rounded-xl border border-red-200 bg-red-50 p-4 text-red-800' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900'}>{message}</p>}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>
      : loading ? <div aria-label="Loading payments" className="space-y-4 animate-pulse">{[1, 2, 3].map((id) => <div key={id} className="h-48 rounded-xl bg-gray-200" />)}</div>
      : bookings.length === 0 ? <p className="rounded-xl border border-gray-100 bg-white p-6 text-gray-600">No bookings match this search.</p>
      : bookings.map((booking) => <article key={booking.id} className="min-w-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-semibold text-gray-900">{booking.family_name} · {booking.tutor_name}</h2>
            <p className="mt-1 break-all text-xs text-gray-500">Booking {booking.id}</p><p className="mt-1 text-sm text-gray-500">{date(booking.created_at)}</p></div>
          <div className="space-y-1 text-sm"><p className="font-medium text-gray-700">{booking.status === 'confirmed' && booking.amountReceived > 0 ? 'Paid — activation pending' : bookingStatusLabel(booking.status)}</p>
            <p className={booking.amountReceived > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{booking.paymentLabel}</p></div>
        </div>
        {booking.status === 'confirmed' && booking.amountReceived === 0 && <div className="mt-4 flex flex-col gap-3 rounded-lg bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">Accepted by the tutor but not paid. {booking.payment_reminder_sent_at ? `Last payment reminder: ${date(booking.payment_reminder_sent_at)}.` : 'No payment reminder sent yet.'}</p>
          <button onClick={() => void remind(booking)} disabled={reminding !== null || checking !== null} className="min-h-12 shrink-0 rounded-lg bg-emerald-600 px-4 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{reminding === booking.id ? 'Sending…' : 'Send payment reminder'}</button>
        </div>}
        {booking.needsReview && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Needs review. {booking.duplicatePayment ? 'More than one successful payment exists. Reconcile the extra payment before any refund or payout.' : 'Check the payment history and booking activation below.'}</p>}
        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Booking total requested', money(booking.grand_total)], ['Payments received', money(booking.amountReceived)],
            [booking.allocationBasis === 'paid' ? 'Family service fee collected' : 'Expected family service fee', money(booking.serviceFee)],
            ['Expected tutor commission', money(booking.commission)], ['Expected tutor share', money(booking.tutorShare)],
            ['Expected TutorConnect fees', money(booking.platformFees)],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-3"><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 font-semibold text-gray-900">{value}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm text-gray-500">{booking.allocationBasis === 'expected' ? 'No payment has been recorded; all fee and tutor-share figures are estimates.' : 'Allocation uses the first successful payment. Commission is deducted when eligible lessons are paid out; these figures are before processing costs.'} {booking.booking_type === 'trial' ? 'Trials have no tutor commission.' : ''}</p>
        <h3 className="mt-5 font-semibold text-gray-900">Payment history</h3>
        {booking.attempts.length === 0 ? <p className="mt-2 text-sm text-gray-600">No checkout or payment has been recorded for this booking.</p>
          : <div className="mt-3 space-y-3">{booking.attempts.map((attempt) => <div key={attempt.id} className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-gray-900">{attempt.status === 'completed' ? 'Paid' : attempt.status === 'pending' ? 'Not verified as paid' : attempt.status} · {money(attempt.total)}</p><p className="text-gray-500">Started {date(attempt.createdAt)}</p></div>
            <dl className="mt-3 grid gap-2 text-gray-700 sm:grid-cols-2">
              {[[ 'Waychit request ID', attempt.providerId || 'Not returned'], ['Transaction reference', attempt.transactionReference || 'Not recorded'], ['Paid at', date(attempt.paidAt)], ['Last checked', date(attempt.lastCheckedAt)], ['Provider status', attempt.providerStatus || 'Not checked']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-gray-500">{label}</dt><dd className="break-all">{value}</dd></div>)}
            </dl>
            {attempt.error && <p className="mt-3 break-words rounded-lg bg-amber-50 p-3 text-amber-900">{attempt.error}</p>}
            <button onClick={() => void check(attempt.id)} disabled={checking !== null} className="mt-3 min-h-12 rounded-lg border border-emerald-600 px-4 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">{checking === attempt.id ? 'Checking…' : attempt.status === 'completed' ? 'Check booking activation' : 'Check Waychit'}</button>
          </div>)}</div>}
      </article>)}
    {!loading && !error && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p>{total} bookings · Page {page} of {Math.max(1, Math.ceil(total / 20))}</p>
      <div className="flex gap-3"><button onClick={() => setPage(page - 1)} disabled={page <= 1} className="min-h-12 rounded-lg border border-gray-300 px-4 disabled:opacity-40">Previous</button>
        <button onClick={() => setPage(page + 1)} disabled={page * 20 >= total} className="min-h-12 rounded-lg border border-gray-300 px-4 disabled:opacity-40">Next</button></div>
    </div>}
  </div>
}

export default function AdminPaymentsPage() {
  return <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-200" aria-label="Loading payments" />}><PaymentsContent /></Suspense>
}
