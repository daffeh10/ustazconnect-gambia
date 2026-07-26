'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import LessonCard, { Lesson } from '@/app/components/LessonCard'

interface BookingRow {
  id: string
  tutor_id: string
  subjects: string[] | null
  hours_per_month: number
  monthly_total: number
  service_fee: number
  grand_total: number
  status: string | null
  created_at: string
  booking_type?: string | null
  trial_confirmed_at?: string | null
  no_show_reported_at?: string | null
  refund_status?: string | null
}

interface PaymentRow {
  id: string
  booking_id: string | null
  status: string | null
  total: number
  created_at: string
}

interface TutorNameRow {
  id: string
  name: string | null
}

function getPaymentStatusText(status: string | null) {
  switch (status) {
    case 'cancelled':
      return 'Your last payment attempt was cancelled before completion. You can safely start a new payment attempt now.'
    case 'failed':
      return 'Your last payment attempt failed. Please start a new payment attempt.'
    case 'pending':
      return 'Your payment is still being confirmed. If you already completed checkout, give it a moment, then refresh this page.'
    case 'completed':
      return 'Your payment has been completed successfully.'
    default:
      return 'No payment has been started for this booking yet.'
  }
}

function getPaymentStatusLabel(status: string | null) {
  switch (status) {
    case 'cancelled':
      return 'Cancelled'
    case 'failed':
      return 'Failed'
    case 'pending':
      return 'Pending'
    case 'completed':
      return 'Completed'
    default:
      return 'Not started'
  }
}

function getPaymentActionLabel(status: string | null) {
  switch (status) {
    case 'cancelled':
    case 'failed':
      return 'Try Payment Again'
    case 'pending':
      return 'Continue Payment'
    default:
      return 'Pay Now'
  }
}

