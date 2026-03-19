'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import ImageUpload from '@/app/components/ImageUpload'
import DocumentUpload from '@/app/components/DocumentUpload'
import LessonCard, { Lesson } from '@/app/components/LessonCard'

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const COMMISSION_RATE = 10
const DEFAULT_LESSON_MINUTES = 120

interface TutorProfileRow {
  id: string
  user_id: string
  name: string
  email: string
  phone: string | null
  location: string | null
  subjects: string[] | null
  experience_years: number | null
  hourly_rate: number | null
  bio: string | null
  available_days?: string[] | null
  available_times?: string[] | null
  profile_photo_url: string | null
}

interface InquiryRow {
  id: string
  family_name: string | null
  family_phone: string | null
  message: string | null
  created_at: string
}

interface BookingRow {
  id: string
  tutor_id: string
  family_id: string | null
  family_name: string
  family_phone: string | null
  subjects: string[] | null
  hours_per_month: number
  hourly_rate: number
  monthly_total: number
  service_fee: number
  grand_total: number
  special_requests: string | null
  preferred_days: string[] | null
  status: string | null
  created_at: string
}

interface PayoutRow {
  id: string
  tutor_id: string
  amount: number
  commission_deducted: number
  wave_reference: string | null
  status: string | null
  period_start: string | null
  period_end: string | null
  lessons_count: number | null
  requested_at: string
  completed_at: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'lessons' | 'earnings'>('profile')

  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const [profileId, setProfileId] = useState('')
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [bio, setBio] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [timeSlotInput, setTimeSlotInput] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [bookingRequests, setBookingRequests] = useState<BookingRow[]>([])
  const [activeBookings, setActiveBookings] = useState<BookingRow[]>([])
  const [isBookingsLoading, setIsBookingsLoading] = useState(false)
  const [bookingsError, setBookingsError] = useState('')
  const [bookingToast, setBookingToast] = useState('')
  const [declineBookingId, setDeclineBookingId] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [processingBookingId, setProcessingBookingId] = useState('')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLessonsLoading, setIsLessonsLoading] = useState(false)
  const [lessonsError, setLessonsError] = useState('')
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [isPayoutsLoading, setIsPayoutsLoading] = useState(false)
  const [payoutsError, setPayoutsError] = useState('')
  const [isRequestPayoutOpen, setIsRequestPayoutOpen] = useState(false)
  const [isRequestingPayout, setIsRequestingPayout] = useState(false)
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [isInquiriesLoading, setIsInquiriesLoading] = useState(false)
  const [inquiriesError, setInquiriesError] = useState('')

  const successTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bookingToastTimerRef = useRef<NodeJS.Timeout | null>(null)

  function formatInquiryDate(dateString: string) {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''

    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const loadInquiriesForTutor = useCallback(async (tutorProfileId: string) => {
    setIsInquiriesLoading(true)
    setInquiriesError('')

    try {
      let { data, error } = await supabase
        .from('inquiries')
        .select('id,family_name,family_phone,message,created_at')
        .eq('tutor_id', tutorProfileId)
        .order('created_at', { ascending: false })

      // Backward compatibility for legacy column name.
      if (error && error.message.toLowerCase().includes('tutor_id')) {
        const fallback = await supabase
          .from('inquiries')
          .select('id,family_name,family_phone,message,created_at')
          .eq('ustaz_id', tutorProfileId)
          .order('created_at', { ascending: false })
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error
      setInquiries((data ?? []) as InquiryRow[])
    } catch (err) {
      console.error(err)
      setInquiries([])
      setInquiriesError('Could not load inquiries right now. Please refresh and try again.')
    } finally {
      setIsInquiriesLoading(false)
    }
  }, [supabase])

  function showBookingToast(message: string) {
    setBookingToast(message)
    if (bookingToastTimerRef.current) {
      clearTimeout(bookingToastTimerRef.current)
    }
    bookingToastTimerRef.current = setTimeout(() => {
      setBookingToast('')
    }, 3000)
  }

  const loadBookingsForTutor = useCallback(async (tutorProfileId: string) => {
    setIsBookingsLoading(true)
    setBookingsError('')

    try {
      const { data, error: bookingsFetchError } = await supabase
        .from('bookings')
        .select('id,tutor_id,family_id,family_name,family_phone,subjects,hours_per_month,hourly_rate,monthly_total,service_fee,grand_total,special_requests,preferred_days,status,created_at')
        .eq('tutor_id', tutorProfileId)
        .order('created_at', { ascending: false })

      if (bookingsFetchError) throw bookingsFetchError

      const rows = (data ?? []) as BookingRow[]
      setBookingRequests(rows.filter((booking) => booking.status === 'pending'))
      setActiveBookings(rows.filter((booking) => booking.status === 'confirmed' || booking.status === 'active'))
    } catch (err) {
      console.error(err)
      setBookingRequests([])
      setActiveBookings([])
      setBookingsError('Could not load booking requests right now. Please refresh and try again.')
    } finally {
      setIsBookingsLoading(false)
    }
  }, [supabase])

  const loadLessonsForTutor = useCallback(async (tutorProfileId: string) => {
    setIsLessonsLoading(true)
    setLessonsError('')

    try {
      const { data, error: lessonsFetchError } = await supabase
        .from('lessons')
        .select('id,booking_id,tutor_id,family_id,lesson_number,duration_minutes,subject,status,tutor_notes,completed_at,created_at')
        .eq('tutor_id', tutorProfileId)
        .order('booking_id', { ascending: true })
        .order('lesson_number', { ascending: true })

      if (lessonsFetchError) throw lessonsFetchError
      setLessons((data ?? []) as Lesson[])
    } catch (err) {
      console.error(err)
      setLessons([])
      setLessonsError('Could not load your lessons right now. Please refresh and try again.')
    } finally {
      setIsLessonsLoading(false)
    }
  }, [supabase])

  const loadPayoutsForTutor = useCallback(async (tutorProfileId: string) => {
    setIsPayoutsLoading(true)
    setPayoutsError('')

    try {
      const { data, error: payoutsFetchError } = await supabase
        .from('payouts')
        .select('id,tutor_id,amount,commission_deducted,wave_reference,status,period_start,period_end,lessons_count,requested_at,completed_at')
        .eq('tutor_id', tutorProfileId)
        .order('requested_at', { ascending: false })

      if (payoutsFetchError) throw payoutsFetchError
      setPayouts((data ?? []) as PayoutRow[])
    } catch (err) {
      console.error(err)
      setPayouts([])
      setPayoutsError('Could not load payout history right now. Please refresh and try again.')
    } finally {
      setIsPayoutsLoading(false)
    }
  }, [supabase])

  function formatMoney(value: number) {
    return `D${value.toLocaleString()}`
  }

  function formatRelativeTime(dateString: string) {
    const created = new Date(dateString).getTime()
    if (Number.isNaN(created)) return 'Received recently'

    const diffHours = Math.max(1, Math.floor((Date.now() - created) / (1000 * 60 * 60)))
    return `Received ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  }

  async function handleAcceptBooking(booking: BookingRow) {
    setBookingsError('')
    setProcessingBookingId(booking.id)

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', booking.id)

      if (updateError) throw updateError

      const { count, error: existingLessonsError } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', booking.id)

      if (existingLessonsError) throw existingLessonsError

      if (!count) {
        const numLessons = Math.floor(booking.hours_per_month / 2)
        const lessonRows = Array.from({ length: numLessons }, (_, index) => ({
          booking_id: booking.id,
          tutor_id: booking.tutor_id,
          family_id: booking.family_id,
          lesson_number: index + 1,
          subject: booking.subjects?.[0] || null,
          status: 'scheduled',
        }))

        if (lessonRows.length > 0) {
          const { error: lessonsInsertError } = await supabase.from('lessons').insert(lessonRows)
          if (lessonsInsertError) throw lessonsInsertError
        }
      }

      setBookingRequests((prev) => prev.filter((item) => item.id !== booking.id))
      setActiveBookings((prev) => [{ ...booking, status: 'confirmed' }, ...prev])
      setDeclineBookingId('')
      setDeclineReason('')
      if (profileId) {
        void loadLessonsForTutor(profileId)
      }
      showBookingToast('Booking accepted.')
    } catch (err) {
      console.error(err)
      setBookingsError('Could not accept this booking. Please try again.')
    } finally {
      setProcessingBookingId('')
    }
  }

  async function handleDeclineBooking(bookingId: string) {
    setBookingsError('')
    setProcessingBookingId(bookingId)

    try {
      const details = declineReason.trim()
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          special_requests: details ? `Decline reason: ${details}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      if (updateError) throw updateError

      setBookingRequests((prev) => prev.filter((item) => item.id !== bookingId))
      setDeclineBookingId('')
      setDeclineReason('')
      showBookingToast('Booking declined.')
    } catch (err) {
      console.error(err)
      setBookingsError('Could not decline this booking. Please try again.')
    } finally {
      setProcessingBookingId('')
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
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

        setUserId(user.id)
        setEmail(user.email || '')

        const { data: profile, error: profileError } = await supabase
          .from('tutor_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle<TutorProfileRow>()

        if (profileError) throw profileError
        if (!isMounted) return

        if (profile) {
          setProfileId(profile.id)
          setName(profile.name || '')
          setPhone(profile.phone || '')
          setLocation(profile.location || '')
          setExperienceYears(profile.experience_years != null ? String(profile.experience_years) : '')
          setHourlyRate(profile.hourly_rate != null ? String(profile.hourly_rate) : '')
          setBio(profile.bio || '')
          setSubjects(profile.subjects || [])
          setAvailableDays(Array.isArray(profile.available_days) ? profile.available_days : [])
          setAvailableTimes(Array.isArray(profile.available_times) ? profile.available_times : [])
          setProfilePhotoUrl(profile.profile_photo_url || '')
          setEmail(profile.email || user.email || '')
          void loadBookingsForTutor(profile.id)
          void loadLessonsForTutor(profile.id)
          void loadPayoutsForTutor(profile.id)
          void loadInquiriesForTutor(profile.id)
        } else {
          const fallbackName =
            typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
          setName(fallbackName)
          setBookingRequests([])
          setActiveBookings([])
          setBookingsError('')
          setLessons([])
          setLessonsError('')
          setPayouts([])
          setPayoutsError('')
          setInquiries([])
          setInquiriesError('')
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError('Failed to load your profile. Please refresh and try again.')
        }
      } finally {
        if (isMounted) {
          setIsPageLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }
      if (bookingToastTimerRef.current) {
        clearTimeout(bookingToastTimerRef.current)
      }
    }
  }, [loadBookingsForTutor, loadInquiriesForTutor, loadLessonsForTutor, loadPayoutsForTutor, router, supabase])

  function toggleSubject(subject: string) {
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]
    )
  }

  function toggleDay(day: string) {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]
    )
  }

  function addTimeSlot() {
    const cleaned = timeSlotInput.trim()
    if (!cleaned) return
    if (availableTimes.includes(cleaned)) {
      setTimeSlotInput('')
      return
    }
    setAvailableTimes((prev) => [...prev, cleaned])
    setTimeSlotInput('')
  }

  function removeTimeSlot(slot: string) {
    setAvailableTimes((prev) => prev.filter((item) => item !== slot))
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!userId) {
      setError('You must be signed in to save your profile.')
      return
    }

    if (!email) {
      setError('No account email found. Please sign in again and try.')
      return
    }

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    setError('')
    setSaveMessage('')
    setIsSaving(true)

    try {
      const hourlyRateValue = hourlyRate.trim() === '' ? 0 : Number(hourlyRate)
      if (Number.isNaN(hourlyRateValue) || hourlyRateValue < 0) {
        throw new Error('Hourly rate must be a valid non-negative number.')
      }

      const experienceValue = experienceYears.trim() === '' ? 0 : Number(experienceYears)
      if (Number.isNaN(experienceValue) || experienceValue < 0) {
        throw new Error('Experience years must be a valid non-negative number.')
      }

      const basePayload = {
        ...(profileId ? { id: profileId } : {}),
        user_id: userId,
        name: name.trim(),
        email,
        phone: phone.trim() || null,
        location: location || null,
        subjects,
        experience_years: experienceValue,
        hourly_rate: hourlyRateValue,
        bio: bio.trim() || null,
        profile_photo_url: profilePhotoUrl || null,
        is_active: true,
        is_approved: true,
        updated_at: new Date().toISOString(),
      }

      let usedFallbackForDays = false
      let { data, error: saveError } = await supabase
        .from('tutor_profiles')
        .upsert({
          ...basePayload,
          available_days: availableDays,
          available_times: availableTimes,
        })
        .select('id')
        .single()

      // Graceful fallback while DB schema catches up.
      if (
        saveError &&
        (
          saveError.message.toLowerCase().includes('available_days') ||
          saveError.message.toLowerCase().includes('available_times') ||
          saveError.message.toLowerCase().includes('column')
        )
      ) {
        const fallbackResult = await supabase
          .from('tutor_profiles')
          .upsert(basePayload)
          .select('id')
          .single()
        data = fallbackResult.data
        saveError = fallbackResult.error

        if (!saveError) {
          usedFallbackForDays = true
          setSaveMessage(
            'Profile saved. To enable availability fields, run: ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT \'{}\'; ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS available_times TEXT[] DEFAULT \'{}\';'
          )
          if (successTimerRef.current) {
            clearTimeout(successTimerRef.current)
          }
          successTimerRef.current = setTimeout(() => {
            setSaveMessage('')
          }, 6000)
        }
      }

      if (saveError) throw saveError
      if (data?.id) {
        setProfileId(data.id)
        void loadInquiriesForTutor(data.id)
      }

      if (!usedFallbackForDays) {
        setSaveMessage('✓ Profile saved successfully!')
        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current)
        }
        successTimerRef.current = setTimeout(() => {
          setSaveMessage('')
        }, 3000)
      }
    } catch (err) {
      console.error(err)
      if (err instanceof Error && (err.message.includes('Hourly rate') || err.message.includes('Experience'))) {
        setError(err.message)
      } else {
        setError('Failed to save profile. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

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

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-gray-600">Loading your profile...</p>
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

  const bookingsById = activeBookings.reduce<Record<string, BookingRow>>((acc, booking) => {
    acc[booking.id] = booking
    return acc
  }, {})

  const completedLessonRows = lessons
    .filter((lesson) => lesson.status === 'completed')
    .map((lesson) => {
      const booking = bookingsById[lesson.booking_id]
      if (!booking || booking.status !== 'active') return null

      const lessonHours = Math.max(1, Math.round((lesson.duration_minutes ?? DEFAULT_LESSON_MINUTES) / 60))
      const grossAmount = lessonHours * booking.hourly_rate
      const commissionAmount = Math.round(grossAmount * (COMMISSION_RATE / 100))
      const netAmount = grossAmount - commissionAmount

      return {
        ...lesson,
        familyName: booking.family_name,
        bookingStatus: booking.status,
        lessonHours,
        grossAmount,
        commissionAmount,
        netAmount,
        completedAtSortable: lesson.completed_at || lesson.created_at,
      }
    })
    .filter((lesson): lesson is NonNullable<typeof lesson> => lesson !== null)
    .sort((a, b) => new Date(a.completedAtSortable).getTime() - new Date(b.completedAtSortable).getTime())

  const reservedPayoutLessonCount = payouts.reduce((sum, payout) => {
    if (payout.status === 'pending' || payout.status === 'completed') {
      return sum + (payout.lessons_count || 0)
    }
    return sum
  }, 0)

  const completedPayoutLessonCount = payouts.reduce((sum, payout) => {
    if (payout.status === 'completed') {
      return sum + (payout.lessons_count || 0)
    }
    return sum
  }, 0)

  const payableLessons = completedLessonRows.slice(Math.min(reservedPayoutLessonCount, completedLessonRows.length))
  const lessonsThisMonth = completedLessonRows.filter((lesson) => {
    const date = new Date(lesson.completedAtSortable)
    const now = new Date()
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length
  const totalEarned = completedLessonRows.reduce((sum, lesson) => sum + lesson.netAmount, 0)
  const totalCommission = completedLessonRows.reduce((sum, lesson) => sum + lesson.commissionAmount, 0)
  const pendingPayoutAmount = payableLessons.reduce((sum, lesson) => sum + lesson.netAmount, 0)
  const pendingCommissionAmount = payableLessons.reduce((sum, lesson) => sum + lesson.commissionAmount, 0)
  const completedPayoutAmount = payouts.reduce((sum, payout) => {
    if (payout.status === 'completed') {
      return sum + payout.amount
    }
    return sum
  }, 0)

  async function handleRequestPayout() {
    if (!profileId || pendingPayoutAmount <= 0 || payableLessons.length === 0) return

    setPayoutsError('')
    setIsRequestingPayout(true)

    try {
      const periodStart = payableLessons[0]?.completed_at?.slice(0, 10) || null
      const periodEnd = payableLessons[payableLessons.length - 1]?.completed_at?.slice(0, 10) || null

      const { error: insertError } = await supabase.from('payouts').insert({
        tutor_id: profileId,
        amount: pendingPayoutAmount,
        commission_deducted: pendingCommissionAmount,
        lessons_count: payableLessons.length,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'pending',
      })

      if (insertError) throw insertError

      setIsRequestPayoutOpen(false)
      showBookingToast('Request sent. Admin processes within 24 hours.')
      void loadPayoutsForTutor(profileId)
    } catch (err) {
      console.error(err)
      setPayoutsError('Could not request payout right now. Please try again.')
    } finally {
      setIsRequestingPayout(false)
    }
  }

  function formatShortDate(dateString: string | null) {
    if (!dateString) return '—'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Tutor Dashboard</h1>
          <p className="text-base text-gray-600 mt-2">Update your profile to help families find you faster.</p>
          {profileId ? (
            <Link
              href={`/ustaz/${profileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-4 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              View My Public Profile
            </Link>
          ) : (
            <p className="text-sm text-gray-500 mt-4">
              Save your profile first to generate your public profile link.
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {saveMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6">
            {saveMessage}
          </div>
        )}

        {bookingToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6">
            {bookingToast}
          </div>
        )}

        <section className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Booking Requests</h2>
              <p className="text-sm text-gray-600 mt-1">
                New family booking requests appear here for review.
              </p>
            </div>
            {profileId && (
              <button
                type="button"
                onClick={() => void loadBookingsForTutor(profileId)}
                className="bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>

          {bookingsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {bookingsError}
            </div>
          )}

          {!profileId ? (
            <p className="text-gray-600">Save your profile first to receive booking requests.</p>
          ) : isBookingsLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading booking requests...</span>
            </div>
          ) : bookingRequests.length === 0 ? (
            <p className="text-gray-600">No pending booking requests right now.</p>
          ) : (
            <div className="space-y-4">
              {bookingRequests.map((booking) => (
                <article key={booking.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{booking.family_name}</h3>
                      <p className="text-emerald-700 mt-1">{booking.family_phone || 'No phone provided'}</p>
                    </div>
                    <p className="text-sm text-gray-500">{formatRelativeTime(booking.created_at)}</p>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <span className="font-medium">Subjects:</span>{' '}
                      {(booking.subjects || []).join(', ') || 'Not provided'}
                    </p>
                    <p>
                      <span className="font-medium">Hours per month:</span> {booking.hours_per_month}
                    </p>
                    <p>
                      <span className="font-medium">Total:</span> {formatMoney(booking.grand_total)}
                    </p>
                  </div>

                  {(booking.preferred_days || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(booking.preferred_days || []).map((day) => (
                        <span key={day} className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                          {day}
                        </span>
                      ))}
                    </div>
                  )}

                  {booking.special_requests && (
                    <p className="mt-3 text-sm text-gray-500 italic whitespace-pre-wrap">{booking.special_requests}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleAcceptBooking(booking)}
                      disabled={processingBookingId === booking.id}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {processingBookingId === booking.id ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeclineBookingId((prev) => (prev === booking.id ? '' : booking.id))
                        setDeclineReason('')
                      }}
                      disabled={processingBookingId === booking.id}
                      className="border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Decline
                    </button>
                  </div>

                  {declineBookingId === booking.id && (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={declineReason}
                        onChange={(event) => setDeclineReason(event.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="Reason (optional)"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDeclineBooking(booking.id)}
                        disabled={processingBookingId === booking.id}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {processingBookingId === booking.id ? 'Processing...' : 'Confirm Decline'}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Active Bookings</h2>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            Confirmed family bookings are listed here.
          </p>

          {!profileId ? (
            <p className="text-gray-600">Save your profile first to enable bookings.</p>
          ) : isBookingsLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading active bookings...</span>
            </div>
          ) : activeBookings.length === 0 ? (
            <p className="text-gray-600">No active bookings yet.</p>
          ) : (
            <div className="space-y-3">
              {activeBookings.map((booking) => (
                <article key={booking.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{booking.family_name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {(booking.subjects || []).join(', ') || 'No subject'} · {booking.hours_per_month} hours/month
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
                      Active
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'lessons'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            My Lessons
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'earnings'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Earnings
          </button>
        </div>

        {activeTab === 'profile' ? (
          <>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ImageUpload
                  currentPhotoUrl={profilePhotoUrl || undefined}
                  onUpload={(url) => setProfilePhotoUrl(url)}
                />
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="+220 XXX XXXX"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <select
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select your location</option>
                  {ALL_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="experience-years" className="block text-sm font-medium text-gray-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    id="experience-years"
                    type="number"
                    min="0"
                    max="50"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. 3"
                  />
                </div>

                <div>
                  <label htmlFor="hourly-rate" className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (Dalasi)
                  </label>
                  <input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Tell families about your teaching style and experience."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const selected = availableDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-2 rounded-full text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="time-slot-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Available Times
                </label>
                <div className="flex gap-2">
                  <input
                    id="time-slot-input"
                    type="text"
                    value={timeSlotInput}
                    onChange={(e) => setTimeSlotInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTimeSlot()
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Example: 8:00 AM - 10:00 AM"
                  />
                  <button
                    type="button"
                    onClick={addTimeSlot}
                    className="bg-white text-gray-700 font-medium px-4 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {availableTimes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableTimes.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => removeTimeSlot(slot)}
                        className="px-3 py-2 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        title="Click to remove"
                      >
                        {slot} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subjects</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SUBJECTS.map((subject) => {
                    const selected = subjects.includes(subject)
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleSubject(subject)}
                        className={`px-3 py-2 rounded-full text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {subject}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div id="documents">
                <h2 className="text-lg font-semibold text-gray-900">Verification Documents</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload your ID and certificates to earn a Verified badge. We review within 24 hours.
                </p>

                {profileId ? (
                  <div className="space-y-3 mt-4">
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="national_id"
                      label="National ID or Passport (required)"
                    />
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="certificate"
                      label="Teaching Certificate or Degree (required)"
                    />
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="cv"
                      label="CV / Resume (optional)"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-4">
                    Save your profile first, then you can upload verification documents.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
                </form>
              </div>
            </div>

            <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Recent Inquiries</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Families who contacted you from your public profile appear here.
                  </p>
                </div>
                {profileId && (
                  <button
                    type="button"
                    onClick={() => void loadInquiriesForTutor(profileId)}
                    className="bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {!profileId ? (
                <p className="text-gray-600">Save your profile first to enable inquiries.</p>
              ) : isInquiriesLoading ? (
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading inquiries...</span>
                </div>
              ) : inquiriesError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {inquiriesError}
                </div>
              ) : inquiries.length === 0 ? (
                <p className="text-gray-600">No inquiries yet. When families contact you, they will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {inquiries.map((inquiry) => (
                    <article key={inquiry.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{inquiry.family_name || 'Family'}</h3>
                        <p className="text-sm text-gray-500">{formatInquiryDate(inquiry.created_at)}</p>
                      </div>
                      <p className="text-emerald-700 mt-1">{inquiry.family_phone || 'No phone provided'}</p>
                      {inquiry.message ? (
                        <p className="mt-3 text-gray-700 whitespace-pre-wrap">{inquiry.message}</p>
                      ) : (
                        <p className="mt-3 text-gray-500">No message provided.</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'lessons' ? (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">My Lessons</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Track scheduled lessons and mark them complete after each session.
                </p>
              </div>
              {profileId && (
                <button
                  type="button"
                  onClick={() => void loadLessonsForTutor(profileId)}
                  className="bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Refresh
                </button>
              )}
            </div>

            {!profileId ? (
              <p className="text-gray-600">Save your profile first to enable lessons.</p>
            ) : isLessonsLoading ? (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading lessons...</span>
              </div>
            ) : lessonsError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {lessonsError}
              </div>
            ) : lessons.length === 0 ? (
              <p className="text-gray-600">No lessons yet. Accept a booking request to generate lesson cards.</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(lessonsByBooking).map(([bookingId, bookingLessons]) => {
                  const booking = activeBookings.find((item) => item.id === bookingId)
                  return (
                    <div key={bookingId}>
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {booking?.family_name ? `Family: ${booking.family_name}` : `Booking ${bookingId.slice(0, 8)}`}
                        </h3>
                        {booking?.subjects && booking.subjects.length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">{booking.subjects.join(', ')}</p>
                        )}
                      </div>
                      <div className="space-y-3">
                        {bookingLessons.map((lesson) => (
                          <LessonCard
                            key={lesson.id}
                            lesson={lesson}
                            viewAs="tutor"
                            totalLessons={bookingLessons.length}
                            onUpdated={() => {
                              if (profileId) {
                                void loadLessonsForTutor(profileId)
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500">Lessons This Month</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{lessonsThisMonth}</p>
              </article>
              <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500">Pending Payout</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(pendingPayoutAmount)}</p>
              </article>
              <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500">Commission Paid</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(totalCommission)}</p>
              </article>
              <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm text-gray-500">Total Earned</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(totalEarned)}</p>
              </article>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Completed Lessons</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Track what you earned for each completed, paid lesson.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRequestPayoutOpen(true)}
                  disabled={pendingPayoutAmount <= 0 || payableLessons.length === 0 || isRequestingPayout}
                  className="bg-emerald-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request Payout
                </button>
              </div>

              {payoutsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {payoutsError}
                </div>
              )}

              {completedLessonRows.length === 0 ? (
                <p className="text-gray-600">
                  No completed lessons from active bookings yet. Complete a lesson after payment is confirmed to see earnings here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-200">
                        <th className="py-3 pr-4 font-medium">Date</th>
                        <th className="py-3 pr-4 font-medium">Family</th>
                        <th className="py-3 pr-4 font-medium">Subject</th>
                        <th className="py-3 pr-4 font-medium">Hours</th>
                        <th className="py-3 pr-4 font-medium">Earned</th>
                        <th className="py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedLessonRows.map((lesson, index) => {
                        const isPaidOut = index < completedPayoutLessonCount
                        return (
                          <tr key={lesson.id} className="border-b border-gray-100 last:border-b-0">
                            <td className="py-3 pr-4 text-gray-700">{formatShortDate(lesson.completed_at)}</td>
                            <td className="py-3 pr-4 text-gray-900">{lesson.familyName}</td>
                            <td className="py-3 pr-4 text-gray-700">{lesson.subject || 'General tutoring'}</td>
                            <td className="py-3 pr-4 text-gray-700">{lesson.lessonHours}</td>
                            <td className="py-3 pr-4 font-medium text-gray-900">{formatMoney(lesson.netAmount)}</td>
                            <td className="py-3">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                  isPaidOut
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {isPaidOut ? 'Paid out' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Payout History</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Review what has been requested and what has already been paid out.
                  </p>
                </div>
                {profileId && (
                  <button
                    type="button"
                    onClick={() => void loadPayoutsForTutor(profileId)}
                    className="bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Refresh
                  </button>
                )}
              </div>

              <div className="mb-4 text-sm text-gray-600">
                Paid out so far: <span className="font-medium text-gray-900">{formatMoney(completedPayoutAmount)}</span>
              </div>

              {isPayoutsLoading ? (
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading payout history...</span>
                </div>
              ) : payouts.length === 0 ? (
                <p className="text-gray-600">No payout requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-200">
                        <th className="py-3 pr-4 font-medium">Date</th>
                        <th className="py-3 pr-4 font-medium">Amount</th>
                        <th className="py-3 pr-4 font-medium">Wave Reference</th>
                        <th className="py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((payout) => (
                        <tr key={payout.id} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-3 pr-4 text-gray-700">{formatShortDate(payout.requested_at)}</td>
                          <td className="py-3 pr-4 font-medium text-gray-900">{formatMoney(payout.amount)}</td>
                          <td className="py-3 pr-4 text-gray-700">{payout.wave_reference || '—'}</td>
                          <td className="py-3">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                payout.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {payout.status === 'completed' ? 'Paid out' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {isRequestPayoutOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900">Request Payout</h2>
              <p className="text-sm text-gray-600 mt-2">
                Confirm this payout request for your currently unpaid completed lessons.
              </p>

              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-600">Lessons included</span>
                  <span className="font-medium text-gray-900">{payableLessons.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-600">Commission deducted</span>
                  <span className="font-medium text-gray-900">{formatMoney(pendingCommissionAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-2">
                  <span className="font-medium text-gray-900">Payout amount</span>
                  <span className="font-bold text-emerald-700">{formatMoney(pendingPayoutAmount)}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestPayoutOpen(false)}
                  disabled={isRequestingPayout}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRequestPayout()}
                  disabled={isRequestingPayout || pendingPayoutAmount <= 0}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRequestingPayout ? 'Sending...' : 'Confirm Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
