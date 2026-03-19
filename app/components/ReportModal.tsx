'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReportModalProps {
  reportedUserId: string
  tutorName: string
}

const REPORT_REASONS = [
  'Did not show up for the lesson',
  'Inappropriate behaviour',
  'Qualifications not as described',
  'Safety concern',
  'Other',
]

export default function ReportModal({ reportedUserId, tutorName }: ReportModalProps) {
  const [supabase] = useState(() => createClient())

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [reporterId, setReporterId] = useState('')
  const [reporterType, setReporterType] = useState('user')
  const [showModal, setShowModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!isMounted || !user) {
          setIsLoggedIn(false)
          setReporterId('')
          return
        }

        const metadataRole =
          typeof user.user_metadata?.role === 'string' && user.user_metadata.role.trim() !== ''
            ? user.user_metadata.role.trim().toLowerCase()
            : 'user'

        setIsLoggedIn(true)
        setReporterId(user.id)
        setReporterType(metadataRole)
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setIsLoggedIn(false)
          setReporterId('')
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false)
        }
      }
    }

    void loadUser()

    return () => {
      isMounted = false
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [supabase])

  function closeModal() {
    if (isSubmitting) return
    setShowModal(false)
    setReason('')
    setDetails('')
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!reporterId) {
      setError('Please sign in before submitting a report.')
      return
    }

    if (!reason) {
      setError('Please select a reason before submitting.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const { error: insertError } = await supabase.from('reports').insert([
        {
          reporter_id: reporterId,
          reporter_type: reporterType,
          reported_user_id: reportedUserId,
          reason,
          details: details.trim() || null,
        },
      ])

      if (insertError) throw insertError

      setShowModal(false)
      setReason('')
      setDetails('')
      setShowToast(true)

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false)
      }, 4000)
    } catch (err) {
      console.error(err)
      const message =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message.toLowerCase()
          : ''
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code.toLowerCase()
          : ''

      if (
        code === '42p01' ||
        code === 'pgrst205' ||
        message.includes('does not exist') ||
        message.includes('could not find the table')
      ) {
        setError('Reporting is not configured yet. Please create the reports table in Supabase first.')
      } else if (
        code === '42501' ||
        message.includes('row-level security') ||
        message.includes('permission denied')
      ) {
        setError('Report submission is blocked by database permissions. Please re-check the reports policy in Supabase.')
      } else {
        setError('Could not submit your report. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCheckingAuth || !isLoggedIn) {
    return null
  }

  return (
    <>
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Report a problem
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md mx-auto mt-20 md:mt-32">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Report {tutorName}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close report form"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="report-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select a reason...</option>
                  {REPORT_REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-details" className="block text-sm font-medium text-gray-700 mb-1">
                  Details
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Describe what happened (optional)"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          Report submitted. We will review within 24 hours.
        </div>
      )}
    </>
  )
}
