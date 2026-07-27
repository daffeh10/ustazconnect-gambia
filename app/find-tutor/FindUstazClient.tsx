'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { matchesLocationSearch } from '@/lib/location-search'
import { matchesSubjectSearch } from '@/lib/subject-search'
import {
  formatPublicTutorName,
  isTutorPubliclyVisible,
  normalizeTutorVerificationStatus,
} from '@/lib/tutor-review'
import { buildWhatsappLink } from '@/lib/whatsapp'
import Link from 'next/link'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import VerificationBadge from '@/app/components/VerificationBadge'
import StarRating from '@/app/components/StarRating'
import Avatar from '@/app/components/Avatar'
import SearchableLocationInput from '@/app/components/SearchableLocationInput'
import SearchableSubjectInput from '@/app/components/SearchableSubjectInput'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'
import {
  normalizeTutorSubject,
  normalizeTutorSubjects,
} from '@/lib/tutor-subjects'

interface UstazProfile {
  id: string
  name: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
  bio: string | null
  available_days: string[] | null
  profile_photo_url: string | null
  offers_online?: boolean | null
  languages?: string[] | null
  verification_status?: string | null
  average_rating?: number | string | null
  review_count?: number | null
  created_at: string
}

const RECENT_VIEWED_KEY = 'rv_tutors'
const supabase = createClient()
const LEGACY_PUBLIC_TUTOR_SELECT =
  'id,name,location,subjects,experience_years,hourly_rate,bio,available_days,profile_photo_url,offers_online,verification_status,average_rating,created_at'
const ENHANCED_PUBLIC_TUTOR_SELECT =
  `${LEGACY_PUBLIC_TUTOR_SELECT},languages`

