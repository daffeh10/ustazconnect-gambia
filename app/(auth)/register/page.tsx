'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function RegisterChooserPage() {
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto mb-4">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Choose Account Type</h1>
        <p className="text-base text-gray-600 mb-8">
          Select the account that matches how you want to use TutorConnect Gambia.
        </p>

        <div className="space-y-4">
          <Link
            href="/register/tutor"
            aria-disabled={!hasAcceptedLegal}
            className={`block bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-shadow ${
              hasAcceptedLegal ? 'hover:shadow-md' : 'opacity-60 pointer-events-none'
            }`}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Register as Tutor</h2>
            <p className="text-base text-gray-600">
              Create your tutor profile and get discovered by families and students.
            </p>
          </Link>

          <Link
            href="/register/family"
            aria-disabled={!hasAcceptedLegal}
            className={`block bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-shadow ${
              hasAcceptedLegal ? 'hover:shadow-md' : 'opacity-60 pointer-events-none'
            }`}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Register as Family/Student</h2>
            <p className="text-base text-gray-600">
              Create a family or student account to manage requests and future bookings.
            </p>
          </Link>
        </div>

        <label className="flex items-start gap-3 text-sm text-gray-600 mt-6">
          <input
            type="checkbox"
            checked={hasAcceptedLegal}
            onChange={(event) => setHasAcceptedLegal(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="text-emerald-700 hover:underline font-medium">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-emerald-700 hover:underline font-medium">
              Privacy Policy
            </Link>
          </span>
        </label>

        <p className="text-sm text-gray-500 mt-8 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-700 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
