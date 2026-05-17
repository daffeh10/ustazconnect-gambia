'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/app/components/Avatar'

interface TutorProfile {
  id: string
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  available_days: string[] | null
  profile_photo_url: string | null
  offers_online?: boolean | null
}

const HOURS_OPTIONS = [4, 8, 12, 16]
const getBookingDraftKey = (tutorId: string) => `booking-draft:${tutorId}`

interface BookingDraft {
  selectedSubject: string
  hoursPerMonth: number
  preferredDays: string[]
  familyName: string
  familyPhone: string
  specialRequests: string
  lessonFormat: 'in_person' | 'online'
}

export default function BookTutorPage() {
  const params = useParams<{ tutorId: string }>()
  const tutorId = typeof params?.tutorId === 'string' ? params.tutorId : ''
  const [supabase] = useState(() => createClient())
  const { user, role, profile, isLoading: isAuthLoading, openAuthModal } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState('')
  const [helperMessage, setHelperMessage] = useState('')
  const [tutor, setTutor] = useState<TutorProfile | null>(null)
  const [familyId, setFamilyId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [hoursPerMonth, setHoursPerMonth] = useState(4)
  const [preferredDays, setPreferredDays] = useState<string[]>([])
  const [familyName, setFamilyName] = useState('')
  const [familyPhone, setFamilyPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [lessonFormat, setLessonFormat] = useState<'in_person' | 'online'>('in_person')

  useEffect(() => {
    let isMounted = true

    async function loadPage() {
      try {
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profiles')
          .select('id,name,location,subjects,hourly_rate,available_days,profile_photo_url,offers_online')
          .eq('id', tutorId)
          .maybeSingle<TutorProfile>()

        if (tutorError) throw tutorError

        if (!isMounted) return

        if (!tutorData) {
          setError('Tutor not found.')
          return
        }

        setTutor(tutorData)
        setLessonFormat('in_person')
        if ((tutorData.subjects || []).length > 0) {
          setSelectedSubject(tutorData.subjects?.[0] || '')
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError('Could not load this booking page. Please refresh and try again.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      isMounted = false
    }
  }, [supabase, tutorId])

  useEffect(() => {
    if (typeof window === 'undefined' || !tutorId) return

    const rawDraft = window.sessionStorage.getItem(getBookingDraftKey(tutorId))
    if (!rawDraft) return

    try {
      const draft = JSON.parse(rawDraft) as Partial<BookingDraft>

      if (typeof draft.selectedSubject === 'string') setSelectedSubject(draft.selectedSubject)
      if (typeof draft.hoursPerMonth === 'number') setHoursPerMonth(draft.hoursPerMonth)
      if (Array.isArray(draft.preferredDays)) setPreferredDays(draft.preferredDays.filter((item) => typeof item === 'string'))
      if (typeof draft.familyName === 'string') setFamilyName(draft.familyName)
      if (typeof draft.familyPhone === 'string') setFamilyPhone(draft.familyPhone)
      if (typeof draft.specialRequests === 'string') setSpecialRequests(draft.specialRequests)
      if (draft.lessonFormat === 'online' || draft.lessonFormat === 'in_person') setLessonFormat(draft.lessonFormat)
    } catch (draftError) {
      console.error('Failed to load booking draft', draftError)
    }
  }, [tutorId])

  useEffect(() => {
    if (!tutorId || typeof window === 'undefined') return

    const draft: BookingDraft = {
      selectedSubject,
      hoursPerMonth,
      preferredDays,
      familyName,
      familyPhone,
      specialRequests,
      lessonFormat,
    }

    window.sessionStorage.setItem(getBookingDraftKey(tutorId), JSON.stringify(draft))
  }, [familyName, familyPhone, hoursPerMonth, lessonFormat, preferredDays, selectedSubject, specialRequests, tutorId])

  useEffect(() => {
    const profileRecord = profile as Record<string, unknown> | null

    if (!user) {
      setFamilyId('')
      setAuthError('')
      return
    }

    if (role !== 'family') {
      setFamilyId('')
      setAuthError('Only Family/Student accounts can send booking requests.')
      return
    }

    setAuthError('')
    setFamilyId(user.id)
    setHelperMessage('You are signed in. Review your details below, then send your booking request.')

    const profileName =
      typeof profileRecord?.parent_name === 'string'
        ? profileRecord.parent_name
        : typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.trim()
          : user.email?.split('@')[0] || 'Family'

    const profilePhone = typeof profileRecord?.phone === 'string' ? profileRecord.phone : user.phone || ''

    setFamilyName((current) => current.trim() || profileName)
    setFamilyPhone((current) => current.trim() || profilePhone)
  }, [profile, role, user])

  function togglePreferredDay(day: string) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!tutor) {
      setError('Tutor details are missing. Please refresh and try again.')
      return
    }

    if (!selectedSubject) {
      setError('Please choose a subject.')
      return
    }

    if (!familyName.trim()) {
      setError('Please enter your name.')
      return
    }

    if (!user || !familyId) {
      setError('')
      setHelperMessage('Please sign in or create your family account to send this request. Your booking details are saved on this page.')
      openAuthModal(`/book/${tutorId}`)
      return
    }

    if (role !== 'family') {
      setError('Please sign in with a Family/Student account to send this request.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const hourlyRate = tutor.hourly_rate || 0
      const monthlyTotal = hoursPerMonth * hourlyRate
      const serviceFee = Math.round(monthlyTotal * 0.03)
      const grandTotal = monthlyTotal + serviceFee

      const bookingPayload = {
        tutor_id: tutor.id,
        family_id: familyId,
        family_name: familyName.trim(),
        family_phone: familyPhone.trim() || null,
        subjects: [selectedSubject],
        hours_per_month: hoursPerMonth,
        hourly_rate: hourlyRate,
        monthly_total: monthlyTotal,
        service_fee: serviceFee,
        grand_total: grandTotal,
        special_requests: specialRequests.trim() || null,
        preferred_days: preferredDays,
        status: 'pending',
      }

      let { error: insertError } = await supabase.from('bookings').insert([
        {
          ...bookingPayload,
          lesson_format: lessonFormat,
        },
      ])

      if (
        insertError &&
        (
          insertError.message.toLowerCase().includes('lesson_format') ||
          insertError.message.toLowerCase().includes('column')
        )
      ) {
        const fallback = await supabase.from('bookings').insert([bookingPayload])
        insertError = fallback.error
      }

      if (insertError) throw insertError

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(getBookingDraftKey(tutorId))
      }

      setIsSuccess(true)
    } catch (err) {
      console.error(err)
      setError('Could not send your booking request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hourlyRate = tutor?.hourly_rate || 0
  const monthlyTotal = hoursPerMonth * hourlyRate
  const serviceFee = Math.round(monthlyTotal * 0.03)
  const grandTotal = monthlyTotal + serviceFee

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-gray-600">Loading booking page...</p>
        </div>
      </div>
    )
  }

  if (error && !tutor) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/find-tutor" className="text-sm text-emerald-600 hover:underline">
            ← Back to tutors
          </Link>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mt-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Tutor not found</h1>
            <p className="text-gray-600">The tutor you are trying to book does not exist.</p>
          </div>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href={`/tutor/${tutorId}`} className="text-sm text-emerald-600 hover:underline">
            ← Back to tutor profile
          </Link>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mt-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking unavailable</h1>
            <p className="text-gray-600">{authError}</p>
            <p className="text-sm text-gray-500 mt-4">Sign out and use a Family/Student account if you want to book this tutor.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!tutor) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href={`/tutor/${tutor.id}`} className="text-sm text-emerald-600 hover:underline">
          ← Back to tutor profile
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 mt-6">
          {!isSuccess ? (
            <>
              <div className="flex items-center gap-4 mb-8">
                <Avatar name={tutor.name} photoUrl={tutor.profile_photo_url} size="md" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{tutor.name}</h1>
                  <p className="text-gray-600 mt-1">{tutor.location || 'Location not available'}</p>
                </div>
              </div>

              {!isAuthLoading && !user && (
                <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  You can fill this booking request first. We will only ask you to sign in when you are ready to send it.
                </div>
              )}

              {helperMessage && (
                <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {helperMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <select
                    id="subject"
                    value={selectedSubject}
                    onChange={(event) => setSelectedSubject(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  >
                    <option value="">Select a subject</option>
                    {(tutor.subjects || []).map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="hours-per-month" className="block text-sm font-medium text-gray-700 mb-1">
                    Hours per month
                  </label>
                  <select
                    id="hours-per-month"
                    value={hoursPerMonth}
                    onChange={(event) => setHoursPerMonth(Number(event.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {HOURS_OPTIONS.map((hours) => (
                      <option key={hours} value={hours}>
                        {hours}
                      </option>
                    ))}
                  </select>
                </div>

                {tutor.offers_online && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Lesson format</label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-4 py-3">
                        <input
                          type="radio"
                          name="lesson-format"
                          value="in_person"
                          checked={lessonFormat === 'in_person'}
                          onChange={() => setLessonFormat('in_person')}
                          className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">In-person</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-lg border border-gray-300 px-4 py-3">
                        <input
                          type="radio"
                          name="lesson-format"
                          value="online"
                          checked={lessonFormat === 'online'}
                          onChange={() => setLessonFormat('online')}
                          className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">Online</span>
                      </label>
                    </div>
                    {lessonFormat === 'online' && (
                      <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Your tutor will contact you with a meeting link (WhatsApp, Zoom, or Google Meet)
                        before each lesson.
                      </p>
                    )}
                  </div>
                )}

                {(tutor.available_days || []).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred days</label>
                    <div className="flex flex-wrap gap-2">
                      {(tutor.available_days || []).map((day) => {
                        const selected = preferredDays.includes(day)
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => togglePreferredDay(day)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                              selected
                                ? 'bg-emerald-600 text-white font-medium'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="family-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Your name
                  </label>
                  <input
                    id="family-name"
                    type="text"
                    value={familyName}
                    onChange={(event) => setFamilyName(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="family-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Your phone
                  </label>
                  <input
                    id="family-phone"
                    type="tel"
                    value={familyPhone}
                    onChange={(event) => setFamilyPhone(event.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="+220 XXX XXXX"
                  />
                </div>

                <div>
                  <label htmlFor="special-requests" className="block text-sm font-medium text-gray-700 mb-1">
                    Special requests
                  </label>
                  <textarea
                    id="special-requests"
                    value={specialRequests}
                    onChange={(event) => setSpecialRequests(event.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Share any special requests or learning goals."
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Cost breakdown</h2>
                  <div className="space-y-2 text-gray-700">
                    <p className="flex justify-between gap-4">
                      <span>Monthly total</span>
                      <span className="font-medium">D{monthlyTotal.toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                      <span>Service fee</span>
                      <span className="font-medium">D{serviceFee.toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between gap-4 text-gray-900 font-semibold border-t border-emerald-200 pt-2">
                      <span>Grand total</span>
                      <span>D{grandTotal.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isAuthLoading}
                  className="w-full bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Sending request...'
                    : !user
                      ? 'Continue to Sign In'
                      : 'Send Booking Request'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl mb-4">
                ✓
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Request sent to {tutor.name}!</h1>
              <p className="text-gray-600">
                {tutor.name} has 48 hours to respond. We&apos;ll notify you by WhatsApp.
              </p>
              <Link
                href="/find-tutor"
                className="inline-block mt-6 bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Browse more tutors
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
