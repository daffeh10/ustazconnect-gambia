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

const PREVIEW_LABELS: Record<string, string> = {
  request_changes: 'what is missing',
  approve: 'approval',
  reject: 'rejection',
  vouch: 'my-authority approval',
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

  return tutor.has_profile_photo && tutor.has_review_document
    ? 'You can approve this tutor as Basic now. Their photo and review document are on file; approving the document itself upgrades their public label.'
    : 'You can approve this tutor as Basic now. A photo and review documents are not required for a Basic listing, but they are what lifts the tutor above the Basic label.'
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<PendingTutor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<
    { tutorId: string; to: string; subject: string; text: string; usesYourNote: boolean } | null
  >(null)
  const [processingId, setProcessingId] = useState('')
  const [canVouch, setCanVouch] = useState(false)
  const [emailConfigured, setEmailConfigured] = useState(true)
  const [vouchLevel, setVouchLevel] = useState<Record<string, string>>({})

  const noteFor = (tutorId: string) => notes[tutorId] || ''

  async function loadTutors() {
    try {
      const response = await fetch('/api/admin/tutors')
      const payload = (await response.json()) as {
          tutors?: PendingTutor[]
          canVouch?: boolean
          emailConfigured?: boolean
          error?: string
        }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not load tutors.')
      }
      setTutors(payload.tutors || [])
      setCanVouch(Boolean(payload.canVouch))
      setEmailConfigured(payload.emailConfigured !== false)
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
        const payload = (await response.json()) as {
          tutors?: PendingTutor[]
          canVouch?: boolean
          emailConfigured?: boolean
          error?: string
        }
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load tutors.')
        }
        if (isMounted) {
          setTutors(payload.tutors || [])
          setCanVouch(Boolean(payload.canVouch))
          setEmailConfigured(payload.emailConfigured !== false)
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

  async function previewEmail(tutorId: string, previewAction: string) {
    setError('')
    setToast('')

    try {
      const response = await fetch('/api/admin/tutors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId,
          action: 'preview',
          previewAction,
          reason: noteFor(tutorId).trim() || null,
          verificationStatus: vouchLevel[tutorId] || 'qualification_verified',
        }),
      })
      const payload = (await response.json()) as {
        preview?: { to: string; subject: string; text: string; usesYourNote: boolean }
        error?: string
      }

      if (!response.ok || !payload.preview) {
        throw new Error(payload.error || 'Could not build the preview.')
      }

      setPreview({ tutorId, ...payload.preview })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not build the preview.')
    }
  }

  async function updateTutor(
    tutorId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'vouch'
  ) {
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
          // Every action now carries the admin's note; approve used to drop it
          // silently, which sent stock text the admin thought they had replaced.
          reason: noteFor(tutorId).trim() || null,
          verificationStatus:
            action === 'vouch' ? vouchLevel[tutorId] || 'qualification_verified' : undefined,
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

      setNotes((current) => ({ ...current, [tutorId]: '' }))
      setPreview(null)
      await loadTutors()
      const emailNote = payload.email_sent === false ? ' (email NOT sent — check email setup)' : ''

      if (action === 'vouch') {
        setToast(
          'Tutor approved on your personal knowledge and recorded in the audit log.' + emailNote
        )
      } else if (action === 'request_changes') {
        setToast(
          payload.email_sent
            ? `Emailed ${payload.blockers?.length ?? 0} missing item${payload.blockers?.length === 1 ? '' : 's'} to the tutor.`
            : 'Could not send the email. Check the tutor has an email address, and that RESEND_API_KEY is set.'
        )
      } else if (action === 'approve') {
        setToast(
          (payload.approval_outcome === 'basic' ? 'Tutor approved as Basic.' : 'Tutor approved.') +
            emailNote
        )
      } else {
        setToast('Tutor rejected.' + emailNote)
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

      <div className="mb-6 flex justify-end">
        <a
          href="/api/admin/email-test"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Test email delivery
        </a>
      </div>

      {!emailConfigured && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="font-medium">Email is not configured, so no tutor is being notified.</p>
          <p className="mt-1 text-sm">
            RESEND_API_KEY is missing on the server. Approvals, rejections and
            &ldquo;email what is missing&rdquo; will all complete silently without
            sending anything. Add the key in the Vercel project settings and redeploy.
          </p>
        </div>
      )}
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
                  onClick={() => document.getElementById(`message-${tutor.id}`)?.focus()}
                  disabled={processingId === tutor.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>

              {canVouch && !tutor.is_approved && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-900">
                    Approve on your personal knowledge
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Use this when you know the tutor&apos;s qualifications first hand and
                    they have not uploaded documents. Write how you know in the message
                    box below — it is required, and it is kept in the audit log as the
                    only record of why this tutor carries the badge.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <label htmlFor={`vouch-${tutor.id}`} className="sr-only">
                      Verification level
                    </label>
                    <select
                      id={`vouch-${tutor.id}`}
                      value={vouchLevel[tutor.id] || 'qualification_verified'}
                      onChange={(event) =>
                        setVouchLevel((current) => ({
                          ...current,
                          [tutor.id]: event.target.value,
                        }))
                      }
                      className="min-h-12 rounded-lg border border-emerald-300 bg-white px-4 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="qualification_verified">Qualification Verified</option>
                      <option value="profile_reviewed">Profile Reviewed</option>
                      <option value="basic">Basic</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void updateTutor(tutor.id, 'vouch')}
                      disabled={processingId === tutor.id || !noteFor(tutor.id).trim()}
                      className="min-h-12 rounded-lg bg-emerald-700 px-4 font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {processingId === tutor.id ? 'Processing...' : 'Approve on my authority'}
                    </button>
                  </div>
                </div>
              )}

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
                    value={noteFor(tutor.id)}
                    onChange={(event) => {
                      const value = event.target.value
                      setNotes((current) => ({ ...current, [tutor.id]: value }))
                      setPreview(null)
                    }}
                    placeholder="e.g. Your hourly rate is above the GMD 400 maximum. Please lower it and we will review again."
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Included word for word in whichever email you send. Required to
                    reject, and required to approve on your own authority — where it is
                    also stored in the audit log.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['request_changes', 'approve', 'reject', 'vouch'] as const)
                      .filter((previewAction) => previewAction !== 'vouch' || canVouch)
                      .map((previewAction) => (
                        <button
                          key={previewAction}
                          type="button"
                          onClick={() => void previewEmail(tutor.id, previewAction)}
                          disabled={processingId === tutor.id}
                          className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          Preview {PREVIEW_LABELS[previewAction]} email
                        </button>
                      ))}
                  </div>

                  {preview?.tutorId === tutor.id && (
                    <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 p-4">
                      <p className="text-sm text-gray-600">
                        To: <span className="font-medium text-gray-900">{preview.to}</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Subject:{' '}
                        <span className="font-medium text-gray-900">{preview.subject}</span>
                      </p>
                      {!preview.usesYourNote && (
                        <p className="mt-2 text-sm text-amber-800">
                          Your message box is empty, so this email contains only the
                          standard text below.
                        </p>
                      )}
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-800">
                        {preview.text}
                      </pre>
                      <p className="mt-2 text-xs text-gray-600">
                        This is exactly what the tutor receives. Edit the message above
                        and preview again, or use the buttons on this card to send.
                      </p>
                    </div>
                  )}

                  {noteFor(tutor.id).trim() && (
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
