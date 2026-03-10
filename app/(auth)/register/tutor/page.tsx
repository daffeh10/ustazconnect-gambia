'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterTutorPage() {
  const supabase = createClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  function getFriendlyAuthError(message: string) {
    const lower = message.toLowerCase()

    if (lower.includes('already registered') || lower.includes('already been registered')) {
      return 'This email is already registered. Please sign in instead.'
    }

    if (
      lower.includes('invalid email') ||
      lower.includes('unable to validate email address') ||
      lower.includes('email address is invalid')
    ) {
      return 'Please enter a valid email address.'
    }

    if (lower.includes('error sending confirmation email') || lower.includes('email rate limit exceeded')) {
      return 'We could not send a confirmation email right now. Please try again in a few minutes.'
    }

    if (lower.includes('password')) {
      return 'Password must be at least 8 characters long.'
    }

    return 'We could not create your account. Please check your details and try again.'
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Please complete all fields before continuing.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            role: 'tutor',
            full_name: trimmedName,
          },
        },
      })

      if (signUpError) {
        setError(getFriendlyAuthError(signUpError.message))
        return
      }

      const userId = data.user?.id
      if (!userId) {
        throw new Error('No user ID was returned after signup.')
      }

      if (data.session) {
        const { error: insertError } = await supabase.from('tutor_profiles').insert({
          user_id: userId,
          name: trimmedName,
          email: trimmedEmail,
          is_active: true,
          is_approved: true,
        })

        if (insertError) {
          console.error('Tutor profile insert failed during signup:', insertError.message)
        }
      }

      setIsSuccess(true)
    } catch (err) {
      console.error(err)
      setError('We could not create your account. Please check your details and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto mb-4">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        {!isSuccess ? (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Register as Tutor</h1>
            <p className="text-base text-gray-600 mb-8">
              Create your tutor account and complete your profile after signup.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>

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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
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
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating account...' : 'Create Tutor Account'}
              </button>
            </form>
          </>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-base text-gray-600">
              We sent a confirmation link to your inbox. Please verify your email to continue.
            </p>
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
