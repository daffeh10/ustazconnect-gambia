'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'

export default function AccountSettingsPage() {
  const [notes, setNotes] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isRequestingDelete, setIsRequestingDelete] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleExport() {
    setError('')
    setMessage('')
    setIsExporting(true)

    try {
      const response = await fetch('/api/account/export')
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not export data.')

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tutorconnect-account-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Account export prepared.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not export data.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDeleteRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsRequestingDelete(true)

    try {
      const response = await fetch('/api/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not submit request.')

      setNotes('')
      setMessage('Deletion request submitted. TutorConnect will review payment, lesson, and safety records before removal.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not submit request.')
    } finally {
      setIsRequestingDelete(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="text-sm text-emerald-700 hover:underline">Back home</Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-2 text-gray-600">Export your account data or request account deletion.</p>

        {message && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>}
        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <section className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Data Export</h2>
          <p className="mt-2 text-sm text-gray-600">Download a JSON copy of your TutorConnect account records.</p>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="mt-4 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isExporting ? 'Preparing...' : 'Export Data'}
          </button>
        </section>

        <section className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Account Deletion</h2>
          <p className="mt-2 text-sm text-gray-600">
            Submit a deletion request. TutorConnect may keep limited records where required for payment, dispute, legal, or safety reasons.
          </p>
          <form onSubmit={handleDeleteRequest} className="mt-4 space-y-4">
            <div>
              <label htmlFor="delete-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                id="delete-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional context for the deletion request"
              />
            </div>
            <button
              type="submit"
              disabled={isRequestingDelete}
              className="rounded-lg border border-red-300 bg-white px-6 py-3 font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {isRequestingDelete ? 'Submitting...' : 'Request Account Deletion'}
            </button>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}
