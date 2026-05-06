'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  buildPublicUrl,
  ensureProfileForUser,
  getFriendlyLoginError,
  isEmailConfirmationPendingError,
  normalizeAuthActionType,
} from '@/lib/auth'

function getSafeReturnTo(returnTo: string | null) {
  if (!returnTo) return null
  if (!returnTo.startsWith('/')) return null
  if (returnTo.startsWith('//')) return null
  if (returnTo.startsWith('/admin')) return null
  return returnTo
}

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [showResendConfirmation, setShowResendConfirmation] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [returnTo, setReturnTo] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const searchParams = new URLSearchParams(window.location.search)
    setReturnTo(getSafeReturnTo(searchParams.get('returnTo')))
  }, [])

  const getDestinationForUser = useCallback(async (userId: string, metadataRole: string) => {
    let destination = '/dashboard'
    const { data: adminProfile, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!adminError && adminProfile) {
      return '/admin'
    }

    if (metadataRole === 'family') {
      return '/family/dashboard'
    }

    if (metadataRole === 'tutor') {
      return '/dashboard'
    }

    const { data: familyProfile, error: familyError } = await supabase
      .from('family_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!familyError && familyProfile) {
      destination = '/family/dashboard'
    }

    return destination
  }, [supabase])

  useEffect(() => {
    let isMounted = true

    async function handleEmailConfirmationRedirect() {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      const tokenHash = searchParams.get('token_hash')
      const authType = normalizeAuthActionType(searchParams.get('type'))

      if (!code && !(tokenHash && authType === 'signup')) {
        return
      }

      setIsLoading(true)
      setError('')
      setSuccessMessage('')

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'signup',
          })
          if (verifyError) throw verifyError
        }

        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, window.location.pathname)
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        if (user) {
          const metadataRole =
            typeof user.user_metadata?.role === 'string'
              ? user.user_metadata.role.toLowerCase().trim()
              : ''

          try {
            await ensureProfileForUser(supabase, user)
          } catch (profileError) {
            console.error('Failed to backfill profile after email confirmation', profileError)
          }

          const destination = returnTo || await getDestinationForUser(user.id, metadataRole)
          router.replace(destination)
          router.refresh()
          return
        }

        if (isMounted) {
          setSuccessMessage('Your email has been confirmed. You can now sign in.')
        }
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('We could not verify this email link. Please try signing in or resend the confirmation email.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void handleEmailConfirmationRedirect()

    return () => {
      isMounted = false
    }
  }, [getDestinationForUser, returnTo, router, supabase])

  async function handleResendConfirmation() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter your email address first, then resend the confirmation email.')
      return
    }

    setError('')
    setResendMessage('')
    setIsResending(true)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: buildPublicUrl('/login'),
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.')
      return
    }

    setError('')
    setResendMessage('')
    setSuccessMessage('')
    setShowResendConfirmation(false)
    setIsLoading(true)

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) throw signInError

      const user = signInData.user
      const metadataRole =
        typeof user.user_metadata?.role === 'string'
          ? user.user_metadata.role.toLowerCase().trim()
          : ''

      try {
        await ensureProfileForUser(supabase, user)
      } catch (profileError) {
        console.error('Failed to backfill missing profile on login', profileError)
      }

      const destination = returnTo || await getDestinationForUser(user.id, metadataRole)
      router.push(destination)
      router.refresh()
    } catch (err) {
      console.error(err)
      const rawMessage =
        err instanceof Error ? err.message : 'We could not sign you in right now. Please try again.'
      setError(getFriendlyLoginError(rawMessage))
      setShowResendConfirmation(isEmailConfirmationPendingError(rawMessage))
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
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Sign In</h1>
        <p className="text-base text-gray-600 mb-8">Welcome back to TutorConnect Gambia.</p>

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
              placeholder="Enter your password"
              required
            />
          </div>

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {showResendConfirmation && (
            <button
              type="button"
              onClick={() => void handleResendConfirmation()}
              disabled={isResending}
              className="w-full bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResending ? 'Resending...' : 'Resend confirmation email'}
            </button>
          )}

          {resendMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
              {resendMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/forgot-password" className="text-sm text-emerald-700 hover:underline font-medium">
            Forgot password?
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-emerald-700 hover:underline font-medium">
            Join now
          </Link>
        </p>
      </div>
    </div>
  )
}
