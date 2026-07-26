'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SearchableLocationInput from '@/app/components/SearchableLocationInput'
import SearchableSubjectInput from '@/app/components/SearchableSubjectInput'
import { trackFunnelEvent } from '@/lib/funnel'

type SearchMode = 'in_person' | 'online_quran'

export default function MarketplaceSearch() {
  const router = useRouter()
  const [mode, setMode] = useState<SearchMode>('in_person')
  const [subject, setSubject] = useState('')
  const [location, setLocation] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (mode === 'online_quran') {
      trackFunnelEvent('marketplace_search', { mode })
      router.push('/online-quran#quran-tutors')
      return
    }

    const searchParams = new URLSearchParams()
    if (subject.trim()) searchParams.set('subject', subject.trim())
    if (location.trim()) searchParams.set('location', location.trim())

    const query = searchParams.toString()
    trackFunnelEvent('marketplace_search', {
      mode,
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
      <fieldset>
        <legend className="sr-only">Choose a tutoring service</legend>
        <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('in_person')
              trackFunnelEvent('service_selected', { mode: 'in_person' })
            }}
            aria-pressed={mode === 'in_person'}
            className={`min-h-12 rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:text-base ${
              mode === 'in_person'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            In-person tutoring
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('online_quran')
              trackFunnelEvent('service_selected', { mode: 'online_quran' })
            }}
            aria-pressed={mode === 'online_quran'}
            className={`min-h-12 rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:text-base ${
              mode === 'online_quran'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Online Quran
          </button>
        </div>
      </fieldset>

      {mode === 'in_person' ? (
        <div className="mt-5 grid gap-1 md:grid-cols-2">
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
      ) : (
        <div className="mt-5 border-l-4 border-sky-500 bg-sky-50 px-4 py-3 text-left">
          <p className="font-medium text-sky-950">Online Quran for Gambians abroad</p>
          <p className="mt-1 text-sm text-sky-900">
            Browse teachers reviewed for Quran Reading, Tajweed, Hifz, Arabic, and Islamic Studies.
          </p>
        </div>
      )}

      <button
        type="submit"
        className="mt-1 min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {mode === 'online_quran' ? 'View Quran Tutors' : 'Search Tutors'}
      </button>
    </form>
  )
}
