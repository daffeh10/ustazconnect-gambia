'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SearchableLocationInput from '@/app/components/SearchableLocationInput'
import SearchableSubjectInput from '@/app/components/SearchableSubjectInput'
import { trackFunnelEvent } from '@/lib/funnel'
import { QURAN_READING_WITH_TAJWEED } from '@/lib/tutor-subjects'

type SearchMode = 'in_person' | 'online_quran'

const POPULAR_SUBJECTS = [
  { label: 'Maths', value: 'General Mathematics' },
  { label: 'Biology', value: 'Biology' },
  { label: 'Quran with Tajweed', value: QURAN_READING_WITH_TAJWEED },
]

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
      className="border border-gray-300 bg-white p-4 shadow-sm md:p-5"
    >
      <fieldset>
        <legend className="sr-only">Choose a tutoring service</legend>
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => {
              setMode('in_person')
              trackFunnelEvent('service_selected', { mode: 'in_person' })
            }}
            aria-pressed={mode === 'in_person'}
            className={`min-h-12 border-b-4 px-2 py-3 text-left text-sm font-semibold transition-colors sm:px-4 sm:text-base ${
              mode === 'in_person'
                ? 'border-emerald-700 text-gray-950'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            In person in The Gambia
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('online_quran')
              trackFunnelEvent('service_selected', { mode: 'online_quran' })
            }}
            aria-pressed={mode === 'online_quran'}
            className={`min-h-12 border-b-4 px-2 py-3 text-left text-sm font-semibold transition-colors sm:px-4 sm:text-base ${
              mode === 'online_quran'
                ? 'border-sky-700 text-gray-950'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Online Quran
          </button>
        </div>
      </fieldset>

      {mode === 'in_person' ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <SearchableSubjectInput
              label="What do you need help with?"
              value={subject}
              onChange={setSubject}
              placeholder="Maths, Quran, exams"
              variant="homepage"
            />
            <SearchableLocationInput
              label="Where should lessons happen?"
              value={location}
              onChange={setLocation}
              placeholder="Town or area"
              variant="homepage"
            />
            <button
              type="submit"
              className="min-h-12 self-end rounded-sm bg-emerald-700 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              See Tutors
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Often searched:</span>
            {POPULAR_SUBJECTS.map((popularSubject) => (
              <button
                key={popularSubject.value}
                type="button"
                onClick={() => setSubject(popularSubject.value)}
                className="min-h-8 border-b border-transparent text-left hover:border-emerald-700 hover:text-emerald-800"
              >
                {popularSubject.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5">
          <div className="border-l-4 border-sky-700 bg-sky-50 px-4 py-4 text-left">
            <p className="font-semibold text-sky-950">Gambian Quran teachers for families abroad</p>
            <p className="mt-1 text-sm leading-6 text-sky-900">
              Compare teachers reviewed for Quran Reading with Tajweed, Hifz
              (Quran memorisation), Arabic Language, and Islamic Studies.
            </p>
          </div>
          <button
            type="submit"
            className="mt-4 min-h-12 w-full rounded-sm bg-sky-800 px-6 py-3 font-bold text-white transition-colors hover:bg-sky-900 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
          >
            View Quran Tutors
          </button>
        </div>
      )}
    </form>
  )
}
