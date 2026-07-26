'use client'

import { FormEvent, useState } from 'react'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'

export default function ReferralsPage() {
  const [referredName, setReferredName] = useState('')
  const [referredContact, setReferredContact] = useState('')
  const [referredType, setReferredType] = useState<'family' | 'tutor'>('family')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referredName, referredContact, referredType }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not submit referral.')

      setReferredName('')
      setReferredContact('')
      setReferredType('family')
      setMessage('Referral submitted.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not submit referral.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Refer Someone</h1>
        <p className="mt-2 text-gray-600">Refer a family or tutor to TutorConnect Gambia.</p>

        {message && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>}
        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="referral-type" className="block text-sm font-medium text-gray-700 mb-1">Referral type</label>
            <select id="referral-type" value={referredType} onChange={(event) => setReferredType(event.target.value as 'family' | 'tutor')} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500">
              <option value="family">Family</option>
              <option value="tutor">Tutor</option>
            </select>
          </div>
          <div>
            <label htmlFor="referred-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input id="referred-name" maxLength={120} required value={referredName} onChange={(event) => setReferredName(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="referred-contact" className="block text-sm font-medium text-gray-700 mb-1">Phone or email</label>
            <input id="referred-contact" maxLength={200} required value={referredContact} onChange={(event) => setReferredContact(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {isSubmitting ? 'Submitting...' : 'Submit Referral'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
