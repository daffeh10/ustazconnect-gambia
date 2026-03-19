'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { LOCATION_REGIONS, SUBJECT_CATEGORIES } from '@/lib/constants'
import Link from 'next/link'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import VerificationBadge from '@/app/components/VerificationBadge'
import StarRating from '@/app/components/StarRating'

interface UstazProfile {
  id: string
  name: string
  phone: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
  bio: string | null
  available_days: string[] | null
  profile_photo_url: string | null
  verification_status?: string | null
  average_rating?: number | string | null
  review_count?: number | null
}

const RECENT_VIEWED_KEY = 'rv_tutors'

// ─── Inner component (reads URL search params) ────────────────────────────────
function FindUstazInner() {
  const searchParams = useSearchParams()

  // If the homepage passed a location in the URL (e.g. ?location=Bakau),
  // we use that as the starting value. Otherwise start empty = show all.
  const initialLocation = searchParams.get('location') || ''

  const [ustazs, setUstazs] = useState<UstazProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [locationFilter, setLocationFilter] = useState(initialLocation)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [maxRate, setMaxRate] = useState(500)
  const [recentTutors, setRecentTutors] = useState<UstazProfile[]>([])

  // ── Step 1: fetch ALL tutors from Supabase once ───────────────────────────
  useEffect(() => {
    async function fetchUstazs() {
      try {
        const { data, error } = await supabase
          .from('tutor_profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        const tutors = (data || []) as UstazProfile[]
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
    async function loadRecentTutors() {
      if (typeof window === 'undefined') return

      const storedIds = JSON.parse(window.localStorage.getItem(RECENT_VIEWED_KEY) || '[]')
      if (!Array.isArray(storedIds) || storedIds.length === 0) {
        setRecentTutors([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('tutor_profiles')
          .select('*')
          .in('id', storedIds)

        if (error) throw error

        const tutors = (data || []) as UstazProfile[]
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
  const filteredUstazs = ustazs.filter((u) => {
    // Location: if no filter chosen, every tutor passes.
    // .toLowerCase().trim() means "Bakau", "bakau", " Bakau " all match.
    const locationMatch =
      locationFilter === '' ||
      (u.location || '').toLowerCase().trim() ===
        locationFilter.toLowerCase().trim()

    // Subject: if no filter chosen, every tutor passes.
    // .some() checks each subject in the array one by one.
    const subjectMatch =
      subjectFilter === '' ||
      (u.subjects || []).some(
        (s) =>
          s.toLowerCase().trim() === subjectFilter.toLowerCase().trim()
      )

    const rateMatch = maxRate >= 500 || (u.hourly_rate || 0) <= maxRate

    return locationMatch && subjectMatch && rateMatch
  })

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
          Browse our verified tutors and find the perfect match for your family.
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
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      {tutor.profile_photo_url ? (
                        <Image
                          src={tutor.profile_photo_url}
                          alt={`${tutor.name} photo`}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-emerald-700 font-bold text-lg">
                          {tutor.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{tutor.name}</p>
                      <p className="text-sm text-gray-500 truncate">{tutor.location}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    D{tutor.hourly_rate?.toLocaleString() || '0'}/hour
                  </p>
                  <Link
                    href={`/ustaz/${tutor.id}`}
                    className="inline-block mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
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
          <div className="grid md:grid-cols-3 gap-4">

            {/* Location dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {/* Empty value = "show all" */}
                <option value="">All Locations</option>
                {LOCATION_REGIONS.map((region) => (
                  <optgroup key={region.region} label={region.region}>
                    {region.locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Subject dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Subjects</option>
                {SUBJECT_CATEGORIES.map((category) => (
                  <optgroup key={category.category} label={category.category}>
                    {category.subjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
                {maxRate >= 500 ? 'Any rate' : `Up to D${maxRate}`}
              </p>
            </div>
          </div>

          {/* Clear button — only appears when a filter is active */}
          {(locationFilter || subjectFilter || maxRate < 500) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setLocationFilter('')
                  setSubjectFilter('')
                  setMaxRate(500)
                }}
                className="text-sm text-emerald-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading tutors...</p>
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
            {locationFilter && ` in ${locationFilter}`}
            {subjectFilter && ` for ${subjectFilter}`}
          </p>
        )}

        {/* ── No results ── */}
        {!isLoading && !error && filteredUstazs.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-4">
              No tutors found matching your criteria.
            </p>
            <button
              onClick={() => {
                setLocationFilter('')
                setSubjectFilter('')
                setMaxRate(500)
              }}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Clear filters and show all
            </button>
          </div>
        )}

        {/* ── Tutor cards ── */}
        {!isLoading && !error && filteredUstazs.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUstazs.map((ustaz) => (
              <div
                key={ustaz.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                {/* Avatar — show photo or initial */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    {ustaz.profile_photo_url ? (
                      <Image
                        src={ustaz.profile_photo_url}
                        alt={`${ustaz.name} photo`}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-emerald-700 font-bold text-xl">
                        {ustaz.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{ustaz.name}</h3>
                    <p className="text-sm text-gray-500">{ustaz.location}</p>
                    <div className="mt-2">
                      <VerificationBadge status={ustaz.verification_status} />
                    </div>
                  </div>
                </div>

                {/* Subjects */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {(ustaz.subjects || []).slice(0, 3).map((subject) => (
                    <span
                      key={subject}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full"
                    >
                      {subject}
                    </span>
                  ))}
                  {(ustaz.subjects || []).length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      +{ustaz.subjects.length - 3} more
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
                    {ustaz.hourly_rate} Dalasi/hour
                  </p>
                </div>

                {/* Profile link */}
                <Link
                  href={`/ustaz/${ustaz.id}`}
                  className="block w-full text-center bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  View Profile
                </Link>
              </div>
            ))}
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
