'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildPublicUrl, getFriendlyRegistrationError, passwordMeetsRequirements } from '@/lib/auth'

export default function RegisterFamilyPage() {
  const supabase = createClient()
  const router = useRouter()

  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmedName = parentName.trim()
    const trimmedEmail = email.trim()
    const consentGivenAt = new Date().toISOString()

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setError('Please complete all fields before continuing.')
      return
    }

    if (!passwordMeetsRequirements(password)) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!hasAcceptedLegal) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

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
            role: 'family',
            full_name: trimmedName,
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

      if (data.session) {
        // Email confirmation is disabled — user is already confirmed.
        // Insert their profile row and redirect straight to the dashboard.
        const { error: insertError } = await supabase.from('family_profiles').insert({
          user_id: userId,
          parent_name: trimmedName,
          email: trimmedEmail,
          consent_given_at: consentGivenAt,
        })

        if (insertError) {
          console.error('Family profile insert failed during signup:', insertError.message)
        }

        router.push('/family/dashboard')
        return
      }

      // Email confirmation is enabled — ask the user to check their inbox.
      setSubmittedEmail(trimmedEmail)
      setIsSuccess(true)
    } catch (err) {
      console.error(err)
      setError('We could not create your account. Please check your details and try again.')
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Register as Family/Student</h1>
            <p className="text-base text-gray-600 mb-8">
              Create an account to manage your tutoring requests and messages.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="parent-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Parent/Student Name
                </label>
                <input
                  id="parent-name"
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
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
                <p className="mt-1 text-sm text-gray-500">
                  Use at least 8 characters. A short passphrase is even better.
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Re-enter your password"
                  minLength={8}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <label className="flex items-start gap-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={hasAcceptedLegal}
                  onChange={(event) => setHasAcceptedLegal(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  required
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

              <button
                type="submit"
                disabled={isLoading || !hasAcceptedLegal}
                className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating account...' : 'Create Family/Student Account'}
              </button>
            </form>
          </>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-base text-gray-600">
              We sent a confirmation link to your inbox. Please verify your email to continue.
            </p>
            <p className="text-sm text-gray-500 mt-3">
              If you do not see it within a few minutes, check spam or use the resend button below.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="mt-4 bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResending ? 'Resending...' : 'Resend confirmation email'}
            </button>
            {resendMessage && <p className="text-sm text-emerald-700 mt-3">{resendMessage}</p>}
            {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
          </div>
        )}

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
