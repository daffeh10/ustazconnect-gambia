'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import ImageUpload from '@/app/components/ImageUpload'

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

export default function DashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

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
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [isInquiriesLoading, setIsInquiriesLoading] = useState(false)
  const [inquiriesError, setInquiriesError] = useState('')

  const successTimerRef = useRef<NodeJS.Timeout | null>(null)

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
          void loadInquiriesForTutor(profile.id)
        } else {
          const fallbackName =
            typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
          setName(fallbackName)
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
    }
  }, [loadInquiriesForTutor, router, supabase])

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            TutorConnect Gambia
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
      </main>
    </div>
  )
}
