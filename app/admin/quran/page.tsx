'use client'

import { useEffect, useState } from 'react'

interface QuranVerification {
  id: string
  tutor_id: string
  recitation_video_url: string | null
  tajweed_assessment: string | null
  credential_summary: string | null
  scholar_reference: string | null
  status: string | null
  created_at: string
  tutor_profiles?: { name: string | null; email: string | null } | null
}

export default function AdminQuranVerificationPage() {
  const [verifications, setVerifications] = useState<QuranVerification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState('')
  const [rejectId, setRejectId] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadVerifications() {
    setError('')
    try {
      const response = await fetch('/api/admin/quran')
      const payload = (await response.json()) as { verifications?: QuranVerification[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not load Quran queue.')
      setVerifications(payload.verifications || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load Quran queue.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadVerifications()
  }, [])

  async function updateVerification(verificationId: string, action: 'approve' | 'reject') {
    setProcessingId(verificationId)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/admin/quran', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId,
          action,
          rejectionReason: action === 'reject' ? rejectionReason : '',
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not update verification.')

      setRejectId('')
      setRejectionReason('')
      setMessage(action === 'approve' ? 'Quran verification approved.' : 'Quran verification rejected.')
      await loadVerifications()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update verification.')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Quran Verification</h1>
        <p className="text-gray-600 mt-2">Review strict Quran track submissions for diaspora online lessons.</p>
      </div>

      {message && <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>}
      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      {isLoading ? (
        <p className="text-gray-500">Loading Quran verification queue...</p>
      ) : verifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No Quran verification submissions need review.
        </div>
      ) : (
        <div className="space-y-4">
          {verifications.map((verification) => (
            <article key={verification.id} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{verification.tutor_profiles?.name || 'Tutor'}</h2>
                  <p className="text-sm text-gray-600">{verification.tutor_profiles?.email || 'No email'}</p>
                </div>
                <p className="text-sm text-gray-500">{new Date(verification.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p><span className="font-medium">Recitation:</span> {verification.recitation_video_url ? <a href={verification.recitation_video_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">Open link</a> : 'Missing'}</p>
                <p><span className="font-medium">Tajweed:</span> {verification.tajweed_assessment || 'Missing'}</p>
                <p><span className="font-medium">Credential:</span> {verification.credential_summary || 'Missing'}</p>
                <p><span className="font-medium">Reference:</span> {verification.scholar_reference || 'Missing'}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void updateVerification(verification.id, 'approve')}
                  disabled={processingId === verification.id}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processingId === verification.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectId((current) => (current === verification.id ? '' : verification.id))}
                  disabled={processingId === verification.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
              {rejectId === verification.id && (
                <div className="mt-4">
                  <input
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-red-500"
                    placeholder="Reason to show internally"
                  />
                  <button
                    type="button"
                    onClick={() => void updateVerification(verification.id, 'reject')}
                    disabled={processingId === verification.id}
                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Confirm Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
