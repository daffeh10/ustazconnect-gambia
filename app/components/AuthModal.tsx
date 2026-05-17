'use client'

import Link from 'next/link'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useState } from 'react'
import { buildPublicUrl, getFriendlyLoginError, getFriendlyRegistrationError, passwordMeetsRequirements } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

type EmailMode = 'signIn' | 'signUp'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void | Promise<void>
  returnTo?: string
}

interface SupabaseLikeError {
  code?: string | null
  message?: string | null
}

function isNoRowError(error: SupabaseLikeError | null) {
  return error?.code?.toUpperCase() === 'PGRST116'
}

function isDuplicateError(error: SupabaseLikeError | null) {
  const code = error?.code?.toLowerCase() || ''
  const message = error?.message?.toLowerCase() || ''
  return code === '23505' || message.includes('duplicate key')
}

function getFallbackFamilyName(user: User) {
  const metadataName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''

  if (metadataName) return metadataName

  const emailPrefix = user.email?.split('@')[0]?.trim()
  if (emailPrefix) return emailPrefix

  return 'Family'
}

async function ensureFamilyProfileForActionAuth(supabase: SupabaseClient, user: User) {
  const userId = user.id
  const consentGivenAt =
    typeof user.user_metadata?.consent_given_at === 'string'
      ? user.user_metadata.consent_given_at
      : null

  const [{ data: adminProfile, error: adminError }, { data: tutorProfile, error: tutorError }, { data: familyProfile, error: familyError }] =
    await Promise.all([
      supabase.from('admin_users').select('id').eq('user_id', userId).maybeSingle<{ id: string }>(),
      supabase.from('tutor_profiles').select('id').eq('user_id', userId).maybeSingle<{ id: string }>(),
      supabase.from('family_profiles').select('id').eq('user_id', userId).maybeSingle<{ id: string }>(),
    ])

  if (adminError && !isNoRowError(adminError)) throw adminError
  if (tutorError && !isNoRowError(tutorError)) throw tutorError
  if (familyError && !isNoRowError(familyError)) throw familyError

  if (adminProfile || tutorProfile || familyProfile) {
    return
  }

  const { error: insertError } = await supabase.from('family_profiles').insert({
    user_id: userId,
    parent_name: getFallbackFamilyName(user),
    email: user.email?.trim() || null,
    phone: user.phone?.trim() || null,
    consent_given_at: consentGivenAt,
  })

  if (insertError && !isDuplicateError(insertError)) {
    throw insertError
  }
}

function getModalRedirectPath(returnTo?: string) {
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    return `/login?returnTo=${encodeURIComponent(returnTo)}`
  }

  if (typeof window !== 'undefined') {
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath.startsWith('/') && !currentPath.startsWith('//')) {
      return `/login?returnTo=${encodeURIComponent(currentPath)}`
    }
  }

  return '/login'
}

export default function AuthModal({ isOpen, onClose, onSuccess, returnTo }: AuthModalProps) {
  const [supabase] = useState(() => createClient())
  const [emailMode, setEmailMode] = useState<EmailMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function completeAuthFlow(user: User) {
    await ensureFamilyProfileForActionAuth(supabase, user)
    await onSuccess()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter your email and password.')
      return
    }

    if (emailMode === 'signUp' && !passwordMeetsRequirements(password)) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (emailMode === 'signUp' && !hasAcceptedLegal) {
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      if (emailMode === 'signIn') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })

        if (error) throw error
        await completeAuthFlow(data.user)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: buildPublicUrl(`/auth/callback?next=${encodeURIComponent(getModalRedirectPath(returnTo))}`),
          data: {
            role: 'family',
            consent_given_at: new Date().toISOString(),
          },
        },
      })

      if (error) throw error

      if (data.session && data.user) {
        await completeAuthFlow(data.user)
        return
      }

      setSuccessMessage('Check your email to confirm your account, then sign in.')
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Could not complete authentication right now.'
      setErrorMessage(emailMode === 'signIn' ? getFriendlyLoginError(rawMessage) : getFriendlyRegistrationError(rawMessage))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 p-4 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Sign in to continue</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
            aria-label="Close auth modal"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEmailMode('signIn')}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                emailMode === 'signIn' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setEmailMode('signUp')}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                emailMode === 'signUp' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder={emailMode === 'signIn' ? 'Enter your password' : 'Create a password'}
                required
              />
            </div>

            {emailMode === 'signUp' && (
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
                  .
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (emailMode === 'signUp' && !hasAcceptedLegal)}
              className="w-full bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Please wait...' : emailMode === 'signIn' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-emerald-700 hover:underline font-medium">
              Forgot password?
            </Link>
          </div>

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
