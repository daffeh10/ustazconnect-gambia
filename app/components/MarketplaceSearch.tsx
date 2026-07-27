'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SearchableLocationInput from '@/app/components/SearchableLocationInput'
import SearchableSubjectInput from '@/app/components/SearchableSubjectInput'
import { trackFunnelEvent } from '@/lib/funnel'

export default function MarketplaceSearch() {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [location, setLocation] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const searchParams = new URLSearchParams()
    if (subject.trim()) searchParams.set('subject', subject.trim())
    if (location.trim()) searchParams.set('location', location.trim())

    const query = searchParams.toString()
    trackFunnelEvent('marketplace_search', {
      mode: 'in_person',
      subject: subject.trim(),
      location: location.trim(),
    })
    router.push(query ? `/find-tutor?${query}` : '/find-tutor')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="grid gap-1 md:grid-cols-2">
        <SearchableSubjectInput
          label="Subject"
          value={subject}
          onChange={setSubject}
          placeholder="Maths, Quran, WASSCE..."
        />
        <SearchableLocationInput
          label="Area"
          value={location}
          onChange={setLocation}
          placeholder="Bakau, Brikama, Sukuta..."
        />
      </div>

      <button
        type="submit"
        className="mt-1 min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        Search Tutors
      </button>
    </form>
  )
}
