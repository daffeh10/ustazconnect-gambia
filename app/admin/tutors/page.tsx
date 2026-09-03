'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getTutorDocumentTypeLabel } from '@/lib/tutor-review'
import { normalizeTutorSubjects } from '@/lib/tutor-subjects'

interface PendingTutor {
  id: string
  name: string
  email: string
  phone: string | null
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  is_approved: boolean | null
  is_test_account: boolean | null
  applied_days_ago: number
  has_profile_photo: boolean
  has_review_document: boolean
  approval_blockers: string[]
  review_path: 'qualification_verified' | 'profile_reviewed' | null
  approval_outcome: 'basic' | 'qualification_verified' | 'profile_reviewed'
  can_approve: boolean
  document_statuses: Array<{
    document_type: string
    document_label?: string
    status: string
  }>
}

function formatReviewPath(reviewPath: PendingTutor['review_path']) {
  if (reviewPath === 'qualification_verified') return 'Qualification Verified'
  if (reviewPath === 'profile_reviewed') return 'Profile Reviewed'
  return 'More evidence needed'
}

function formatApprovalOutcome(approvalOutcome: PendingTutor['approval_outcome']) {
  if (approvalOutcome === 'qualification_verified') return 'Qualification Verified'
  if (approvalOutcome === 'profile_reviewed') return 'Profile Reviewed'
  return 'Basic'
}

function formatDocumentStatus(status: string) {
  const normalized = status.toLowerCase().trim()
  if (normalized === 'approved') return 'Approved'
  if (normalized === 'rejected') return 'Rejected'
  return 'Pending'
}

function getApprovalBlocker(tutor: PendingTutor) {
  const missingItems = tutor.approval_blockers ?? []

  if (missingItems.length === 0) {
    return 'This tutor still needs a complete public profile before approval.'
  }

  return `Cannot be listed publicly yet. Still missing: ${missingItems.join(', ')}.`
}

function getFollowUpMessage(tutor: PendingTutor) {
  if (tutor.approval_outcome !== 'basic') {
    return 'This tutor is ready to be approved with a stronger public trust label.'
  }

  if (tutor.is_approved) {
    return 'This tutor is already live as Basic. Keep them here until their documents are approved and they are ready for an upgrade.'
  }

  return 'You can approve this tutor as Basic now. Their photo and review document are on file; approving the document itself upgrades their public label.'
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<PendingTutor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [rejectId, setRejectId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [processingId, setProcessingId] = useState('')

  async function loadTutors() {
    try {
      const response = await fetch('/api/admin/tutors')
      const payload = (await response.json()) as { tutors?: PendingTutor[]; error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not load tutors.')
      }
      setTutors(payload.tutors || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load tutors.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadTutorsSafely() {
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

    void loadTutorsSafely()
    return () => {
      isMounted = false
    }
  }, [])

  async function updateTutor(tutorId: string, action: 'approve' | 'reject' | 'request_changes') {
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
          reason: action === 'approve' ? null : rejectReason.trim() || null,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        approval_outcome?: PendingTutor['approval_outcome']
        blockers?: string[]
        email_sent?: boolean
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update tutor.')
      }

      setRejectId('')
      setRejectReason('')
      await loadTutors()
      if (action === 'request_changes') {
        setToast(
          payload.email_sent
            ? `Emailed ${payload.blockers?.length ?? 0} missing item${payload.blockers?.length === 1 ? '' : 's'} to the tutor.`
            : 'Could not send the email. Check the tutor has a valid email address.'
        )
      } else if (action === 'approve') {
        setToast(
          payload.approval_outcome === 'basic'
            ? 'Tutor approved as Basic.'
            : 'Tutor approved.'
        )
      } else {
        setToast('Tutor rejected.')
      }
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tutor Reviews</h1>
            <p className="text-gray-600 mt-2">Approve new tutors and follow up on live Basic tutors who still need stronger verification.</p>
          </div>
          <Link
            href="/admin/documents"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Review Documents
          </Link>
        </div>
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
          No tutor reviews need action right now.
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
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    Applied {tutor.applied_days_ago} day{tutor.applied_days_ago === 1 ? '' : 's'} ago
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-700">
                    {tutor.is_test_account
                      ? 'Hidden test account'
                      : tutor.is_approved
                        ? 'Live as Basic'
                        : 'Pending approval'}
                  </p>
                  {tutor.is_test_account && (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      Internal testing only
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-700 space-y-2">
                <p>
                  <span className="font-medium">Subjects:</span>{' '}
                  {normalizeTutorSubjects(tutor.subjects).join(', ') || 'None listed'}
                </p>
                <p><span className="font-medium">Rate:</span> GMD {(tutor.hourly_rate || 0).toLocaleString()}/hour</p>
                <p><span className="font-medium">Bio:</span> {(tutor.bio || 'No bio provided.').slice(0, 120)}</p>
                <p><span className="font-medium">Profile photo:</span> {tutor.has_profile_photo ? 'Uploaded' : 'Missing'}</p>
                <p><span className="font-medium">Review path:</span> {formatReviewPath(tutor.review_path)}</p>
                <p><span className="font-medium">Approval outcome:</span> {formatApprovalOutcome(tutor.approval_outcome)}</p>
                {tutor.document_statuses.length > 0 ? (
                  <p>
                    <span className="font-medium">Documents:</span>{' '}
                    {tutor.document_statuses
                      .map((document) =>
                        `${document.document_label || getTutorDocumentTypeLabel(document.document_type)} (${formatDocumentStatus(document.status)})`
                      )
                      .join(', ')}
                  </p>
                ) : (
                  <p><span className="font-medium">Documents:</span> No review documents uploaded yet.</p>
                )}
              </div>

              {!tutor.can_approve ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {getApprovalBlocker(tutor)}{' '}
                  <Link href="/admin/documents" className="font-medium underline underline-offset-2">
                    Open Documents
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  {getFollowUpMessage(tutor)}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void updateTutor(tutor.id, 'approve')}
                  disabled={processingId === tutor.id || !tutor.can_approve}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processingId === tutor.id
                    ? 'Processing...'
                    : tutor.is_approved
                      ? 'Upgrade status'
                      : tutor.approval_outcome === 'basic'
                        ? 'Approve as Basic'
                        : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => void updateTutor(tutor.id, 'request_changes')}
                  disabled={processingId === tutor.id}
                  className="rounded-lg border border-sky-300 px-4 py-2 text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                >
                  Email what is missing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectId(tutor.id)
                    document.getElementById(`message-${tutor.id}`)?.focus()
                  }}
                  disabled={processingId === tutor.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>

              {!tutor.is_approved && (
                <div className="mt-4">
                  <label
                    htmlFor={`message-${tutor.id}`}
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Message to the tutor
                  </label>
                  <textarea
                    id={`message-${tutor.id}`}
                    rows={2}
                    value={rejectId === tutor.id ? rejectReason : ''}
                    onFocus={() => setRejectId(tutor.id)}
                    onChange={(event) => {
                      setRejectId(tutor.id)
                      setRejectReason(event.target.value)
                    }}
                    placeholder="e.g. Your hourly rate is above the GMD 400 maximum. Please lower it and we will review again."
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Sent to the tutor word for word. Optional when emailing what is
                    missing; required to reject.
                  </p>
                  {rejectId === tutor.id && rejectReason.trim() && (
                    <button
                      type="button"
                      onClick={() => void updateTutor(tutor.id, 'reject')}
                      disabled={processingId === tutor.id}
                      className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {processingId === tutor.id ? 'Processing...' : 'Confirm Reject'}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
