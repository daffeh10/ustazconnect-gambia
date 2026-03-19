'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import VerificationBadge from '@/app/components/VerificationBadge'
import StarRating from '@/app/components/StarRating'
import ReviewCard from '@/app/components/ReviewCard'
import LeaveReviewForm from '@/app/components/LeaveReviewForm'
import ReportModal from '@/app/components/ReportModal'
import { createClient } from '@/lib/supabase/client'

interface UstazProfile {
  id: string
  user_id?: string | null
  name: string
  phone: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
  bio: string | null
  available_days: string[] | null
  available_times?: string[] | null
  profile_photo_url: string | null
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

export default function UstazProfileClient({ id }: { id: string }) {
  const [supabaseClient] = useState(() => createClient())
  const [ustaz, setUstaz] = useState<UstazProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [isReviewsLoading, setIsReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState('')
  const [canBookTutor, setCanBookTutor] = useState(false)

  // Inquiry form state
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [inquiryData, setInquiryData] = useState({
    family_name: '',
    family_phone: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inquirySuccess, setInquirySuccess] = useState(false)
  const [inquiryError, setInquiryError] = useState('')

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
  }, [id])

  useEffect(() => {
    async function fetchUstaz() {
      try {
        const { data, error } = await supabase
          .from('tutor_profiles')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
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
  }, [id, loadReviews])

  useEffect(() => {
    if (!id || typeof window === 'undefined') return

    const currentIds = JSON.parse(window.localStorage.getItem(RECENT_VIEWED_KEY) || '[]')
    const normalizedIds = Array.isArray(currentIds) ? currentIds.filter((item) => typeof item === 'string') : []
    const nextIds = [id, ...normalizedIds.filter((storedId) => storedId !== id)].slice(0, 5)
    window.localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(nextIds))
  }, [id])

  useEffect(() => {
    let isMounted = true

    async function checkViewerRole() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabaseClient.auth.getUser()

        if (userError) throw userError
        if (!isMounted || !user) {
          setCanBookTutor(false)
          return
        }

        const metadataRole =
          typeof user.user_metadata?.role === 'string'
            ? user.user_metadata.role.toLowerCase().trim()
            : ''

        if (metadataRole === 'family') {
          setCanBookTutor(true)
          return
        }

        const { data: familyProfile, error: familyError } = await supabaseClient
          .from('family_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (familyError) throw familyError
        if (isMounted) {
          setCanBookTutor(Boolean(familyProfile))
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setCanBookTutor(false)
        }
      }
    }

    void checkViewerRole()

    return () => {
      isMounted = false
    }
  }, [supabaseClient])

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setInquiryError('')

    if (!inquiryData.family_name || !inquiryData.family_phone) {
      setInquiryError('Please fill in your name and phone number')
      setIsSubmitting(false)
      return
    }

    try {
      const payload = {
        tutor_id: id,
        family_name: inquiryData.family_name.trim(),
        family_phone: inquiryData.family_phone.trim(),
        message: inquiryData.message.trim()
      }

      let { error } = await supabase
        .from('inquiries')
        .insert([payload])

      // Backward-compat fallback if table still uses ustaz_id.
      if (error && error.message.toLowerCase().includes('tutor_id')) {
        const fallback = await supabase
          .from('inquiries')
          .insert([{
            ustaz_id: id,
            family_name: inquiryData.family_name,
            family_phone: inquiryData.family_phone,
            message: inquiryData.message
          }])
        error = fallback.error
      }

      if (error) throw error

      setInquirySuccess(true)
      setShowInquiryForm(false)
    } catch (err) {
      console.error(err)
      const errorMessage =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message.toLowerCase()
          : ''
      const errorCode =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code.toLowerCase()
          : ''
      const missingTableError =
        errorCode === '42p01' ||
        errorCode === 'pgrst205' ||
        errorMessage.includes('relation "inquiries" does not exist') ||
        errorMessage.includes('could not find the table') ||
        errorMessage.includes("table 'inquiries'") ||
        errorMessage.includes('does not exist')

      if (
        errorMessage.includes('row-level security') ||
        errorMessage.includes('permission denied') ||
        errorCode === '42501'
      ) {
        setInquiryError(
          'Contact form permissions are not configured. Please apply the RLS policies in supabase/inquiries_schema.sql.'
        )
      } else if (missingTableError) {
        setInquiryError(
          'Contact form is not configured yet. Run supabase/inquiries_schema.sql in Supabase SQL Editor first.'
        )
      } else if (errorMessage.includes('violates foreign key constraint')) {
        setInquiryError(
          'This tutor profile is not fully synced yet. Please refresh and try again.'
        )
      } else {
        const readableError =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : ''
        setInquiryError(
          readableError ? `Could not send inquiry: ${readableError}` : 'Something went wrong. Please try again.'
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
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
          <Link href="/find-ustaz" className="text-emerald-600 hover:text-emerald-700">
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Back link */}
        <Link href="/find-ustaz" className="text-emerald-600 hover:text-emerald-700 mb-6 inline-block">
          ← Back to all tutors
        </Link>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Profile Header Banner */}
          <div className="bg-emerald-600 px-6 py-8">
            <div className="flex items-center gap-6">
              {/* Avatar — show uploaded photo or fall back to initial */}
              <div className="w-24 h-24 rounded-full bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                {ustaz.profile_photo_url ? (
                  <Image
                    src={ustaz.profile_photo_url}
                    alt={`${ustaz.name} profile photo`}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-emerald-600 font-bold text-4xl">
                    {ustaz.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-white">
                <h1 className="text-3xl font-bold">{ustaz.name}</h1>
                <div className="mt-2">
                  <VerificationBadge status={ustaz.verification_status} />
                </div>
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
                <p className="text-xl font-semibold text-gray-900">{ustaz.hourly_rate} Dalasi</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Subjects</p>
                <p className="text-xl font-semibold text-gray-900">{ustaz.subjects.length}</p>
              </div>
            </div>

            {/* Subjects */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Subjects Taught</h2>
              <div className="flex flex-wrap gap-2">
                {ustaz.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full"
                  >
                    {subject}
                  </span>
                ))}
              </div>
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
                  tutorName={ustaz.name}
                  onSubmitted={() => {
                    void loadReviews()
                  }}
                />
              </div>
            </section>

            <div className="space-y-3">
              {canBookTutor && (
                <Link
                  href={`/book/${ustaz.id}`}
                  className="block w-full text-center bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition"
                >
                  Book This Tutor
                </Link>
              )}

              {!inquirySuccess && (
                <button
                  onClick={() => setShowInquiryForm(true)}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition"
                >
                  Contact This Tutor
                </button>
              )}
            </div>

            {/* Success Message */}
            {inquirySuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-emerald-800 mb-1">Inquiry Sent!</h3>
                <p className="text-emerald-700 text-sm">
                  {ustaz.name} will contact you soon at the phone number you provided.
                </p>
              </div>
            )}

            {ustaz.user_id && (
              <ReportModal reportedUserId={ustaz.user_id} tutorName={ustaz.name} />
            )}
          </div>
        </div>

        {/* Inquiry Modal */}
        {showInquiryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Contact {ustaz.name}</h2>
                <button
                  onClick={() => setShowInquiryForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {inquiryError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {inquiryError}
                </div>
              )}

              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-1 text-sm">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={inquiryData.family_name}
                    onChange={(e) => setInquiryData({ ...inquiryData, family_name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1 text-sm">
                    Your Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={inquiryData.family_phone}
                    onChange={(e) => setInquiryData({ ...inquiryData, family_phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="+220 XXX XXXX"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1 text-sm">
                    Message
                  </label>
                  <textarea
                    value={inquiryData.message}
                    onChange={(e) => setInquiryData({ ...inquiryData, message: e.target.value })}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Tell the tutor about your child and what you're looking for..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInquiryForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
