'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [supabase] = useState(() => createClient())

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function prepareRecoverySession() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) throw sessionError
          if (!isMounted) return
          setHasRecoverySession(true)
          setIsReady(true)
          return
        }

        const searchParams = new URLSearchParams(window.location.search)
        const tokenHash = searchParams.get('token_hash')
        const type = searchParams.get('type')

        if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          })

          if (verifyError) throw verifyError
          if (!isMounted) return
          setHasRecoverySession(true)
          setIsReady(true)
          return
        }

        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (!isMounted) return
        const hasSession = Boolean(data.session)
        setHasRecoverySession(hasSession)
        if (!hasSession) {
          setError('This reset link is invalid or expired. Please request a new one.')
        }
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setHasRecoverySession(false)
        setError('This reset link is invalid or expired. Please request a new one.')
      } finally {
        if (isMounted) setIsReady(true)
      }
    }

    prepareRecoverySession()

    return () => {
      isMounted = false
    }
  }, [supabase])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!hasRecoverySession) {
      setError('This reset link is invalid or expired. Please request a new one.')
      return
    }

    if (!password || !confirmPassword) {
      setError('Please fill in both password fields.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) throw updateError

      setIsSuccess(true)
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error(err)
      setError('We could not update your password. Please request a new reset link and try again.')
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
        {!isReady && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Preparing secure reset...</p>
          </div>
        )}

        {isReady && !isSuccess ? (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Update Password</h1>
            <p className="text-base text-gray-600 mb-8">Enter your new password below.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
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

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Re-enter new password"
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
                disabled={isLoading || !hasRecoverySession}
                className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          </>
        ) : null}

        {isReady && isSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h2>
            <p className="text-base text-gray-600 mb-4">Your password has been changed successfully.</p>
            <Link href="/login" className="text-emerald-700 hover:underline font-medium">
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