export default function FamilyDashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [email, setEmail] = useState('')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLessonsLoading, setIsLessonsLoading] = useState(false)
  const [lessonsError, setLessonsError] = useState('')
  const [tutorNames, setTutorNames] = useState<Record<string, string>>({})
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [trialActionId, setTrialActionId] = useState('')
  const [trialMessage, setTrialMessage] = useState('')
  const [disputeBookingId, setDisputeBookingId] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadFamilyProfile() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        if (!user) {
          router.push('/login')
          router.refresh()
          return
        }

        if (!isMounted) return

        setEmail(user.email || '')
        const metadataName =
          typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
        const fallbackName = user.email?.split('@')[0] || 'Family'
        setFamilyName(metadataName || fallbackName)
        setIsLessonsLoading(true)
        setLessonsError('')

        const { data: bookingsData, error: bookingsLoadError } = await supabase
          .from('bookings')
          .select('*')
          .eq('family_id', user.id)
          .order('created_at', { ascending: false })

        if (bookingsLoadError) throw bookingsLoadError
        if (!isMounted) return
        setBookings((bookingsData ?? []) as BookingRow[])

        const { data: paymentsData, error: paymentsLoadError } = await supabase
          .from('payments')
          .select('id,booking_id,status,total,created_at')
          .eq('family_id', user.id)
          .order('created_at', { ascending: false })

        if (paymentsLoadError) throw paymentsLoadError
        if (!isMounted) return
        setPayments((paymentsData ?? []) as PaymentRow[])

        const { data: lessonsData, error: lessonsLoadError } = await supabase
          .from('lessons')
          .select(
            'id,booking_id,tutor_id,family_id,lesson_number,duration_minutes,subject,status,tutor_notes,completed_at,scheduled_at,meeting_link,created_at'
          )
          .eq('family_id', user.id)
          .order('booking_id', { ascending: true })
          .order('lesson_number', { ascending: true })

        if (lessonsLoadError) throw lessonsLoadError
        if (!isMounted) return

        const loadedLessons = (lessonsData ?? []) as Lesson[]
        setLessons(loadedLessons)

        const uniqueTutorIds = Array.from(new Set(loadedLessons.map((lesson) => lesson.tutor_id).filter(Boolean)))
        if (uniqueTutorIds.length > 0) {
          const { data: tutorsData, error: tutorsLoadError } = await supabase
            .from('public_tutors')
            .select('id,name')
            .in('id', uniqueTutorIds)

          if (tutorsLoadError) throw tutorsLoadError
          if (!isMounted) return

          const mappedTutorNames = ((tutorsData ?? []) as TutorNameRow[]).reduce<Record<string, string>>(
            (acc, tutor) => {
              acc[tutor.id] = tutor.name?.trim() || 'Tutor'
              return acc
            },
            {}
          )
          setTutorNames(mappedTutorNames)
        } else {
          setTutorNames({})
        }

        const { data: profile, error: profileError } = await supabase
          .from('family_profiles')
          .select('parent_name')
          .eq('user_id', user.id)
          .maybeSingle<{ parent_name: string | null }>()

        if (profileError) {
          const profileMessage = profileError.message.toLowerCase()
          const profileCode = profileError.code?.toLowerCase() || ''
          const missingTable =
            profileCode === '42p01' ||
            profileCode === 'pgrst205' ||
            profileMessage.includes('relation') ||
            profileMessage.includes('does not exist')

          if (!missingTable) throw profileError
        } else if (isMounted && profile?.parent_name) {
          setFamilyName(profile.parent_name)
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError('Could not load your family dashboard. Please refresh and try again.')
          setBookings([])
          setPayments([])
          setLessons([])
          setLessonsError('Could not load your lesson timeline right now. Please refresh and try again.')
        }
      } finally {
        if (isMounted) {
          setIsLessonsLoading(false)
          setIsPageLoading(false)
        }
      }
    }

    void loadFamilyProfile()

    return () => {
      isMounted = false
    }
  }, [router, supabase])

  async function handleSignOut() {
    setError('')
    setIsSigningOut(true)

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Failed to sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  async function updateTrial(bookingId: string, action: 'confirm' | 'no-show') {
    setTrialActionId(bookingId)
    setTrialMessage('')
    setError('')

    try {
      const response = await fetch(action === 'confirm' ? '/api/trials/confirm' : '/api/trials/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not update trial.')

      setTrialMessage(action === 'confirm' ? 'Trial confirmed. Tutor payout can be processed.' : 'No-show reported. TutorConnect will review the refund.')
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                trial_confirmed_at: action === 'confirm' ? new Date().toISOString() : booking.trial_confirmed_at,
                no_show_reported_at: action === 'no-show' ? new Date().toISOString() : booking.no_show_reported_at,
                refund_status: action === 'no-show' ? 'requested' : booking.refund_status,
              }
            : booking
        )
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update trial.')
    } finally {
      setTrialActionId('')
    }
  }

  async function submitDispute(bookingId: string) {
    setIsSubmittingDispute(true)
    setError('')
    setTrialMessage('')

    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: disputeReason }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not submit dispute.')

      setTrialMessage('Issue submitted. TutorConnect will review it.')
      setDisputeBookingId('')
      setDisputeReason('')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not submit dispute.')
    } finally {
      setIsSubmittingDispute(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  const lessonsByBooking = lessons.reduce<Record<string, Lesson[]>>((groups, lesson) => {
    if (!groups[lesson.booking_id]) {
      groups[lesson.booking_id] = []
    }
    groups[lesson.booking_id].push(lesson)
    return groups
  }, {})

  const latestPaymentsByBooking = payments.reduce<Record<string, PaymentRow>>((acc, payment) => {
    if (!payment.booking_id) return acc
    if (!acc[payment.booking_id]) {
      acc[payment.booking_id] = payment
    }
    return acc
  }, {})

  const confirmedBookings = bookings.filter((booking) => booking.status === 'confirmed')
  const activeBookings = bookings.filter((booking) => booking.status === 'active')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <nav className="max-w-6xl mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            TutorConnect Gambia
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Family Dashboard</h1>
          <p className="text-base text-gray-600 mt-2">
            Welcome, {familyName}. Manage your tutor search and upcoming bookings here.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {trialMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6">
            {trialMessage}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Find Tutors</h2>
            <p className="text-sm text-gray-600 mt-2">
              Compare tutors by subject, location, availability, and review level.
            </p>
            <Link
              href="/find-tutor"
              className="inline-block mt-4 bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Find a Tutor
            </Link>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Account Details</h2>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-700">Name:</span> {familyName}
              </p>
              <p>
                <span className="font-medium text-gray-700">Email:</span> {email || 'Not available'}
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Booking history and lesson tracking will appear here as you start requests.
            </p>
          </section>
        </div>

        <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Confirmed Bookings</h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete payment for tutor requests that have already been accepted.
            </p>
          </div>

          {confirmedBookings.length === 0 ? (
            <p className="text-gray-600">No confirmed bookings are waiting for payment.</p>
          ) : (
            <div className="space-y-4">
              {confirmedBookings.map((booking) => {
                const tutorName = tutorNames[booking.tutor_id] || 'Tutor'
                const latestPayment = latestPaymentsByBooking[booking.id]
                const latestPaymentStatus = latestPayment?.status || null

                return (
                  <article key={booking.id} className="border border-gray-200 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{tutorName}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {(booking.subjects || []).join(', ') || 'No subject selected'} · {booking.hours_per_month} hours/month
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                        Awaiting payment
                      </span>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm text-gray-700">
                      <div className="rounded-lg bg-gray-50 px-3 py-3">
                        <p className="text-gray-500">Subtotal</p>
                        <p className="font-semibold text-gray-900">GMD {booking.monthly_total.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-3 py-3">
                        <p className="text-gray-500">Service fee</p>
                        <p className="font-semibold text-gray-900">GMD {booking.service_fee.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-3 border border-emerald-100">
                        <p className="text-emerald-700">Total</p>
                        <p className="font-semibold text-emerald-900">GMD {booking.grand_total.toLocaleString()}</p>
                      </div>
                    </div>

                    {latestPayment && (
                      <div className="mt-3 space-y-1 text-sm text-gray-500">
                        <p>
                          Latest payment status:{' '}
                          <span className="font-medium">{getPaymentStatusLabel(latestPaymentStatus)}</span>
                        </p>
                        <p>{getPaymentStatusText(latestPaymentStatus)}</p>
                      </div>
                    )}

                    <Link
                      href={`/payment/${booking.id}`}
                      className="inline-flex mt-4 items-center rounded-lg bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
                    >
                      {getPaymentActionLabel(latestPaymentStatus)}
                    </Link>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Active Bookings</h2>
            <p className="text-sm text-gray-600 mt-1">
              These bookings are fully paid and active.
            </p>
          </div>

          {activeBookings.length === 0 ? (
            <p className="text-gray-600">No active bookings yet.</p>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking) => (
                <article key={booking.id} className="border border-gray-200 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{tutorNames[booking.tutor_id] || 'Tutor'}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {(booking.subjects || []).join(', ') || 'No subject selected'} · {booking.hours_per_month} hours/month
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
                      {booking.booking_type === 'trial' ? 'Trial active' : 'Active'}
                    </span>
                  </div>
                  {booking.booking_type === 'trial' && (
                    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                      {booking.trial_confirmed_at ? (
                        <p className="text-sm text-emerald-800">Trial confirmed. TutorConnect can fast-track the tutor payout.</p>
                      ) : booking.no_show_reported_at ? (
                        <p className="text-sm text-amber-800">No-show reported. Refund status: {booking.refund_status || 'requested'}.</p>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-emerald-800">After the intro session, confirm attendance or report a no-show.</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void updateTrial(booking.id, 'confirm')}
                              disabled={trialActionId === booking.id}
                              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Confirm Trial
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateTrial(booking.id, 'no-show')}
                              disabled={trialActionId === booking.id}
                              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              Report No-show
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
                    {disputeBookingId === booking.id ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <label htmlFor={`dispute-${booking.id}`} className="block text-sm font-medium text-amber-900 mb-1">
                          What happened?
                        </label>
                        <textarea
                          id={`dispute-${booking.id}`}
                          value={disputeReason}
                          onChange={(event) => setDisputeReason(event.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-amber-200 px-4 py-3 focus:ring-2 focus:ring-amber-500"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void submitDispute(booking.id)}
                            disabled={isSubmittingDispute}
                            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                          >
                            Submit Issue
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDisputeBookingId('')
                              setDisputeReason('')
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDisputeBookingId(booking.id)}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Report Issue
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Lesson Timeline</h2>
              <p className="text-sm text-gray-600 mt-1">
                Track each lesson in your active tutoring journey.
              </p>
            </div>
          </div>

          {lessonsError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {lessonsError}
            </div>
          ) : isLessonsLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading lesson timeline...</span>
            </div>
          ) : lessons.length === 0 ? (
            <p className="text-gray-600">
              No lessons yet. Once a tutor accepts your booking and payment is completed, lessons will appear here.
            </p>
          ) : (
            <div className="space-y-8">
              {Object.entries(lessonsByBooking).map(([bookingId, bookingLessons]) => {
                const tutorId = bookingLessons[0]?.tutor_id
                const tutorName = tutorNames[tutorId] || 'Tutor'
                const allCompleted = bookingLessons.every((lesson) => lesson.status === 'completed')

                return (
                  <div key={bookingId} className="border border-gray-200 rounded-xl p-5">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{tutorName}</h3>
                      <p className="text-sm text-gray-500 mt-1">Booking {bookingId.slice(0, 8)}</p>
                    </div>

                    <div className="space-y-4">
                      {bookingLessons.map((lesson) => (
                        <LessonCard
                          key={lesson.id}
                          lesson={lesson}
                          viewAs="family"
                          totalLessons={bookingLessons.length}
                        />
                      ))}
                    </div>

                    {allCompleted && tutorId && (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-emerald-800">All lessons done! Leave a review</p>
                          <p className="text-sm text-emerald-700 mt-1">
                            Share your experience to help other families choose with confidence.
                          </p>
                        </div>
                        <Link
                          href={`/tutor/${tutorId}`}
                          className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-700 transition-colors"
                        >
                          Review Tutor
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
