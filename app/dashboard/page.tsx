'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import { computeLessonEarning, lessonHoursFromMinutes } from '@/lib/pricing'
import { computePayableSummary } from '@/lib/payouts'
import ImageUpload from '@/app/components/ImageUpload'
import DocumentUpload from '@/app/components/DocumentUpload'
import type { DocumentType } from '@/app/components/DocumentUpload'
import LessonCard, { Lesson } from '@/app/components/LessonCard'
import {
  AGE_GROUP_OPTIONS,
  EDUCATION_OPTIONS,
  extractGambiaPhoneDigits,
  formatGambiaPhoneFromDigits,
  GENDER_OPTIONS,
  isMissingEnhancedTutorProfileColumnError,
  isValidGambiaPhoneDigits,
  LANGUAGE_OPTIONS,
  sanitizeGambiaPhoneDigits,
  TRAVEL_RADIUS_OPTIONS,
  TUTOR_PROFILE_TASK_2_3_SQL,
} from '@/lib/tutor-profile'
import {
  BASIC_TUTOR_GRACE_PERIOD_DAYS,
  getBasicTutorGraceInfo,
  isTutorPubliclyVisible,
  normalizeTutorVerificationStatus,
  TUTOR_REVIEW_CONTACT_EMAIL,
  type TutorVerificationStatus,
} from '@/lib/tutor-review'

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface TutorProfileRow {
  id: string
  user_id: string
  created_at?: string | null
  name: string | null
  email: string | null
  phone: string | null
  gender?: string | null
  location: string | null
  subjects: string[] | null
  experience_years: number | null
  hourly_rate: number | null
  bio: string | null
  available_days?: string[] | null
  available_times?: string[] | null
  profile_photo_url: string | null
  is_approved?: boolean | null
  verification_status?: string | null
  offers_online?: boolean | null
  areas_covered?: string[] | null
  travel_radius_km?: number | null
  languages?: string[] | null
  age_groups?: string[] | null
  education?: string | null
  consent_given_at?: string | null
}

