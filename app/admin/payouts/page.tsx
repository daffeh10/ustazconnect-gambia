'use client'

import { useEffect, useState } from 'react'

interface PendingPayout {
  id: string
  tutor_name: string
  tutor_phone: string
  amount: number
  lessons_count: number | null
  requested_at: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PendingPayout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [selectedPayout, setSelectedPayout] = useState<PendingPayout | null>(null)
  const [waveReference, setWaveReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadPayouts() {
      try {
        const response = await fetch('/api/admin/payouts')
        const payload = (await response.json()) as { payouts?: PendingPayout[]; error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load payouts.')
        }
        if (isMounted) {
          setPayouts(payload.payouts || [])
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load payouts.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadPayouts()
    return () => {
      isMounted = false
    }
  }, [])

  async function markPaid() {
    if (!selectedPayout || !waveReference.trim()) return

    setIsSubmitting(true)
    setError('')
    setToast('')

    try {
      const response = await fetch('/api/admin/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId: selectedPayout.id,
          waveReference: waveReference.trim(),
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not mark payout as paid.')
      }

      setPayouts((prev) => prev.filter((payout) => payout.id !== selectedPayout.id))
      setSelectedPayout(null)
      setWaveReference('')
      setToast('Payout marked as paid.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not mark payout as paid.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Payouts</h1>
        <p className="text-gray-600 mt-2">Review tutor payout requests and mark them paid after sending Wave transfers.</p>
      </div>

      {toast && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading payouts...</p>
      ) : payouts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No pending payout requests right now.
        </div>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <article key={payout.id} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{payout.tutor_name}</h2>
                  <p className="text-sm text-gray-600 mt-1">{payout.tutor_phone}</p>
                </div>
                <p className="text-sm text-gray-500">{formatDate(payout.requested_at)}</p>
              </div>

              <div className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-gray-500">Amount</p>
                  <p className="font-semibold text-gray-900">D{payout.amount.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-gray-500">Lessons</p>
                  <p className="font-semibold text-gray-900">{payout.lessons_count || 0}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-gray-500">Status</p>
                  <p className="font-semibold text-amber-700">Pending</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedPayout(payout)
                  setWaveReference('')
                }}
                className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Mark as Paid
              </button>
            </article>
          ))}
        </div>
      )}

      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Mark payout paid</h2>
            <p className="text-sm text-gray-600 mt-2">
              Enter the Wave reference for {selectedPayout.tutor_name}&apos;s payout.
            </p>

            <input
              type="text"
              value={waveReference}
              onChange={(event) => setWaveReference(event.target.value)}
              placeholder="Wave reference"
              className="mt-5 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void markPaid()}
                disabled={isSubmitting || !waveReference.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
