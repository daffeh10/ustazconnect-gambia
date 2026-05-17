'use client'

import Link from 'next/link'

export default function RegisterChooserPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto mb-4 max-w-5xl">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Become a Tutor on TutorConnect Gambia</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600">
            Tutor registration starts here. Families and students do not need to create an account first.
            They can start by browsing tutors and will be asked to sign in only when they are ready to send a booking request.
          </p>
        </div>

        <div className="grid gap-4 md:gap-8">
          <Link
            href="/register/tutor"
            className="block bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">I&apos;m a Tutor</h2>
            <p className="text-base text-gray-600">
              Share your knowledge and earn income.
            </p>
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Looking for a tutor?</h2>
          <p className="mt-2 text-base text-gray-600">
            Start by browsing tutors. You can fill your booking request first, then create or sign in to your family account right before sending it.
          </p>
          <Link
            href="/find-tutor"
            className="inline-block mt-4 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Find a Tutor
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-700 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
