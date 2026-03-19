'use client'

import { useEffect, useState } from 'react'

interface PendingDocument {
  id: string
  tutor_id: string
  tutor_name: string
  tutor_email: string
  document_type: string
  document_name: string
  document_url: string
  signed_url: string | null
  uploaded_at: string | null
}

function formatDate(dateString: string | null) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<PendingDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [rejectId, setRejectId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [processingId, setProcessingId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDocuments() {
      try {
        const response = await fetch('/api/admin/documents')
        const payload = (await response.json()) as { documents?: PendingDocument[]; error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load documents.')
        }
        if (isMounted) {
          setDocuments(payload.documents || [])
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load documents.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadDocuments()
    return () => {
      isMounted = false
    }
  }, [])

  async function updateDocument(documentId: string, status: 'approved' | 'rejected') {
    setProcessingId(documentId)
    setError('')
    setToast('')

    try {
      const response = await fetch('/api/admin/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          status,
          rejectionReason: status === 'rejected' ? rejectReason.trim() : '',
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update document.')
      }

      setDocuments((prev) => prev.filter((document) => document.id !== documentId))
      setRejectId('')
      setRejectReason('')
      setToast(status === 'approved' ? 'Document approved.' : 'Document rejected.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update document.')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Documents</h1>
        <p className="text-gray-600 mt-2">Review verification documents submitted by tutors.</p>
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
        <p className="text-gray-500">Loading documents...</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-500">
          No pending documents right now.
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((document) => (
            <article key={document.id} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{document.tutor_name}</h2>
                  <p className="text-sm text-gray-600 mt-1">{document.tutor_email}</p>
                </div>
                <p className="text-sm text-gray-500">Uploaded {formatDate(document.uploaded_at)}</p>
              </div>

              <div className="mt-4 text-sm text-gray-700 space-y-2">
                <p><span className="font-medium">Type:</span> {document.document_type}</p>
                <p><span className="font-medium">File:</span> {document.document_name}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {document.signed_url ? (
                  <a
                    href={document.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    View Document
                  </a>
                ) : (
                  <span className="rounded-lg border border-gray-200 px-4 py-2 text-gray-400">
                    Signed URL unavailable
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void updateDocument(document.id, 'approved')}
                  disabled={processingId === document.id}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processingId === document.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectId((current) => (current === document.id ? '' : document.id))
                    setRejectReason('')
                  }}
                  disabled={processingId === document.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>

              {rejectId === document.id && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Reason for rejection"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-red-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void updateDocument(document.id, 'rejected')}
                    disabled={processingId === document.id}
                    className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {processingId === document.id ? 'Processing...' : 'Confirm Reject'}
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
