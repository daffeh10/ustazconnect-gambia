'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getHourlyRateError } from '@/lib/pricing'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import SearchableMultiSelect from '@/app/components/SearchableMultiSelect'
import {
  arabicLabel,
  arabicRadiusLabel,
  AR_AGE_GROUP_LABELS,
  AR_EDUCATION_LABELS,
  AR_GENDER_LABELS,
  AR_LANGUAGE_LABELS,
  AR_LOCATION_LABELS,
  AR_SUBJECT_LABELS,
  type TutorRegistrationDictionary,
} from '@/lib/i18n/tutor-registration'
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

export default function TutorRegistrationForm({
  dictionary: t,
}: {
  dictionary: TutorRegistrationDictionary
}) {
  const isArabic = t.locale === 'ar'
  // Labels are translated for display; the stored value stays canonical English.
  const subjectLabel = (v: string) => (isArabic ? arabicLabel(AR_SUBJECT_LABELS, v) : v)
  const locationLabel = (v: string) => (isArabic ? arabicLabel(AR_LOCATION_LABELS, v) : v)
  const languageLabel = (v: string) => (isArabic ? arabicLabel(AR_LANGUAGE_LABELS, v) : v)
  const ageGroupLabel = (v: string) => (isArabic ? arabicLabel(AR_AGE_GROUP_LABELS, v) : v)
  const genderLabel = (v: string) => (isArabic ? arabicLabel(AR_GENDER_LABELS, v) : v)
  const educationLabel = (v: string) => (isArabic ? arabicLabel(AR_EDUCATION_LABELS, v) : v)
  const radiusLabel = (v: string) => (isArabic ? arabicRadiusLabel(v) : v)

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
      setError(t.errIncomplete)
      return false
    }

    if (!isValidGambiaPhoneDigits(sanitizedPhone)) {
      setError(t.errPhone)
      return false
    }

    if (!passwordMeetsRequirements(password)) {
      setError(t.errPassword)
      return false
    }

    if (password !== confirmPassword) {
      setError(t.errPasswordMatch)
      return false
    }

    setError('')
    return true
  }

  function validateTeachingStep() {
    const parsedExperienceYears = experienceYears.trim() === '' ? 0 : Number(experienceYears)
    const parsedHourlyRate = Number(hourlyRate)

    if (!hourlyRate.trim()) {
      setError(t.errRateMissing)
      return false
    }

    if (selectedSubjects.length === 0) {
      setError(t.errSubjects)
      return false
    }

    if (languages.length === 0) {
      setError(t.errLanguages)
      return false
    }

    const hourlyRateError = getHourlyRateError(parsedHourlyRate)
    if (hourlyRateError) {
      setError(hourlyRateError)
      return false
    }

    if (Number.isNaN(parsedExperienceYears) || parsedExperienceYears < 0) {
      setError(t.errExperience)
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
      setError(t.errConsent)
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
      setError(t.errGeneric)
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
    <div dir={t.dir} lang={t.locale} className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto mb-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          {t.backToHome}
        </Link>
        <Link
          href={t.switchHref}
          lang={t.locale === 'ar' ? 'en' : 'ar'}
          className="inline-flex min-h-12 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t.switchLabel}
        </Link>
      </div>

      <div className="max-w-xl mx-auto rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        {!isSuccess ? (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{t.pageTitle}</h1>
            <p className="text-base text-gray-600 mb-8">
              {currentStep === 1
                ? t.introAccount
                : currentStep === 2
                  ? t.introTeaching
                  : t.introReview}
            </p>

            <ol className="mb-8 grid grid-cols-3 gap-2" aria-label={t.progressLabel}>
              {[
                [1, t.stepAccount],
                [2, t.stepTeaching],
                [3, t.stepReview],
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
                  {t.nameLabel}
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t.namePlaceholder}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t.nameHelper}
                </p>
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.genderLabel}
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                >
                  <option value="">{t.genderPlaceholder}</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {genderLabel(option)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {t.genderHelper}
                </p>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.phoneLabel}
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-s-lg border border-e-0 border-gray-300 bg-gray-50 px-4 text-gray-600">
                    <bdi dir="ltr">+220</bdi>
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
                    className="w-full rounded-e-lg border border-gray-300 px-4 py-3 text-start focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    placeholder={t.phonePlaceholder}
                    maxLength={7}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    readOnly={!isPhoneFieldUnlocked}
                    required
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {t.phoneHelper}
                </p>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.locationLabel}
                </label>
                <select
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                >
                  <option value="">{t.locationPlaceholder}</option>
                  {ALL_LOCATIONS.map((area) => (
                    <option key={area} value={area}>
                      {locationLabel(area)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {t.locationHelper}
                </p>
              </div>
                </div>
              )}

              {currentStep === 2 && (
              <div>
                <label htmlFor="hourly-rate" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.hourlyRateLabel}
                </label>
                <input
                  id="hourly-rate"
                  type="number"
                  autoComplete="off"
                  min="1"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t.hourlyRatePlaceholder}
                  required
                />
              </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.emailLabel}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t.emailPlaceholder}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t.emailHelper}
                </p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t.passwordPlaceholder}
                  minLength={8}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t.passwordHelper}
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.confirmPasswordLabel}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t.confirmPasswordPlaceholder}
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
                  {t.travelRadiusLabel}
                </label>
                <select
                  id="travel-radius"
                  value={travelRadiusKm}
                  onChange={(e) => setTravelRadiusKm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {TRAVEL_RADIUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {radiusLabel(option.label)}
                    </option>
                  ))}
                </select>
              </div>

              <SearchableMultiSelect
                label={t.areasLabel}
                options={ALL_LOCATIONS}
                values={areasCovered}
                onChange={setAreasCovered}
                placeholder={t.areasPlaceholder}
                helperText={t.areasHelper}
                getOptionLabel={locationLabel}
                removeLabel={(value) => `${t.remove} ${locationLabel(value)}`}
                emptyText={t.noMatches}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.languagesLabel}</label>
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
                        {languageLabel(language)}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t.languagesHelper}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.ageGroupsLabel}</label>
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
                        {ageGroupLabel(ageGroup)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="education" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.educationLabel}
                  </label>
                  <select
                    id="education"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">{t.educationPlaceholder}</option>
                    {EDUCATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {educationLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="experience-years" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.experienceLabel}
                  </label>
                  <input
                    id="experience-years"
                    type="number"
                    autoComplete="off"
                    min="0"
                    max="50"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={t.experiencePlaceholder}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.bioLabel}
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder={t.bioPlaceholder}
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t.bioHelper}
                </p>
              </div>

              {DIASPORA_QURAN_ENABLED && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <label className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {t.onlineTitle}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {t.onlineHelper}
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
                label={t.subjectsLabel}
                options={ALL_SUBJECTS}
                values={selectedSubjects}
                onChange={setSelectedSubjects}
                placeholder={t.subjectsPlaceholder}
                helperText={t.subjectsHelper}
                getOptionLabel={subjectLabel}
                removeLabel={(value) => `${t.remove} ${subjectLabel(value)}`}
                emptyText={t.noMatches}
              />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <section aria-labelledby="account-review-heading">
                    <div className="flex items-center justify-between gap-4">
                      <h2 id="account-review-heading" className="text-lg font-semibold text-gray-900">{t.reviewAccountHeading}</h2>
                      <button type="button" onClick={() => moveToStep(1)} className="min-h-11 font-medium text-emerald-700 hover:text-emerald-800">
                        {t.edit}
                      </button>
                    </div>
                    <dl className="divide-y divide-gray-100 border-y border-gray-200 text-sm">
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewName}</dt><dd className="text-end font-medium text-gray-900">{name}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewPhone}</dt><dd className="text-end font-medium text-gray-900"><bdi dir="ltr">{formatGambiaPhoneFromDigits(sanitizeGambiaPhoneDigits(phone))}</bdi></dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewEmail}</dt><dd className="break-all text-end font-medium text-gray-900">{email}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewLocation}</dt><dd className="text-end font-medium text-gray-900">{locationLabel(location)}</dd></div>
                    </dl>
                  </section>

                  <section aria-labelledby="teaching-review-heading">
                    <div className="flex items-center justify-between gap-4">
                      <h2 id="teaching-review-heading" className="text-lg font-semibold text-gray-900">{t.reviewTeachingHeading}</h2>
                      <button type="button" onClick={() => moveToStep(2)} className="min-h-11 font-medium text-emerald-700 hover:text-emerald-800">
                        {t.edit}
                      </button>
                    </div>
                    <dl className="divide-y divide-gray-100 border-y border-gray-200 text-sm">
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewSubjects}</dt><dd className="max-w-xs text-end font-medium text-gray-900">{selectedSubjects.map(subjectLabel).join('، ')}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewRate}</dt><dd className="text-end font-medium text-gray-900">GMD {Number(hourlyRate || 0).toLocaleString()}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewAreas}</dt><dd className="max-w-xs text-end font-medium text-gray-900">{areasCovered.map(locationLabel).join('، ') || locationLabel(location)}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewLanguages}</dt><dd className="max-w-xs text-end font-medium text-gray-900">{languages.map(languageLabel).join('، ')}</dd></div>
                      <div className="flex justify-between gap-4 py-3"><dt className="text-gray-500">{t.reviewBio}</dt><dd className="max-w-xs text-end font-medium text-gray-900">{bio.trim() || t.reviewBioEmpty}</dd></div>
                      {DIASPORA_QURAN_ENABLED && (
                        <div className="flex justify-between gap-4 py-3">
                          <dt className="text-gray-500">{t.reviewOnline}</dt>
                          <dd className="text-end font-medium text-gray-900">
                            {offersOnline ? t.yes : t.no}
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
                      {t.consentText}{' '}
                      <Link href="/terms" className="text-emerald-700 hover:underline font-medium">
                        {t.termsLink}
                      </Link>{' '}
                      {t.and}{' '}
                      <Link href="/privacy" className="text-emerald-700 hover:underline font-medium">
                        {t.privacyLink}
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
                    {t.back}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading || (currentStep === 3 && !hasTutorConsent)}
                  className="min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading
                    ? t.creating
                    : currentStep === 1
                      ? t.continueToTeaching
                      : currentStep === 2
                        ? t.reviewDetails
                        : t.createAccount}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.successTitle}</h2>
            <p className="text-base text-gray-600">
              {t.successBody}
            </p>
            <p className="text-sm text-gray-500 mt-3">
              {t.successHelp} {t.questions} {TUTOR_REVIEW_CONTACT_EMAIL}
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="mt-4 bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResending ? t.resending : t.resend}
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
            {t.registerFamily}
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-3 text-center">
          {t.alreadyHaveAccount}{' '}
          <Link href="/login" className="text-emerald-700 hover:underline font-medium">
            {t.signIn}
          </Link>
        </p>
      </div>
    </div>
  )
}
