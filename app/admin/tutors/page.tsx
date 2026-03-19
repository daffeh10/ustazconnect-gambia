'use client'

import { useEffect, useState } from 'react'

interface PendingTutor {
  id: string
  name: string
  email: string
  phone: string | null
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  applied_days_ago: number
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<PendingTutor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [rejectId, setRejectId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [processingId, setProcessingId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadTutors() {
      try {
        const response = await fetch('/api/admin/tutors')
        const payload = (await response.json()) as { tutors?: PendingTutor[]; error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load tutors.')
        }
        if (isMounted) {
          setTutors(payload.tutors || [])
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load tutors.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTutors()
    return () => {
      isMounted = false
    }
  }, [])

  async function updateTutor(tutorId: string, action: 'approve' | 'reject') {
    setProcessingId(tutorId)
    setError('')
    setToast('')

    try {
      const response = await fetch('/api/admin/tutors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId,
          action,
          reason: action === 'reject' ? rejectReason.trim() : null,
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update tutor.')
      }

      setTutors((prev) => prev.filter((tutor) => tutor.id !== tutorId))
      setRejectId('')
      setRejectReason('')
      setToast(action === 'approve' ? 'Tutor approved.' : 'Tutor rejected.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update tutor.')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tutor Approvals</h1>
        <p className="text-gray-600 mt-2">Review tutor applications waiting for approval.</p>
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
        <p className="text-gray-500">Loading tutor applications...</p>
      ) : tutors.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No pending tutor applications right now.
        </div>
      ) : (
        <div className="space-y-4">
          {tutors.map((tutor) => (
            <article key={tutor.id} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{tutor.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {tutor.email} · {tutor.phone || 'No phone'} · {tutor.location || 'No location'}
                  </p>
                </div>
                <p className="text-sm text-gray-500">Applied {tutor.applied_days_ago} day{tutor.applied_days_ago === 1 ? '' : 's'} ago</p>
              </div>

              <div className="mt-4 text-sm text-gray-700 space-y-2">
                <p><span className="font-medium">Subjects:</span> {(tutor.subjects || []).join(', ') || 'None listed'}</p>
                <p><span className="font-medium">Rate:</span> D{(tutor.hourly_rate || 0).toLocaleString()}/hour</p>
                <p><span className="font-medium">Bio:</span> {(tutor.bio || 'No bio provided.').slice(0, 120)}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void updateTutor(tutor.id, 'approve')}
                  disabled={processingId === tutor.id}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processingId === tutor.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectId((current) => (current === tutor.id ? '' : tutor.id))
                    setRejectReason('')
                  }}
                  disabled={processingId === tutor.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>

              {rejectId === tutor.id && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Reason (internal note only)"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-red-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void updateTutor(tutor.id, 'reject')}
                    disabled={processingId === tutor.id}
                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {processingId === tutor.id ? 'Processing...' : 'Confirm Reject'}
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
