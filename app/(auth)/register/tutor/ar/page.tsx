'use client'

import TutorRegistrationForm from '@/app/components/TutorRegistrationForm'
import { AR_TUTOR_REGISTRATION } from '@/lib/i18n/tutor-registration'

export default function RegisterTutorArabicPage() {
  return <TutorRegistrationForm dictionary={AR_TUTOR_REGISTRATION} />
}
