'use client'

import { FormEvent, useEffect, useState } from 'react'

interface QuranVerificationPanelProps {
  canShow: boolean
}

interface QuranVerification {
  status: string | null
  rejection_reason: string | null
}

export default function QuranVerificationPanel({ canShow }: QuranVerificationPanelProps) {
  const [verification, setVerification] = useState<QuranVerification | null>(null)
  const [recitationVideoUrl, setRecitationVideoUrl] = useState('')
  const [tajweedAssessment, setTajweedAssessment] = useState('')
  const [credentialSummary, setCredentialSummary] = useState('')
  const [scholarReference, setScholarReference] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!canShow) return
    let isMounted = true

    async function loadVerification() {
      setIsLoading(true)
      try {
        const response = await fetch('/api/quran-verification')
        const payload = (await response.json()) as { verification?: QuranVerification | null; error?: string }
        if (!response.ok) {
          throw new Error(payload.error || 'Could not load Quran verification.')
        }
        if (isMounted) setVerification(payload.verification || null)
      } catch (err) {
        console.error(err)
        if (isMounted) setError(err instanceof Error ? err.message : 'Could not load Quran verification.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadVerification()
    return () => {
      isMounted = false
    }
  }, [canShow])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/quran-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recitationVideoUrl,
          tajweedAssessment,
          credentialSummary,
          scholarReference,
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not submit verification.')
      setMessage('Quran verification submitted for review.')
      setVerification({ status: 'pending', rejection_reason: null })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not submit verification.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!canShow) return null

  return (
    <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900">Diaspora Quran Verification</h2>
      <p className="mt-1 text-sm text-gray-600">
        Required before a Quran tutor can be promoted for diaspora online lessons.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-500">Loading Quran verification...</p>
      ) : verification ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          Current status: <span className="font-medium">{verification.status || 'pending'}</span>
          {verification.rejection_reason && <p className="mt-2 text-red-700">{verification.rejection_reason}</p>}
        </div>
      ) : null}

      {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!verification || verification.status === 'rejected' ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="recitation-video" className="block text-sm font-medium text-gray-700 mb-1">Recitation video link</label>
            <input id="recitation-video" value={recitationVideoUrl} onChange={(event) => setRecitationVideoUrl(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" placeholder="Private YouTube, Drive, or similar review link" />
          </div>
          <div>
            <label htmlFor="tajweed-assessment" className="block text-sm font-medium text-gray-700 mb-1">Tajweed assessment notes</label>
            <textarea id="tajweed-assessment" value={tajweedAssessment} onChange={(event) => setTajweedAssessment(event.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="credential-summary" className="block text-sm font-medium text-gray-700 mb-1">Ijazah, sanad, or madrasa credential</label>
            <textarea id="credential-summary" value={credentialSummary} onChange={(event) => setCredentialSummary(event.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="scholar-reference" className="block text-sm font-medium text-gray-700 mb-1">Scholar/reference contact</label>
            <input id="scholar-reference" value={scholarReference} onChange={(event) => setScholarReference(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {isSubmitting ? 'Submitting...' : 'Submit Quran Verification'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
