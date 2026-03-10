'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (resetError) throw resetError

      setIsSuccess(true)
    } catch (err) {
      console.error(err)
      setError('We could not send a reset link right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto mb-4">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          ← Back to Home
        </Link>
      </div>
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        {!isSuccess ? (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Forgot Password</h1>
            <p className="text-base text-gray-600 mb-8">
              Enter your email and we will send you a password reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
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
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || email.trim() === ''}
                className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending reset link...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-base text-gray-600">
              If an account exists for this email, a password reset link has been sent.
            </p>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-8 text-center">
          Remember your password?{' '}
          <Link href="/login" className="text-emerald-700 hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
