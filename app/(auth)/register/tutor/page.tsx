'use client'

import TutorRegistrationForm from '@/app/components/TutorRegistrationForm'
import { EN_TUTOR_REGISTRATION } from '@/lib/i18n/tutor-registration'

export default function RegisterTutorPage() {
  return <TutorRegistrationForm dictionary={EN_TUTOR_REGISTRATION} />
}