// ─── Inner component (reads URL search params) ────────────────────────────────
function FindUstazInner() {
  const searchParams = useSearchParams()

  // If the homepage passed a location in the URL (e.g. ?location=Bakau),
  // we use that as the starting value. Otherwise start empty = show all.
  const initialLocation = searchParams.get('location') || ''
  const initialSubject = searchParams.get('subject') || ''
  const initialOnlineOnly =
    DIASPORA_QURAN_ENABLED && searchParams.get('online') === '1'
  const parsedInitialMaxRate = Number(searchParams.get('maxRate'))
  const initialMaxRate =
    Number.isFinite(parsedInitialMaxRate) &&
    parsedInitialMaxRate >= 50 &&
    parsedInitialMaxRate <= 500
      ? parsedInitialMaxRate
      : 500

  const [ustazs, setUstazs] = useState<UstazProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [locationFilter, setLocationFilter] = useState(initialLocation)
  const [subjectFilter, setSubjectFilter] = useState(initialSubject)
  const [maxRate, setMaxRate] = useState(initialMaxRate)
  const [onlineOnly, setOnlineOnly] = useState(initialOnlineOnly)
  const [recentTutors, setRecentTutors] = useState<UstazProfile[]>([])

  // ── Step 1: fetch ALL tutors from Supabase once ───────────────────────────
  useEffect(() => {
    async function fetchUstazs() {
      try {
        const primaryResult = await supabase
          .from('public_tutors')
          .select(ENHANCED_PUBLIC_TUTOR_SELECT)
          .order('created_at', { ascending: false })
        let data = (primaryResult.data ?? null) as UstazProfile[] | null
        let error = primaryResult.error

        if (error) {
          const fallbackResult = await supabase
            .from('public_tutors')
            .select(LEGACY_PUBLIC_TUTOR_SELECT)
            .order('created_at', { ascending: false })

          data = (fallbackResult.data ?? null) as UstazProfile[] | null
          error = fallbackResult.error
        }

        if (error) throw error

        const tutors = ((data || []) as UstazProfile[]).filter((tutor) =>
          isTutorPubliclyVisible({
            verificationStatus: tutor.verification_status,
            createdAt: tutor.created_at,
          })
        )
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('tutor_id,rating')

        if (reviewsError) {
          // Keep search usable even if reviews table/policies are not ready yet.
          setUstazs(tutors)
          return
        }

        const ratingTotals = new Map<string, { sum: number; count: number }>()
        for (const row of reviewsData || []) {
          const tutorId = typeof row.tutor_id === 'string' ? row.tutor_id : ''
          const rating = typeof row.rating === 'number' ? row.rating : Number(row.rating)
          if (!tutorId || !Number.isFinite(rating)) continue

          const existing = ratingTotals.get(tutorId)
          if (existing) {
            existing.sum += rating
            existing.count += 1
          } else {
            ratingTotals.set(tutorId, { sum: rating, count: 1 })
          }
        }

        const enrichedTutors = tutors.map((tutor) => {
          const stats = ratingTotals.get(tutor.id)
          if (!stats || stats.count === 0) {
            return {
              ...tutor,
              review_count: 0,
            }
          }

          return {
            ...tutor,
            average_rating: Number((stats.sum / stats.count).toFixed(1)),
            review_count: stats.count,
          }
        })

        setUstazs(enrichedTutors)
      } catch (err) {
        setError('Failed to load tutors. Please try again.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUstazs()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (locationFilter.trim()) params.set('location', locationFilter.trim())
    if (subjectFilter.trim()) params.set('subject', subjectFilter.trim())
    if (maxRate < 500) params.set('maxRate', String(maxRate))
    if (onlineOnly) params.set('online', '1')

    const query = params.toString()
    window.history.replaceState({}, '', query ? `/find-tutor?${query}` : '/find-tutor')
  }, [locationFilter, maxRate, onlineOnly, subjectFilter])

  useEffect(() => {
    async function loadRecentTutors() {
      if (typeof window === 'undefined') return

      const storedIds = JSON.parse(window.localStorage.getItem(RECENT_VIEWED_KEY) || '[]')
      if (!Array.isArray(storedIds) || storedIds.length === 0) {
        setRecentTutors([])
        return
      }

      try {
        const primaryResult = await supabase
          .from('public_tutors')
          .select(ENHANCED_PUBLIC_TUTOR_SELECT)
          .in('id', storedIds)
        let data = (primaryResult.data ?? null) as UstazProfile[] | null
        let error = primaryResult.error

        if (error) {
          const fallbackResult = await supabase
            .from('public_tutors')
            .select(LEGACY_PUBLIC_TUTOR_SELECT)
            .in('id', storedIds)

          data = (fallbackResult.data ?? null) as UstazProfile[] | null
          error = fallbackResult.error
        }

        if (error) throw error

        const tutors = ((data || []) as UstazProfile[]).filter((tutor) =>
          isTutorPubliclyVisible({
            verificationStatus: tutor.verification_status,
            createdAt: tutor.created_at,
          })
        )
        const orderedTutors = storedIds
          .map((id) => tutors.find((tutor) => tutor.id === id))
          .filter((tutor): tutor is UstazProfile => Boolean(tutor))
        setRecentTutors(orderedTutors)
      } catch (err) {
        console.error(err)
        setRecentTutors([])
      }
    }

    void loadRecentTutors()
  }, [])

  // ── Step 2: filter the already-fetched list whenever a filter changes ─────
  // We compute filteredUstazs directly here — no separate useState needed.
  // React re-renders automatically whenever ustazs, locationFilter, or
  // subjectFilter changes, so this always stays up to date.
  const filteredUstazs = ustazs.filter((tutor) => {
    const locationMatch = matchesLocationSearch(tutor.location, locationFilter)

    const subjectMatch = matchesSubjectSearch(tutor.subjects, subjectFilter)

    const rateMatch = maxRate >= 500 || (tutor.hourly_rate || 0) <= maxRate
    const onlineMatch = !onlineOnly || Boolean(tutor.offers_online)

    return locationMatch && subjectMatch && rateMatch && onlineMatch
  }).sort((firstTutor, secondTutor) => {
    const normalizedSubject = normalizeTutorSubject(subjectFilter).toLowerCase()
    const normalizedLocation = locationFilter.trim().toLowerCase()
    const exactSubjectScore = (tutor: UstazProfile) =>
      normalizedSubject &&
      (tutor.subjects || []).some(
        (subject) => normalizeTutorSubject(subject).toLowerCase() === normalizedSubject
      )
        ? 1
        : 0
    const exactLocationScore = (tutor: UstazProfile) =>
      normalizedLocation && tutor.location.toLowerCase() === normalizedLocation ? 1 : 0
    const verificationScore = (tutor: UstazProfile) => {
      const status = normalizeTutorVerificationStatus(tutor.verification_status)
      if (status === 'qualification_verified') return 3
      if (status === 'profile_reviewed') return 2
      return 1
    }
    const profileScore = (tutor: UstazProfile) =>
      Number(Boolean(tutor.profile_photo_url)) +
      Number(Boolean(tutor.bio?.trim())) +
      Number((tutor.languages || []).length > 0)

    return (
      exactSubjectScore(secondTutor) - exactSubjectScore(firstTutor) ||
      exactLocationScore(secondTutor) - exactLocationScore(firstTutor) ||
      verificationScore(secondTutor) - verificationScore(firstTutor) ||
      (secondTutor.review_count || 0) - (firstTutor.review_count || 0) ||
      profileScore(secondTutor) - profileScore(firstTutor)
    )
  })

  const supportMessage = [
    'Hello TutorConnect, I need help finding a tutor.',
    subjectFilter.trim() ? `Subject: ${subjectFilter.trim()}.` : '',
    locationFilter.trim() ? `Area: ${locationFilter.trim()}.` : '',
  ].filter(Boolean).join(' ')
  const supportWhatsappLink = buildWhatsappLink(
    process.env.NEXT_PUBLIC_TUTORCONNECT_WHATSAPP,
    supportMessage
  )

  function parseAverageRating(value: number | string | null | undefined) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a Tutor</h1>
        <p className="text-gray-600 mb-8">
          Compare tutors by subject, area, price, availability, lesson format, and review level.
        </p>

        {recentTutors.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-gray-600 mb-3">Recently viewed</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentTutors.map((tutor) => (
                <div
                  key={tutor.id}
                  className="w-48 shrink-0 bg-white border border-gray-200 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={formatPublicTutorName(tutor.name)}
                      photoUrl={tutor.profile_photo_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {formatPublicTutorName(tutor.name)}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{tutor.location}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    GMD {tutor.hourly_rate?.toLocaleString() || '0'}/hour
                  </p>
                  <Link
                    href={`/tutor/${tutor.id}`}
                    className="mt-3 inline-flex min-h-12 items-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    View profile
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
          <div
            className={
              DIASPORA_QURAN_ENABLED
                ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-4'
                : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
            }
          >

            {/* Location search */}
            <div>
              <SearchableLocationInput
                label="Location"
                value={locationFilter}
                onChange={setLocationFilter}
                placeholder="Search by town or area"
              />
            </div>

            {/* Subject search */}
            <div>
              <SearchableSubjectInput
                label="Subject"
                value={subjectFilter}
                onChange={setSubjectFilter}
                placeholder="Search by subject or exam"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max hourly rate
              </label>
              <input
                type="range"
                min={50}
                max={500}
                step={50}
                value={maxRate}
                onChange={(e) => setMaxRate(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-sm text-gray-500 mt-2">
                {maxRate >= 500 ? 'Any rate' : `Up to GMD ${maxRate.toLocaleString()}`}
              </p>
            </div>

            {DIASPORA_QURAN_ENABLED && (
              <div className="flex items-end">
                <label className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-3">
                  <span className="text-sm font-medium text-gray-700">Online available</span>
                  <input
                    type="checkbox"
                    checked={onlineOnly}
                    onChange={(e) => setOnlineOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Clear button — only appears when a filter is active */}
          {(locationFilter || subjectFilter || maxRate < 500 || onlineOnly) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setLocationFilter('')
                  setSubjectFilter('')
                  setMaxRate(500)
                  setOnlineOnly(false)
                }}
                className="inline-flex min-h-12 items-center text-sm text-emerald-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading tutors">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-lg border border-gray-200 bg-white" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* ── Result count ── */}
        {!isLoading && !error && (
          <p className="text-gray-600 mb-4">
            Showing {filteredUstazs.length}{' '}
            {filteredUstazs.length === 1 ? 'tutor' : 'tutors'}
            {locationFilter && ` matching "${locationFilter.trim()}"`}
            {subjectFilter && ` for "${subjectFilter.trim()}"`}
            {onlineOnly && ' with online lessons available'}
          </p>
        )}

        {/* ── No results ── */}
        {!isLoading && !error && filteredUstazs.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600 mb-4">
              We do not have a tutor matching all these filters yet.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => {
                  setLocationFilter('')
                  setSubjectFilter('')
                  setMaxRate(500)
                  setOnlineOnly(false)
                }}
                className="inline-flex min-h-12 items-center rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-800 hover:bg-gray-50"
              >
                Clear Filters
              </button>
              {supportWhatsappLink ? (
                <a
                  href={supportWhatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
                >
                  Ask TutorConnect on WhatsApp
                </a>
              ) : (
                <a
                  href={`mailto:tutorconnectgambia@gmail.com?subject=${encodeURIComponent('Help finding a tutor')}&body=${encodeURIComponent(supportMessage)}`}
                  className="inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
                >
                  Ask TutorConnect for Help
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Tutor cards ── */}
        {!isLoading && !error && filteredUstazs.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUstazs.map((ustaz) => {
              const displaySubjects = normalizeTutorSubjects(ustaz.subjects)

              return (
                <div
                  key={ustaz.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                {/* Avatar — show photo or initial */}
                <div className="flex items-center gap-4 mb-4">
                  <Avatar
                    name={formatPublicTutorName(ustaz.name)}
                    photoUrl={ustaz.profile_photo_url}
                    size="md"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {formatPublicTutorName(ustaz.name)}
                    </h3>
                    <p className="text-sm text-gray-500">{ustaz.location}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <VerificationBadge status={ustaz.verification_status} />
                      {DIASPORA_QURAN_ENABLED && ustaz.offers_online && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          Also available online
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subjects */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {displaySubjects.slice(0, 3).map((subject) => (
                    <span
                      key={subject}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full"
                    >
                      {subject}
                    </span>
                  ))}
                  {displaySubjects.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      +{displaySubjects.length - 3} more
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  {(() => {
                    const ratingValue = parseAverageRating(ustaz.average_rating)
                    const reviewCount =
                      typeof ustaz.review_count === 'number'
                        ? ustaz.review_count
                        : null
                    const hasReviews =
                      reviewCount !== null ? reviewCount > 0 : ratingValue > 0
                    return (
                      <div className="flex items-center gap-2">
                        <StarRating rating={ratingValue} size="sm" />
                        <span className="text-sm text-gray-500">
                          {hasReviews
                            ? `${ratingValue.toFixed(1)}${
                                reviewCount !== null
                                  ? ` (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`
                                  : ''
                              }`
                            : 'No reviews yet'}
                        </span>
                      </div>
                    )
                  })()}
                  <p>
                    <span className="font-medium">Experience:</span>{' '}
                    {ustaz.experience_years >= 20
                      ? '20+ years'
                      : `${ustaz.experience_years} ${
                          ustaz.experience_years === 1 ? 'year' : 'years'
                        }`}
                  </p>
                  <p>
                    <span className="font-medium">Rate:</span>{' '}
                    GMD {ustaz.hourly_rate}/hr
                  </p>
                  {ustaz.languages && ustaz.languages.length > 0 && (
                    <p>
                      <span className="font-medium">Languages:</span>{' '}
                      {ustaz.languages.slice(0, 3).join(', ')}
                    </p>
                  )}
                </div>

                {/* Profile link */}
                <Link
                  href={`/tutor/${ustaz.id}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-center text-white transition hover:bg-emerald-700"
                >
                  View Profile
                </Link>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function FindUstazClient() {
  return <FindUstazInner />
}