function normalizeStringArray(value: string[] | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function areSameStringArrays(left: string[], right: string[]) {
  if (left.length !== right.length) return false

  return left.every((item, index) => item === right[index])
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

type TutorProfileSaveResult = Pick<
  TutorProfileRow,
  | 'id'
  | 'areas_covered'
  | 'languages'
  | 'age_groups'
  | 'education'
  | 'experience_years'
  | 'offers_online'
  | 'available_days'
  | 'available_times'
>

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
  const [profileCreatedAt, setProfileCreatedAt] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [storedPhoneDigits, setStoredPhoneDigits] = useState('')
  const [location, setLocation] = useState('')
  const [travelRadiusKm, setTravelRadiusKm] = useState('5')
  const [areasCovered, setAreasCovered] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [ageGroups, setAgeGroups] = useState<string[]>([])
  const [education, setEducation] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [bio, setBio] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [timeSlotInput, setTimeSlotInput] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [isApproved, setIsApproved] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<TutorVerificationStatus>('basic')
  const [offersOnline, setOffersOnline] = useState(false)
  const [hasTutorConsent, setHasTutorConsent] = useState(false)
  const [consentGivenAt, setConsentGivenAt] = useState<string | null>(null)
  const [documentStatuses, setDocumentStatuses] = useState<
    Partial<Record<DocumentType, string | null>>
  >({})
  const [bookingRequests, setBookingRequests] = useState<BookingRow[]>([])
  const [awaitingPaymentBookings, setAwaitingPaymentBookings] = useState<BookingRow[]>([])
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

  const handleDocumentStatusChange = useCallback((payload: {
    documentType: DocumentType
    hasDocument: boolean
    status: string | null
  }) => {
    setDocumentStatuses((prev) => ({
      ...prev,
      [payload.documentType]: payload.hasDocument ? payload.status || 'pending' : null,
    }))
  }, [])

  const loadInquiriesForTutor = useCallback(async (tutorProfileId: string) => {
    setIsInquiriesLoading(true)
    setInquiriesError('')

    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('id,family_name,family_phone,message,created_at')
        .eq('tutor_id', tutorProfileId)
        .order('created_at', { ascending: false })

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
      setAwaitingPaymentBookings(rows.filter((booking) => booking.status === 'confirmed'))
      setActiveBookings(rows.filter((booking) => booking.status === 'active'))
    } catch (err) {
      console.error(err)
      setBookingRequests([])
      setAwaitingPaymentBookings([])
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

      setBookingRequests((prev) => prev.filter((item) => item.id !== booking.id))
      setAwaitingPaymentBookings((prev) => [{ ...booking, status: 'confirmed' }, ...prev])
      setDeclineBookingId('')
      setDeclineReason('')
      showBookingToast('Booking accepted. The family can now complete payment.')
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
        const metadata = user.user_metadata ?? {}

        const { data: profile, error: profileError } = await supabase
          .from('tutor_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle<TutorProfileRow>()

        if (profileError) throw profileError
        if (!isMounted) return

        if (profile) {
          const normalizedStoredPhone = extractGambiaPhoneDigits(profile.phone)
          setProfileId(profile.id)
          setProfileCreatedAt(profile.created_at || null)
          setName(profile.name || '')
          setGender(profile.gender || '')
          setStoredPhoneDigits(normalizedStoredPhone)
          setPhone('')
          setLocation(profile.location || '')
          setTravelRadiusKm(profile.travel_radius_km != null ? String(profile.travel_radius_km) : '5')
          setAreasCovered(normalizeStringArray(profile.areas_covered))
          setLanguages(normalizeStringArray(profile.languages))
          setAgeGroups(normalizeStringArray(profile.age_groups))
          setEducation(profile.education || '')
          setExperienceYears(profile.experience_years != null ? String(profile.experience_years) : '')
          setHourlyRate(profile.hourly_rate != null ? String(profile.hourly_rate) : '')
          setBio(profile.bio || '')
          setSubjects(profile.subjects || [])
          setAvailableDays(Array.isArray(profile.available_days) ? profile.available_days : [])
          setAvailableTimes(Array.isArray(profile.available_times) ? profile.available_times : [])
          setProfilePhotoUrl(profile.profile_photo_url || '')
          setIsApproved(Boolean(profile.is_approved))
          setVerificationStatus(normalizeTutorVerificationStatus(profile.verification_status))
          setOffersOnline(Boolean(profile.offers_online))
          setConsentGivenAt(profile.consent_given_at || null)
          setHasTutorConsent(Boolean(profile.consent_given_at))
          setEmail(profile.email || user.email || '')
          void loadBookingsForTutor(profile.id)
          void loadLessonsForTutor(profile.id)
          void loadPayoutsForTutor(profile.id)
          void loadInquiriesForTutor(profile.id)
        } else {
          const fallbackName =
            typeof metadata.full_name === 'string' ? metadata.full_name : ''
          const fallbackPhone =
            typeof metadata.phone === 'string' ? extractGambiaPhoneDigits(metadata.phone) : ''
          const fallbackGender =
            typeof metadata.gender === 'string' ? metadata.gender : ''
          const fallbackSubjects = Array.isArray(metadata.selected_subjects)
            ? metadata.selected_subjects.filter((item): item is string => typeof item === 'string')
            : []
          const fallbackAreasCovered = normalizeStringArray(metadata.areas_covered as string[] | undefined)
          const fallbackLanguages = normalizeStringArray(metadata.languages as string[] | undefined)
          const fallbackAgeGroups = normalizeStringArray(metadata.age_groups as string[] | undefined)

          setIsApproved(false)
          setProfileCreatedAt(null)
          setVerificationStatus('basic')
          setOffersOnline(Boolean(metadata.offers_online))
          setName(fallbackName)
          setGender(fallbackGender)
          setStoredPhoneDigits(fallbackPhone)
          setPhone('')
          setTravelRadiusKm(typeof metadata.travel_radius_km === 'number' ? String(metadata.travel_radius_km) : '5')
          setAreasCovered(fallbackAreasCovered)
          setLanguages(fallbackLanguages)
          setAgeGroups(fallbackAgeGroups)
          setEducation(typeof metadata.education === 'string' ? metadata.education : '')
          setExperienceYears(
            typeof metadata.experience_years === 'number' ? String(metadata.experience_years) : ''
          )
          setSubjects(fallbackSubjects)
          setHasTutorConsent(typeof metadata.consent_given_at === 'string')
          setConsentGivenAt(typeof metadata.consent_given_at === 'string' ? metadata.consent_given_at : null)
          setLocation('')
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

  function toggleAreaCovered(area: string) {
    setAreasCovered((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area]
    )
  }

  function toggleLanguage(language: string) {
    setLanguages((prev) =>
      prev.includes(language) ? prev.filter((item) => item !== language) : [...prev, language]
    )
  }

  function toggleAgeGroup(ageGroup: string) {
    setAgeGroups((prev) =>
      prev.includes(ageGroup) ? prev.filter((item) => item !== ageGroup) : [...prev, ageGroup]
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
      setError('Please enter your full name before saving.')
      return
    }

    if (!gender) {
      setError('Please select your gender before saving.')
      return
    }

    const phoneDigitsToSave = sanitizeGambiaPhoneDigits(phone) || storedPhoneDigits

    if (!isValidGambiaPhoneDigits(phoneDigitsToSave)) {
      setError('Please enter your 7-digit Gambian phone number after +220 before saving.')
      return
    }

    if (languages.length === 0) {
      setError('Please select at least one language you can teach or communicate in before saving.')
      return
    }

    if (!hasTutorConsent) {
      setError('Please confirm your tutor consent before saving your profile.')
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

      const travelRadiusValue = Number(travelRadiusKm) || 5
      const consentTimestamp = consentGivenAt || new Date().toISOString()
      const submittedAreasCovered = [...areasCovered]
      const submittedLanguages = [...languages]
      const submittedAgeGroups = [...ageGroups]
      const submittedEducation = education || ''
      const submittedAvailableDays = [...availableDays]
      const submittedAvailableTimes = [...availableTimes]

      const basePayload = {
        ...(profileId ? { id: profileId } : {}),
        user_id: userId,
        name: name.trim(),
        email,
        phone: formatGambiaPhoneFromDigits(phoneDigitsToSave) || null,
        gender,
        location: location || null,
        subjects,
        experience_years: experienceValue,
        hourly_rate: hourlyRateValue,
        bio: bio.trim() || null,
        profile_photo_url: profilePhotoUrl || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      let usedFallbackForOptionalColumns = false
      let { data, error: saveError } = await supabase
        .from('tutor_profiles')
        .upsert({
          ...basePayload,
          offers_online: offersOnline,
          available_days: submittedAvailableDays,
          available_times: submittedAvailableTimes,
          areas_covered: submittedAreasCovered,
          travel_radius_km: travelRadiusValue,
          languages: submittedLanguages,
          age_groups: submittedAgeGroups,
          education: submittedEducation,
          consent_given_at: consentTimestamp,
        })
        .select('id,areas_covered,languages,age_groups,education,experience_years,offers_online,available_days,available_times')
        .single()

      // Graceful fallback while DB schema catches up.
      if (
        saveError &&
        isMissingEnhancedTutorProfileColumnError(saveError.message)
      ) {
        const fallbackResult = await supabase
          .from('tutor_profiles')
          .upsert(basePayload)
          .select('id,areas_covered,languages,age_groups,education,experience_years,offers_online,available_days,available_times')
          .single()
        data = fallbackResult.data
        saveError = fallbackResult.error

        if (!saveError) {
          usedFallbackForOptionalColumns = true
          setSaveMessage(
            `Profile saved with the current schema. To enable all Task 2.3 tutor fields, run: ${TUTOR_PROFILE_TASK_2_3_SQL}`
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
        setConsentGivenAt(consentTimestamp)
        setStoredPhoneDigits(phoneDigitsToSave)
        setPhone('')
        void loadInquiriesForTutor(data.id)
      }

      const savedProfile = data as TutorProfileSaveResult | null
      if (savedProfile) {
        const persistedAreasCovered = normalizeStringArray(savedProfile.areas_covered)
        const persistedLanguages = normalizeStringArray(savedProfile.languages)
        const persistedAgeGroups = normalizeStringArray(savedProfile.age_groups)
        const persistedAvailableDays = normalizeStringArray(savedProfile.available_days)
        const persistedAvailableTimes = normalizeStringArray(savedProfile.available_times)
        const persistedEducation = savedProfile.education || ''

        setAreasCovered(persistedAreasCovered)
        setLanguages(persistedLanguages)
        setAgeGroups(persistedAgeGroups)

        if (
          !usedFallbackForOptionalColumns &&
          (
            !areSameStringArrays(persistedAreasCovered, submittedAreasCovered) ||
            !areSameStringArrays(persistedLanguages, submittedLanguages) ||
            !areSameStringArrays(persistedAgeGroups, submittedAgeGroups) ||
            !areSameStringArrays(persistedAvailableDays, submittedAvailableDays) ||
            !areSameStringArrays(persistedAvailableTimes, submittedAvailableTimes) ||
            persistedEducation !== submittedEducation
          )
        ) {
          throw new Error('Some advanced profile fields did not save correctly. Please refresh and try again.')
        }
      }

      if (!usedFallbackForOptionalColumns) {
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
      if (
        err instanceof Error &&
        (
          err.message.includes('Hourly rate') ||
          err.message.includes('Experience') ||
          err.message.includes('advanced profile fields')
        )
      ) {
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

      const lessonHours = lessonHoursFromMinutes(lesson.duration_minutes)
      const { gross: grossAmount, commission: commissionAmount, net: netAmount } = computeLessonEarning({
        hourlyRate: booking.hourly_rate,
        lessonHours,
      })

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

  const completedPayoutLessonCount = payouts.reduce((sum, payout) => {
    if (payout.status === 'completed') {
      return sum + (payout.lessons_count || 0)
    }
    return sum
  }, 0)

  // Payout estimate comes from the shared, server-authoritative calculator, so the
  // on-screen amount always matches what the server will pay. Regular payouts
  // settle monthly: only lessons whose month has ended are payable.
  const payoutSummary = computePayableSummary({
    lessons,
    bookingsById,
    existingPayouts: payouts,
  })
  const pendingPayoutAmount = payoutSummary.amount
  const pendingCommissionAmount = payoutSummary.commissionDeducted
  const payableLessonsCount = payoutSummary.lessonsCount

  const now = new Date()
  const isCurrentMonth = (dateString: string) => {
    const date = new Date(dateString)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }
  const lessonsThisMonth = completedLessonRows.filter((lesson) =>
    isCurrentMonth(lesson.completedAtSortable)
  ).length
  // Earned this month but not payable until the month ends.
  const currentMonthEarnings = completedLessonRows
    .filter((lesson) => isCurrentMonth(lesson.completedAtSortable))
    .reduce((sum, lesson) => sum + lesson.netAmount, 0)
  const totalEarned = completedLessonRows.reduce((sum, lesson) => sum + lesson.netAmount, 0)
  const totalCommission = completedLessonRows.reduce((sum, lesson) => sum + lesson.commissionAmount, 0)
  const completedPayoutAmount = payouts.reduce((sum, payout) => {
    if (payout.status === 'completed') {
      return sum + payout.amount
    }
    return sum
  }, 0)

  async function handleRequestPayout() {
    if (!profileId || pendingPayoutAmount <= 0 || payableLessonsCount === 0) return

    setPayoutsError('')
    setIsRequestingPayout(true)

    try {
      // The payout amount is computed and created server-side (authoritative);
      // the dashboard only shows an estimate.
      const response = await fetch('/api/payouts/request', { method: 'POST' })
      const payload = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not request payout right now.')
      }

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

  const reviewDocumentStatuses = [
    documentStatuses.certificate,
    documentStatuses.study_proof,
    documentStatuses.teaching_reference,
  ]
  const hasPendingReviewDocument = reviewDocumentStatuses.some(
    (status) => (status || '').toLowerCase() === 'pending'
  )
  const hasApprovedQualificationDocument =
    (documentStatuses.certificate || '').toLowerCase() === 'approved'
  const hasApprovedProfileReviewedDocument =
    (documentStatuses.study_proof || '').toLowerCase() === 'approved' ||
    (documentStatuses.teaching_reference || '').toLowerCase() === 'approved'
  const shouldShowVerificationChecklist = verificationStatus === 'basic'
  const basicTutorGraceInfo = getBasicTutorGraceInfo(profileCreatedAt)
  const isProfilePubliclyVisible = isTutorPubliclyVisible({
    isApproved,
    verificationStatus,
    createdAt: profileCreatedAt,
  })

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
          {!isApproved && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your tutor profile is under review. Before we can list it publicly, upload a clear profile photo and at least one review document. We aim to respond within 5 working days. Questions: {TUTOR_REVIEW_CONTACT_EMAIL}
            </div>
          )}
          {shouldShowVerificationChecklist && profileId && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
              <p className="font-semibold">
                {isApproved && isProfilePubliclyVisible
                  ? 'Your profile is live, but it still shows the Basic label.'
                  : isApproved
                    ? 'Your Basic profile is no longer public right now.'
                  : 'Complete the items below so we can review and list your profile.'}
              </p>
              <p className="mt-1 text-sky-800">
                Once these are in place, your profile can move toward{' '}
                <span className="font-medium">Profile Reviewed</span> or{' '}
                <span className="font-medium">Qualification Verified</span>, depending on the documents you upload.
              </p>
              {isApproved && (
                <p className="mt-2 text-sky-800">
                  Basic profiles can stay public for up to {BASIC_TUTOR_GRACE_PERIOD_DAYS} days while you complete verification.
                  {isProfilePubliclyVisible
                    ? ` You currently have ${basicTutorGraceInfo.daysRemaining} day${basicTutorGraceInfo.daysRemaining === 1 ? '' : 's'} left before your public listing is paused.`
                    : ' Your public listing is paused until you upload the missing items below and complete review.'}
                </p>
              )}
              <ul className="mt-3 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-semibold">{profilePhotoUrl ? 'Done:' : 'Missing:'}</span>
                  <span>
                    {profilePhotoUrl ? 'Your profile photo has been uploaded.' : 'Add a clear profile photo to complete your profile.'}{' '}
                    <a href="#profile-photo" className="underline underline-offset-2">
                      Go to photo upload
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-semibold">
                    {hasApprovedQualificationDocument || hasApprovedProfileReviewedDocument
                      ? 'Done:'
                      : hasPendingReviewDocument
                        ? 'Pending:'
                        : 'Missing:'}
                  </span>
                  <span>
                    {hasApprovedQualificationDocument
                      ? 'Your qualification document has been approved.'
                      : hasApprovedProfileReviewedDocument
                        ? 'Your review document has been approved.'
                        : hasPendingReviewDocument
                          ? 'We have received your review document and it is waiting for admin review.'
                          : 'Add at least one review document so we can assess your profile for stronger verification.'}{' '}
                    <a href="#documents" className="underline underline-offset-2">
                      Go to documents
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          )}
          {profileId && isApproved && isProfilePubliclyVisible ? (
            <Link
              href={`/tutor/${profileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-4 px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              View My Public Profile
            </Link>
          ) : profileId && isApproved ? (
            <p className="text-sm text-gray-500 mt-4">
              Your account is active, but your public listing is paused until you complete the missing verification items.
            </p>
          ) : profileId ? (
            <p className="text-sm text-gray-500 mt-4">
              Your profile is saved but not public yet. We will list it after review is complete.
            </p>
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
          <h2 className="text-2xl font-bold text-gray-900">Awaiting Family Payment</h2>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            These bookings are accepted and waiting for the family to pay before lessons start.
          </p>

          {!profileId ? (
            <p className="text-gray-600">Save your profile first to enable bookings.</p>
          ) : isBookingsLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading accepted bookings...</span>
            </div>
          ) : awaitingPaymentBookings.length === 0 ? (
            <p className="text-gray-600">No accepted bookings are waiting for payment.</p>
          ) : (
            <div className="space-y-3">
              {awaitingPaymentBookings.map((booking) => (
                <article key={booking.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{booking.family_name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {(booking.subjects || []).join(', ') || 'No subject'} · {booking.hours_per_month} hours/month
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                      Awaiting payment
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-2xl font-bold text-gray-900">Active Bookings</h2>
          <p className="text-sm text-gray-600 mt-1 mb-4">
            These bookings are fully paid and now have lessons ready to track.
          </p>

          {!profileId ? (
            <p className="text-gray-600">Save your profile first to enable bookings.</p>
          ) : isBookingsLoading ? (
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading active bookings...</span>
            </div>
          ) : activeBookings.length === 0 ? (
            <p className="text-gray-600">No fully paid active bookings yet.</p>
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
              <div id="profile-photo" className="lg:col-span-1">
                <ImageUpload
                  currentName={name || 'Tutor'}
                  currentPhotoUrl={profilePhotoUrl || undefined}
                  onUpload={(url) => setProfilePhotoUrl(url)}
                />
                <p className="mt-3 text-sm text-gray-500">
                  A clear profile photo is required before your tutor profile can be approved and listed publicly.
                </p>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <form onSubmit={handleSave} noValidate autoComplete="off" className="space-y-5">
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
                />
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-4 text-gray-600">
                    +220
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    value={phone}
                    onChange={(e) => setPhone(extractGambiaPhoneDigits(e.target.value))}
                    className="w-full rounded-r-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter 7 digits after +220"
                    maxLength={7}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Families only get your contact details after the first booked lesson.
                  {storedPhoneDigits
                    ? ' Leave this blank to keep your current saved phone number.'
                    : ' Enter the 7 digits after +220.'}
                </p>
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
                  <label htmlFor="travel-radius" className="block text-sm font-medium text-gray-700 mb-1">
                    Travel Radius
                  </label>
                  <select
                    id="travel-radius"
                    value={travelRadiusKm}
                    onChange={(e) => setTravelRadiusKm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {TRAVEL_RADIUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Areas Covered</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_LOCATIONS.map((area) => {
                    const selected = areasCovered.includes(area)
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleAreaCovered(area)}
                        className={`px-3 py-2 rounded-full text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {area}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Languages You Can Teach / Communicate In</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((language) => {
                    const selected = languages.includes(language)
                    return (
                      <button
                        key={language}
                        type="button"
                        onClick={() => toggleLanguage(language)}
                        className={`px-3 py-2 rounded-full text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {language}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Choose the real languages you personally use with students. Arabic is especially useful for Quran,
                  Tajweed, and Hifz tutors.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age Groups</label>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUP_OPTIONS.map((ageGroup) => {
                    const selected = ageGroups.includes(ageGroup)
                    return (
                      <button
                        key={ageGroup}
                        type="button"
                        onClick={() => toggleAgeGroup(ageGroup)}
                        className={`px-3 py-2 rounded-full text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {ageGroup}
                      </button>
                    )
                  })}
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
                <label htmlFor="education" className="block text-sm font-medium text-gray-700 mb-1">
                  Education
                </label>
                <select
                  id="education"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select education level</option>
                  {EDUCATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">I also offer online lessons</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Families will see an online badge on your card and can request online lessons.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffersOnline((current) => !current)}
                    aria-pressed={offersOnline}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                      offersOnline ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        offersOnline ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
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

              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={hasTutorConsent}
                  onChange={(event) => setHasTutorConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  I confirm that my tutor profile details are accurate and that TutorConnect Gambia may use them for bookings, verification, and family matching.
                </span>
              </label>

              <div id="documents">
                <h2 className="text-lg font-semibold text-gray-900">Verification Documents</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload at least one review document below so we can assess your profile. We aim to respond within 5 working days.
                </p>

                {profileId ? (
                  <div className="space-y-3 mt-4">
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="certificate"
                      label="Qualification certificate, degree, or transcript (for Qualification Verified)"
                      onDocumentStatusChange={handleDocumentStatusChange}
                    />
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="study_proof"
                      label="Proof of current study or enrollment (for Profile Reviewed)"
                      onDocumentStatusChange={handleDocumentStatusChange}
                    />
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="teaching_reference"
                      label="Teaching reference or other competence proof (for Profile Reviewed)"
                      onDocumentStatusChange={handleDocumentStatusChange}
                    />
                    <DocumentUpload
                      tutorId={profileId}
                      documentType="cv"
                      label="CV / resume (optional supporting document)"
                      onDocumentStatusChange={handleDocumentStatusChange}
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
                    Legacy inquiries and platform contact records appear here.
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
                <p className="text-gray-600">No inquiries yet. New family communication now starts through bookings and platform actions.</p>
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
                  <p className="text-sm text-gray-500 mt-1">
                    Payouts are released at the end of each month.
                    {currentMonthEarnings > 0
                      ? ` ${formatMoney(currentMonthEarnings)} earned this month becomes available once the month ends.`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRequestPayoutOpen(true)}
                  disabled={pendingPayoutAmount <= 0 || payableLessonsCount === 0 || isRequestingPayout}
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
                  <span className="font-medium text-gray-900">{payableLessonsCount}</span>
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
