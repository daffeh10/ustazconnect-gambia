'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getHourlyRateError } from '@/lib/pricing'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import SearchableMultiSelect from '@/app/components/SearchableMultiSelect'
import { trackFunnelEvent } from '@/lib/funnel'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'
import { buildPublicUrl, getFriendlyRegistrationError, passwordMeetsRequirements } from '@/lib/auth'
import { TUTOR_REVIEW_CONTACT_EMAIL } from '@/lib/tutor-review'
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
} from '@/lib/tutor-profile'

export default function RegisterTutorPage() {
  const supabase = createClient()
  const router = useRouter()
  const phoneInputRef = useRef<HTMLInputElement | null>(null)

  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [travelRadiusKm, setTravelRadiusKm] = useState('5')
  const [areasCovered, setAreasCovered] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [ageGroups, setAgeGroups] = useState<string[]>([])
  const [education, setEducation] = useState('')
  const [bio, setBio] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [offersOnline, setOffersOnline] = useState(false)
  const [hasTutorConsent, setHasTutorConsent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [error, setError] = useState('')
  const [isPhoneFieldUnlocked, setIsPhoneFieldUnlocked] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (phoneInputRef.current?.value) {
        phoneInputRef.current.value = ''
      }
      setPhone('')
    }, 50)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    trackFunnelEvent('tutor_registration_started')
  }, [])

  function validateAccountStep() {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const sanitizedPhone = sanitizeGambiaPhoneDigits(phone)

    if (!trimmedName || !gender || !location || !trimmedEmail || !password || !confirmPassword) {
      setError('Please complete all fields before continuing.')
      return false
    }

    if (!isValidGambiaPhoneDigits(sanitizedPhone)) {
      setError('Please enter a valid 7-digit Gambian phone number after +220.')
      return false
    }

    if (!passwordMeetsRequirements(password)) {
      setError('Password must be at least 8 characters long.')
      return false
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }

    setError('')
    return true
  }

  function validateTeachingStep() {
    const parsedExperienceYears = experienceYears.trim() === '' ? 0 : Number(experienceYears)
    const parsedHourlyRate = Number(hourlyRate)

    if (!hourlyRate.trim()) {
      setError('Please enter your hourly rate.')
      return false
    }

    if (selectedSubjects.length === 0) {
      setError('Please select at least one subject you can teach.')
      return false
    }

    if (languages.length === 0) {
      setError('Please select at least one language you can teach or communicate in.')
      return false
    }

    const hourlyRateError = getHourlyRateError(parsedHourlyRate)
    if (hourlyRateError) {
      setError(hourlyRateError)
      return false
    }

    if (Number.isNaN(parsedExperienceYears) || parsedExperienceYears < 0) {
      setError('Experience years must be a valid non-negative number.')
      return false
    }

    setError('')
    return true
  }

  function moveToStep(step: 1 | 2 | 3) {
    setError('')
    setCurrentStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (currentStep === 1) {
      if (validateAccountStep()) moveToStep(2)
      return
    }

    if (currentStep === 2) {
      if (validateTeachingStep()) moveToStep(3)
      return
    }

    if (!validateAccountStep() || !validateTeachingStep()) return

    if (!hasTutorConsent) {
      setError('Please confirm your tutor profile details and agree to the platform terms.')
      return
    }

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const sanitizedPhone = sanitizeGambiaPhoneDigits(phone)
    const formattedPhone = formatGambiaPhoneFromDigits(sanitizedPhone)
    const parsedExperienceYears = experienceYears.trim() === '' ? 0 : Number(experienceYears)
    const parsedTravelRadiusKm = Number(travelRadiusKm) || 5
    const parsedHourlyRate = Number(hourlyRate)
    const consentGivenAt = new Date().toISOString()

    setError('')
    setResendMessage('')
    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: buildPublicUrl('/auth/callback?next=/login'),
          data: {
            role: 'tutor',
            full_name: trimmedName,
            phone: formattedPhone,
            gender,
            location,
            hourly_rate: parsedHourlyRate,
            selected_subjects: selectedSubjects,
            travel_radius_km: parsedTravelRadiusKm,
            areas_covered: areasCovered,
            languages,
            age_groups: ageGroups,
            education: education || '',
            experience_years: parsedExperienceYears,
            offers_online: DIASPORA_QURAN_ENABLED && offersOnline,
            consent_given_at: consentGivenAt,
          },
        },
      })

      if (signUpError) {
        setError(getFriendlyRegistrationError(signUpError.message))
        return
      }

      const existingUserWithoutNewIdentity =
        Array.isArray(data.user?.identities) && data.user.identities.length === 0

      if (existingUserWithoutNewIdentity) {
        setError('This email is already registered. Please sign in or reset your password.')
        return
      }

      const userId = data.user?.id
      if (!userId) {
        throw new Error('No user ID was returned after signup.')
      }

      trackFunnelEvent('tutor_registration_completed')

      if (data.session) {
        // Email confirmation is disabled — user is already confirmed.
        // Insert their profile row and redirect straight to the dashboard.
        const basePayload = {
          user_id: userId,
          name: trimmedName,
          email: trimmedEmail,
          phone: formattedPhone,
          gender,
          location,
          subjects: selectedSubjects,
          experience_years: parsedExperienceYears,
          hourly_rate: parsedHourlyRate,
          bio: bio.trim() || null,
          is_active: true,
          is_approved: false,
        }
        const enhancedPayload = {
          ...basePayload,
          travel_radius_km: parsedTravelRadiusKm,
          areas_covered: areasCovered,
          languages,
          age_groups: ageGroups,
          education: education || '',
          offers_online: DIASPORA_QURAN_ENABLED && offersOnline,
          consent_given_at: consentGivenAt,
        }

        let { error: insertError } = await supabase.from('tutor_profiles').insert(enhancedPayload)

        if (
          insertError &&
          isMissingEnhancedTutorProfileColumnError(insertError.message)
        ) {
          const fallbackInsert = await supabase.from('tutor_profiles').insert(basePayload)
          insertError = fallbackInsert.error
        }

        if (insertError) {
          console.error('Tutor profile insert failed during signup:', insertError.message)
        }

        router.push('/dashboard')
        return
      }

      // Email confirmation is enabled — ask the user to check their inbox.
      setSubmittedEmail(trimmedEmail)
      setIsSuccess(true)
    } catch (err) {
      console.error(err)
      setError('We could not create your account. Please check your details and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (!submittedEmail) return

    setError('')
    setResendMessage('')
    setIsResending(true)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
        options: {
          emailRedirectTo: buildPublicUrl('/auth/callback?next=/login'),
        },
      })

      if (resendError) throw resendError
      setResendMessage('Confirmation email re-sent. Please check inbox and spam.')
    } catch (err) {
      console.error(err)
      setError('Could not resend confirmation email right now. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  function toggleLanguage(language: string) {
    setLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language]
    )
  }

  function toggleAgeGroup(ageGroup: string) {
    setAgeGroups((current) =>
      current.includes(ageGroup)
        ? current.filter((item) => item !== ageGroup)
        : [...current, ageGroup]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto mb-4">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="max-w-xl mx-auto rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        {!isSuccess ? (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Create Your Tutor Account</h1>
            <p className="text-base text-gray-600 mb-8">
              {currentStep === 1
                ? 'Start with your account and contact details. You can then add the information families need when choosing a tutor.'
                : currentStep === 2
                  ? 'Tell families what you teach, where you can teach, and the learners you work with.'
                  : 'Check your information before creating your account. You can update your profile and submit review documents from your tutor dashboard.'}
            </p>

            <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Registration progress">
              {[
                [1, 'Account'],
                [2, 'Teaching Profile'],
                [3, 'Review'],
              ].map(([step, label]) => {
                const stepNumber = Number(step)
                const isCurrent = currentStep === stepNumber
                const isComplete = currentStep > stepNumber
                return (
                  <li key={step} className="min-w-0">
                    <div className={`h-1.5 rounded-full ${isCurrent || isComplete ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                    <p className={`mt-2 text-xs font-medium sm:text-sm ${isCurrent ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {label}
                    </p>
                  </li>
                )
              })}
            </ol>

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {currentStep === 1 && (
                <div className="space-y-4">
              <input
                type="text"
                name="registration-username"
                autoComplete="username"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                defaultValue=""
              />
              <input
                type="tel"
                name="registration-phone-shadow"
                autoComplete="tel"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                defaultValue=""
              />
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="First and last name as shown on your ID"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Use your first and last name exactly as they appear on your ID document.
                </p>
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Your gender will be shown on your public tutor profile to help families choose a suitable tutor.
                </p>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-4 text-gray-600">
                    +220
                  </span>
                  <input
                    ref={phoneInputRef}
                    id="phone"
                    name="new-phone-number"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(extractGambiaPhoneDigits(e.target.value))}
                    onFocus={() => setIsPhoneFieldUnlocked(true)}
                    onPointerDown={() => setIsPhoneFieldUnlocked(true)}
                    className="w-full rounded-r-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    placeholder="7 digits after +220"
                    maxLength={7}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    readOnly={!isPhoneFieldUnlocked}
                    required
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  This is your main tutor contact number. Families only get it after the first lesson is booked.
                </p>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location / Area *
                </label>
                <select
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                >
                  <option value="">Select the main area where you teach</option>
                  {ALL_LOCATIONS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  We collect your main teaching area, not your exact home address, to protect your privacy.
                </p>
              </div>
                </div>
              )}

              {currentStep === 2 && (
              <div>
                <label htmlFor="hourly-rate" className="block text-sm font-medium text-gray-700 mb-1">
                  Hourly Rate (GMD) *
                </label>
                <input
                  id="hourly-rate"
                  type="number"
                  min="1"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. 150"
                  required
                />
              </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="you@example.com"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Secondary contact for now. We still use email to create and secure tutor accounts until phone login is enabled.
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Use at least 8 characters. A short passphrase is even better.
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Re-enter your password"
                  minLength={8}
                  required
                />
              </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
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

              <SearchableMultiSelect
                label="Areas Covered"
                options={ALL_LOCATIONS}
                values={areasCovered}
                onChange={setAreasCovered}
                placeholder="Search and add teaching areas"
                helperText="Add every area you are willing to travel to for in-person lessons."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Languages You Can Teach / Communicate In *</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((language) => {
                    const isSelected = languages.includes(language)
                    return (
                      <button
                        key={language}
                        type="button"
                        onClick={() => toggleLanguage(language)}
                        className={`min-h-12 px-3 py-2 rounded-full text-sm transition-colors ${
                          isSelected
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
                  The site stays in English, but you should select the real languages you personally use with students,
                  such as Arabic, Wolof, Mandinka, or English.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age Groups</label>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUP_OPTIONS.map((ageGroup) => {
                    const isSelected = ageGroups.includes(ageGroup)
                    return (
                      <button
                        key={ageGroup}
                        type="button"
                        onClick={() => toggleAgeGroup(ageGroup)}
                        className={`min-h-12 px-3 py-2 rounded-full text-sm transition-colors ${
                          isSelected
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

              <div className="grid md:grid-cols-2 gap-4">
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

                <div>
                  <label htmlFor="experience-years" className="block text-sm font-medium text-gray-700 mb-1">
                    Experience Years
                  </label>
                  <input
                    id="experience-years"
                    type="number"
                    min="0"
                    max="50"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                  About You
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Tell families about your teaching style and experience."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional, and you can add it later. This is the first thing a family
                  reads on your profile, so a few honest sentences help them choose you.
                </p>
              </div>

              {DIASPORA_QURAN_ENABLED && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        I also offer online lessons
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Families will see an online badge on your profile and card.
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
              )}

              <SearchableMultiSelect
                label="Subjects You Teach *"
                options={ALL_SUBJECTS}
                values={selectedSubjects}
                onChange={setSelectedSubjects}
                placeholder="Search and add subjects"
                helperText="Add the subjects you are comfortable teaching."
              />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <section aria-labelledby="account-review-heading">
                    <div className="flex items-center justify-between gap-4">
                      <h2 id="account-review-heading" className="text-lg font-semibold text-gray-900">Account</h2>
                      <button type="button" onClick={() => moveToStep(1)} className="min-h-11 font-medium text-emerald-700 hover:text-emerald-800">
                        Edit
                      </button>
                    </div>
                    <dl className="divide-y divide-gray-100 border-y border-gray-200 text-sm">
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Name</dt><dd className="text-right font-medium text-gray-900">{name}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Phone</dt><dd className="text-right font-medium text-gray-900">{formatGambiaPhoneFromDigits(sanitizeGambiaPhoneDigits(phone))}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Email</dt><dd className="break-all text-right font-medium text-gray-900">{email}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Main area</dt><dd className="text-right font-medium text-gray-900">{location}</dd></div>
                    </dl>
                  </section>

                  <section aria-labelledby="teaching-review-heading">
                    <div className="flex items-center justify-between gap-4">
                      <h2 id="teaching-review-heading" className="text-lg font-semibold text-gray-900">Teaching Profile</h2>
                      <button type="button" onClick={() => moveToStep(2)} className="min-h-11 font-medium text-emerald-700 hover:text-emerald-800">
                        Edit
                      </button>
                    </div>
                    <dl className="divide-y divide-gray-100 border-y border-gray-200 text-sm">
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Subjects</dt><dd className="max-w-xs text-right font-medium text-gray-900">{selectedSubjects.join(', ')}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Hourly rate</dt><dd className="text-right font-medium text-gray-900">GMD {Number(hourlyRate || 0).toLocaleString()}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Teaching areas</dt><dd className="max-w-xs text-right font-medium text-gray-900">{areasCovered.join(', ') || location}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">Languages</dt><dd className="max-w-xs text-right font-medium text-gray-900">{languages.join(', ')}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">About you</dt><dd className="max-w-xs text-right font-medium text-gray-900">{bio.trim() || 'Not added yet'}</dd></div>
                      {DIASPORA_QURAN_ENABLED && (
                        <div className="flex justify-between gap-4 py-3">
                          <dt className="text-gray-500">Online lessons</dt>
                          <dd className="text-right font-medium text-gray-900">
                            {offersOnline ? 'Yes' : 'No'}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  <label className="flex items-start gap-3 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={hasTutorConsent}
                      onChange={(event) => setHasTutorConsent(event.target.checked)}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      required
                    />
                    <span>
                      I confirm that my profile details are accurate, I agree to be contacted for tutoring requests, and I accept the{' '}
                      <Link href="/terms" className="text-emerald-700 hover:underline font-medium">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="text-emerald-700 hover:underline font-medium">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className={`grid gap-3 ${currentStep > 1 ? 'sm:grid-cols-2' : ''}`}>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => moveToStep(currentStep === 3 ? 2 : 1)}
                    className="min-h-12 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-800 hover:bg-gray-50"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading || (currentStep === 3 && !hasTutorConsent)}
                  className="min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading
                    ? 'Creating account...'
                    : currentStep === 1
                      ? 'Continue to Teaching Profile'
                      : currentStep === 2
                        ? 'Review Details'
                        : 'Create Tutor Account'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-base text-gray-600">
              We sent a confirmation link to your inbox. Please verify your email to continue.
            </p>
            <p className="text-sm text-gray-500 mt-3">
              If you do not see it within a few minutes, check spam or use the resend button below. After you confirm your email and sign in, you can use your dashboard to track your profile status, upload your photo and review documents, and see any next steps for approval. Questions: {TUTOR_REVIEW_CONTACT_EMAIL}
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="mt-4 bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResending ? 'Resending...' : 'Resend confirmation email'}
            </button>
            {resendMessage && <p className="text-sm text-emerald-700 mt-3">{resendMessage}</p>}
            {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/register/family"
            className="inline-block bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Register as Family/Student
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-3 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-700 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
