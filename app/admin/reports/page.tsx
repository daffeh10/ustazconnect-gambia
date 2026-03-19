'use client'

import { useEffect, useState } from 'react'

interface ReportRow {
  id: string
  reporter_type: string
  reason: string
  details: string | null
  status: string | null
  admin_notes: string | null
  created_at: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { status: string; adminNotes: string }>>({})
  const [processingId, setProcessingId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadReports() {
      try {
        const response = await fetch('/api/admin/reports')
        const payload = (await response.json()) as { reports?: ReportRow[]; error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load reports.')
        }

        if (isMounted) {
          const rows = payload.reports || []
          setReports(rows)
          setDrafts(
            rows.reduce<Record<string, { status: string; adminNotes: string }>>((acc, report) => {
              acc[report.id] = {
                status: report.status || 'pending',
                adminNotes: report.admin_notes || '',
              }
              return acc
            }, {})
          )
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load reports.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadReports()
    return () => {
      isMounted = false
    }
  }, [])

  async function saveReport(reportId: string) {
    const draft = drafts[reportId]
    if (!draft) return

    setProcessingId(reportId)
    setError('')
    setToast('')

    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status: draft.status,
          adminNotes: draft.adminNotes,
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update report.')
      }

      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, status: draft.status, admin_notes: draft.adminNotes || null }
            : report
        )
      )
      setToast('Report updated.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update report.')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-2">Review issues submitted by families and tutors.</p>
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
        <p className="text-gray-500">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No reports submitted yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const draft = drafts[report.id] || { status: report.status || 'pending', adminNotes: report.admin_notes || '' }
            return (
              <article key={report.id} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{report.reason}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.reporter_type} · {formatDate(report.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 capitalize">
                    {report.status || 'pending'}
                  </span>
                </div>

                {report.details && (
                  <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{report.details}</p>
                )}

                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [report.id]: { ...draft, status: event.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin notes</label>
                    <textarea
                      value={draft.adminNotes}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [report.id]: { ...draft, adminNotes: event.target.value },
                        }))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void saveReport(report.id)}
                  disabled={processingId === report.id}
                  className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processingId === report.id ? 'Saving...' : 'Save'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
