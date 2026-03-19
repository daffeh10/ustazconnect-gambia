import type { Metadata } from 'next'
import { Suspense } from 'react'
import FindUstazClient from './FindUstazClient'

export const metadata: Metadata = {
  title: 'Find a Tutor | TutorConnect Gambia',
  description:
    'Browse verified tutors in The Gambia by subject, location, availability, and hourly rate.',
}

export default function FindUstazPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FindUstazClient />
    </Suspense>
  )
}
