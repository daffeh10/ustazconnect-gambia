import type { Metadata } from 'next'
import { Suspense } from 'react'
import FindUstazClient from './FindUstazClient'

export const metadata: Metadata = {
  title: 'Find a Tutor | TutorConnect Gambia',
  description:
    'Compare tutors in The Gambia by subject, area, price, availability, lesson format, and review level.',
}

export default function FindTutorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 px-4 py-24">
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-72 animate-pulse rounded-lg border border-gray-200 bg-white" />
            ))}
          </div>
        </div>
      }
    >
      <FindUstazClient />
    </Suspense>
  )
}
