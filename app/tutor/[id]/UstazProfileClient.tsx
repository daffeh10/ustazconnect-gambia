'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import VerificationBadge from '@/app/components/VerificationBadge'
import { normalizeTutorSubjects } from '@/lib/tutor-subjects'
import StarRating from '@/app/components/StarRating'
import ReviewCard from '@/app/components/ReviewCard'
import LeaveReviewForm from '@/app/components/LeaveReviewForm'
import ReportModal from '@/app/components/ReportModal'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/app/components/Avatar'
import { formatPublicTutorName, isTutorPubliclyVisible } from '@/lib/tutor-review'
import { trackFunnelEvent } from '@/lib/funnel'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'

interface UstazProfile {
  id: string
  name: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
  bio: string | null
  available_days: string[] | null
  available_times?: string[] | null
  profile_photo_url: string | null
  offers_online?: boolean | null
  languages?: string[] | null
  areas_covered?: string[] | null
  age_groups?: string[] | null
  education?: string | null
  verification_status?: string | null
  average_rating?: number | string | null
  created_at: string
}

interface ReviewRow {
  id: string
  family_name: string
  rating: number
  comment: string | null
  would_recommend: boolean
  tutor_response: string | null
  created_at: string
}

const RECENT_VIEWED_KEY = 'rv_tutors'
const LEGACY_PUBLIC_TUTOR_PROFILE_SELECT =
  'id,name,location,subjects,experience_years,hourly_rate,bio,available_days,available_times,profile_photo_url,verification_status,average_rating,created_at'
const ENHANCED_PUBLIC_TUTOR_PROFILE_SELECT =
  `${LEGACY_PUBLIC_TUTOR_PROFILE_SELECT},offers_online,languages,areas_covered,age_groups,education`

