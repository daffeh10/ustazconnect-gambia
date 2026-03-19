'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function getSafeAdminDestination(nextPath: string | null) {
  if (!nextPath) return '/admin'
  if (!nextPath.startsWith('/admin')) return '/admin'
  if (nextPath === '/admin/login') return '/admin'
  return nextPath
}

export default function AdminLoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const nextPath = getSafeAdminDestination(searchParams.get('next'))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter your admin email and password.')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) throw signInError

      const user = signInData.user
      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (adminError) throw adminError

      if (!adminProfile) {
        await supabase.auth.signOut()
        throw new Error('This account does not have admin access.')
      }

      router.push(nextPath)
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not sign in to admin.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-medium text-emerald-400 hover:underline">
          ← Back to main site
        </Link>

        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Admin Portal
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">Sign in to Admin</h1>
            <p className="mt-2 text-sm text-gray-400">
              Use an account that exists in the <code className="text-gray-200">admin_users</code>{' '}
              table.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-gray-200">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-gray-200">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Signing in...' : 'Sign In to Admin'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-emerald-400 hover:underline">
              Forgot password?
            </Link>
            <Link href="/login" className="text-gray-400 hover:text-white hover:underline">
              Standard login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
