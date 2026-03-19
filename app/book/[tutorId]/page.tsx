'use client'

import { FormEvent, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TutorProfile {
  id: string
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  available_days: string[] | null
  profile_photo_url: string | null
}

interface FamilyProfileRow {
  parent_name: string | null
}

const HOURS_OPTIONS = [4, 8, 12, 16]

export default function BookTutorPage() {
  const params = useParams<{ tutorId: string }>()
  const tutorId = typeof params?.tutorId === 'string' ? params.tutorId : ''
  const [supabase] = useState(() => createClient())

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [authError, setAuthError] = useState('')
  const [tutor, setTutor] = useState<TutorProfile | null>(null)
  const [familyId, setFamilyId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [hoursPerMonth, setHoursPerMonth] = useState(4)
  const [preferredDays, setPreferredDays] = useState<string[]>([])
  const [familyName, setFamilyName] = useState('')
  const [familyPhone, setFamilyPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadPage() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        if (!user) {
          if (isMounted) {
            setAuthError('Please sign in to book this tutor.')
          }
        } else {
          const metadataRole =
            typeof user.user_metadata?.role === 'string'
              ? user.user_metadata.role.toLowerCase().trim()
              : ''

          let isFamilyUser = metadataRole === 'family'

          const { data: familyProfile, error: familyProfileError } = await supabase
            .from('family_profiles')
            .select('parent_name')
            .eq('user_id', user.id)
            .maybeSingle<FamilyProfileRow>()

          if (familyProfileError) {
            const profileCode = familyProfileError.code?.toLowerCase() || ''
            const profileMessage = familyProfileError.message.toLowerCase()
            const missingTable =
              profileCode === '42p01' ||
              profileCode === 'pgrst205' ||
              profileMessage.includes('does not exist')

            if (!missingTable) throw familyProfileError
          }

          if (familyProfile) {
            isFamilyUser = true
          }

          if (!isFamilyUser) {
            if (isMounted) {
              setAuthError('Only Family/Student accounts can book tutors.')
            }
          } else if (isMounted) {
            setFamilyId(user.id)
            const metadataName =
              typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
            const fallbackName = user.email?.split('@')[0] || 'Family'
            setFamilyName(familyProfile?.parent_name || metadataName || fallbackName)
          }
        }

        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profiles')
          .select('id,name,location,subjects,hourly_rate,available_days,profile_photo_url')
          .eq('id', tutorId)
          .maybeSingle<TutorProfile>()

        if (tutorError) throw tutorError

        if (!isMounted) return

        if (!tutorData) {
          setError('Tutor not found.')
          return
        }

        setTutor(tutorData)
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

  function togglePreferredDay(day: string) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!familyId) {
      setError('Please sign in as a Family/Student account before booking.')
      return
    }

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

    setError('')
    setIsSubmitting(true)

    try {
      const hourlyRate = tutor.hourly_rate || 0
      const monthlyTotal = hoursPerMonth * hourlyRate
      const serviceFee = Math.round(monthlyTotal * 0.03)
      const grandTotal = monthlyTotal + serviceFee

      const { error: insertError } = await supabase.from('bookings').insert([
        {
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
        },
      ])

      if (insertError) throw insertError

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
          <Link href="/find-ustaz" className="text-sm text-emerald-600 hover:underline">
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
          <Link href={`/ustaz/${tutorId}`} className="text-sm text-emerald-600 hover:underline">
            ← Back to tutor profile
          </Link>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mt-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking unavailable</h1>
            <p className="text-gray-600">{authError}</p>
            <Link
              href="/login"
              className="inline-block mt-4 bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Go to sign in
            </Link>
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
        <Link href={`/ustaz/${tutor.id}`} className="text-sm text-emerald-600 hover:underline">
          ← Back to tutor profile
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 mt-6">
          {!isSuccess ? (
            <>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  {tutor.profile_photo_url ? (
                    <Image
                      src={tutor.profile_photo_url}
                      alt={`${tutor.name} photo`}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-emerald-700 font-bold text-2xl">
                      {tutor.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{tutor.name}</h1>
                  <p className="text-gray-600 mt-1">{tutor.location || 'Location not available'}</p>
                </div>
              </div>

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
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending request...' : 'Send Booking Request'}
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
                href="/find-ustaz"
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