export default function UstazProfileClient({
  id,
  defaultLessonFormat,
}: {
  id: string
  defaultLessonFormat: 'in_person' | 'online'
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [ustaz, setUstaz] = useState<UstazProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [isReviewsLoading, setIsReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState('')

  const loadReviews = useCallback(async () => {
    setIsReviewsLoading(true)
    setReviewsError('')

    try {
      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('id,family_name,rating,comment,would_recommend,tutor_response,created_at')
        .eq('tutor_id', id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setReviews((data ?? []) as ReviewRow[])
    } catch (err) {
      console.error(err)
      setReviews([])
      setReviewsError('Could not load reviews right now.')
    } finally {
      setIsReviewsLoading(false)
    }
  }, [id, supabase])

  useEffect(() => {
    async function fetchUstaz() {
      try {
        const primaryResult = await supabase
          .from('public_tutors')
          .select(ENHANCED_PUBLIC_TUTOR_PROFILE_SELECT)
          .eq('id', id)
          .single()
        let data = (primaryResult.data ?? null) as UstazProfile | null
        let error = primaryResult.error

        if (error) {
          const fallbackResult = await supabase
            .from('public_tutors')
            .select(LEGACY_PUBLIC_TUTOR_PROFILE_SELECT)
            .eq('id', id)
            .single()

          data = (fallbackResult.data ?? null) as UstazProfile | null
          error = fallbackResult.error
        }

        if (error) throw error
        if (
          !data ||
          !isTutorPubliclyVisible({
            verificationStatus: data.verification_status,
            createdAt: data.created_at,
          })
        ) {
          throw new Error('Tutor not found.')
        }
        setUstaz(data)
      } catch (err) {
        setError('Tutor not found.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchUstaz()
    void loadReviews()
  }, [id, loadReviews, supabase])

  useEffect(() => {
    if (!id || typeof window === 'undefined') return

    const currentIds = JSON.parse(window.localStorage.getItem(RECENT_VIEWED_KEY) || '[]')
    const normalizedIds = Array.isArray(currentIds) ? currentIds.filter((item) => typeof item === 'string') : []
    const nextIds = [id, ...normalizedIds.filter((storedId) => storedId !== id)].slice(0, 5)
    window.localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(nextIds))
    trackFunnelEvent('tutor_profile_viewed', { tutor_id: id })
  }, [id])

  function handleBookLesson() {
    trackFunnelEvent('booking_started', { tutor_id: id })
    const formatQuery =
      DIASPORA_QURAN_ENABLED && defaultLessonFormat === 'online'
        ? '?format=online'
        : ''
    router.push(`/book/${id}${formatQuery}`)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="mx-auto max-w-4xl px-4 py-12" aria-label="Loading tutor profile">
          <div className="h-48 animate-pulse rounded-t-lg bg-emerald-100" />
          <div className="space-y-5 rounded-b-lg border border-t-0 border-gray-200 bg-white p-6">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-24 animate-pulse rounded bg-gray-100" />
            <div className="h-40 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !ustaz) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tutor Not Found</h1>
          <p className="text-gray-600 mb-6">The profile you are looking for does not exist.</p>
          <Link href="/find-tutor" className="text-emerald-600 hover:text-emerald-700">
            ← Browse all tutors
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const reviewCount = reviews.length
  const reviewAverage =
    reviewCount > 0
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
      : null
  const profileAverageRating =
    typeof ustaz.average_rating === 'number'
      ? ustaz.average_rating
      : typeof ustaz.average_rating === 'string'
        ? Number(ustaz.average_rating) || 0
        : 0
  const averageRating =
    reviewAverage ?? profileAverageRating
  const recommendationCount = reviews.filter((review) => review.would_recommend).length
  const recommendationPercent =
    reviewCount > 0 ? Math.round((recommendationCount / reviewCount) * 100) : 0
  const publicTutorName = formatPublicTutorName(ustaz.name)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Back link */}
        <Link href="/find-tutor" className="text-emerald-600 hover:text-emerald-700 mb-6 inline-block">
          ← Back to all tutors
        </Link>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Profile Header Banner */}
          <div className="bg-emerald-600 px-6 py-8">
            <div className="flex items-center gap-6">
              {/* Avatar — show uploaded photo or fall back to initial */}
              <Avatar
                name={publicTutorName}
                photoUrl={ustaz.profile_photo_url}
                size="lg"
                className="bg-white text-emerald-600"
              />
              <div className="text-white">
                <h1 className="text-3xl font-bold">{publicTutorName}</h1>
                <div className="mt-2">
                  <VerificationBadge status={ustaz.verification_status} />
                </div>
                {DIASPORA_QURAN_ENABLED && ustaz.offers_online && (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
                      Also available online
                    </span>
                  </div>
                )}
                <p className="text-emerald-100 flex items-center gap-2 mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {ustaz.location}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            {/* Quick Info */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Experience</p>
                <p className="text-xl font-semibold text-gray-900">
                  {ustaz.experience_years >= 20
                    ? '20+ years'
                    : `${ustaz.experience_years} ${ustaz.experience_years === 1 ? 'year' : 'years'}`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Hourly Rate</p>
                <p className="text-xl font-semibold text-gray-900">GMD {ustaz.hourly_rate.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Subjects</p>
                <p className="text-xl font-semibold text-gray-900">
                  {normalizeTutorSubjects(ustaz.subjects).length}
                </p>
              </div>
            </div>

            {/* Subjects */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Subjects Taught</h2>
              <div className="flex flex-wrap gap-2">
                {normalizeTutorSubjects(ustaz.subjects).map((subject) => (
                  <span
                    key={subject}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Languages</h2>
                {ustaz.languages && ustaz.languages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ustaz.languages.map((language) => (
                      <span key={language} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                        {language}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">This tutor has not added languages yet.</p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Education</h2>
                {ustaz.education ? (
                  <p className="text-gray-700">{ustaz.education}</p>
                ) : (
                  <p className="text-gray-500">This tutor has not added education details yet.</p>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Areas Covered</h2>
              {ustaz.areas_covered && ustaz.areas_covered.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ustaz.areas_covered.map((area) => (
                    <span key={area} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {area}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">This tutor has not added travel areas yet.</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Age Groups</h2>
              {ustaz.age_groups && ustaz.age_groups.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ustaz.age_groups.map((ageGroup) => (
                    <span key={ageGroup} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {ageGroup}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">This tutor has not added age groups yet.</p>
              )}
            </div>

            {/* Available Days */}
            {ustaz.available_days && ustaz.available_days.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Days</h2>
                <div className="flex flex-wrap gap-2">
                  {ustaz.available_days.map((day) => (
                    <span
                      key={day}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Times */}
            {ustaz.available_times && ustaz.available_times.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Times</h2>
                <div className="flex flex-wrap gap-2">
                  {ustaz.available_times.map((slot) => (
                    <span
                      key={slot}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {ustaz.bio && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{ustaz.bio}</p>
              </div>
            )}

            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Reviews</h2>
              <div className="flex items-center gap-3">
                <StarRating rating={averageRating} />
                <p className="text-sm text-gray-600">({reviewCount} reviews)</p>
              </div>

              {reviewCount > 0 && (
                <p className="text-sm text-gray-600 mt-2">{recommendationPercent}% would recommend</p>
              )}

              <div className="mt-4 space-y-4">
                {isReviewsLoading ? (
                  <div className="flex items-center gap-3 text-gray-600">
                    <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <p>Loading reviews...</p>
                  </div>
                ) : reviewsError ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {reviewsError}
                  </div>
                ) : reviewCount === 0 ? (
                  <p className="text-gray-500 text-sm">No reviews yet. Be the first to leave one.</p>
                ) : (
                  reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      familyName={review.family_name}
                      rating={review.rating}
                      comment={review.comment}
                      wouldRecommend={review.would_recommend}
                      tutorResponse={review.tutor_response}
                      createdAt={review.created_at}
                    />
                  ))
                )}
              </div>

              <div className="mt-6">
                <LeaveReviewForm
                  tutorId={ustaz.id}
                  tutorName={publicTutorName}
                  onSubmitted={() => {
                    void loadReviews()
                  }}
                />
              </div>
            </section>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleBookLesson}
                className="block w-full text-center bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition"
              >
                View Booking Options
              </button>
            </div>

            <ReportModal tutorId={ustaz.id} tutorName={publicTutorName} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
