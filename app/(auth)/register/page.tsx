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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Join TutorConnect Gambia</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600">
            Choose how you want to get started. You can join as a tutor to offer lessons or as a
            parent or student to find the right tutor.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8">
          <Link
            href="/register/tutor"
            className="block bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">I&apos;m a Tutor</h2>
            <p className="text-base text-gray-600">
              Share your knowledge and earn income.
            </p>
          </Link>

          <Link
            href="/register/family"
            className="block bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">I&apos;m a Parent/Student</h2>
            <p className="text-base text-gray-600">
              Find the perfect tutor.
            </p>
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
