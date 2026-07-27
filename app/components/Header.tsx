'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'
import Avatar from './Avatar'

export default function Header() {
  const router = useRouter()
  const { user, profile, role, isLoading } = useAuth()
  const [supabase] = useState(() => createClient())
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const isLoggedIn = Boolean(user)
  const dashboardHref =
    role === 'admin' ? '/admin' : role === 'family' ? '/family/dashboard' : '/dashboard'
  const profileRecord = profile as Record<string, unknown> | null
  const profileName =
    typeof profileRecord?.name === 'string'
      ? profileRecord.name
      : typeof profileRecord?.parent_name === 'string'
        ? profileRecord.parent_name
        : user?.email || 'Account'
  const profilePhotoUrl =
    typeof profileRecord?.profile_photo_url === 'string' ? profileRecord.profile_photo_url : null

  async function handleSignOut() {
    setIsMenuOpen(false)
    setIsSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    } catch (error) {
      console.error('Header sign-out failed', error)
    } finally {
      setIsSigningOut(false)
      router.replace('/')
      router.refresh()
    }
  }

  return (
    <header className="bg-white shadow-sm">
      <nav className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            TutorConnect Gambia
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/find-tutor"
              className="text-gray-600 transition hover:text-emerald-700"
            >
              Find a Tutor
            </Link>
            {DIASPORA_QURAN_ENABLED && (
              <Link
                href="/online-quran"
                className="text-gray-600 transition hover:text-emerald-700"
              >
                Online Quran
              </Link>
            )}

            {isLoading ? (
              <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-100" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="flex items-center gap-3 text-gray-600 transition hover:text-emerald-700"
                >
                  <Avatar name={profileName} photoUrl={profilePhotoUrl} size="sm" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/account/settings"
                  className="text-gray-600 transition hover:text-emerald-700"
                >
                  Account
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="min-h-12 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-600 transition hover:text-emerald-700"
                >
                  Sign In
                </Link>
                <Link
                  href="/register/tutor"
                  className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Become a Tutor
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex min-h-12 min-w-12 items-center justify-center text-gray-600 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {isMenuOpen && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pb-4 pt-4 md:hidden">
            <Link
              href="/find-tutor"
              className="block min-h-12 py-2 text-gray-600 transition hover:text-emerald-700"
              onClick={() => setIsMenuOpen(false)}
            >
              Find a Tutor
            </Link>
            {DIASPORA_QURAN_ENABLED && (
              <Link
                href="/online-quran"
                className="block min-h-12 py-2 text-gray-600 transition hover:text-emerald-700"
                onClick={() => setIsMenuOpen(false)}
              >
                Online Quran
              </Link>
            )}

            {isLoading ? (
              <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="flex min-h-12 items-center gap-3 py-2 text-gray-600 transition hover:text-emerald-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Avatar name={profileName} photoUrl={profilePhotoUrl} size="sm" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/account/settings"
                  className="block min-h-12 py-2 text-gray-600 transition hover:text-emerald-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Account Settings
                </Link>
                <button
                  onClick={() => {
                    void handleSignOut()
                  }}
                  disabled={isSigningOut}
                  className="block min-h-12 w-full py-2 text-left text-gray-600 transition hover:text-emerald-700 disabled:opacity-60"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block min-h-12 py-2 text-gray-600 transition hover:text-emerald-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/register/tutor"
                  className="block min-h-12 rounded-lg bg-emerald-600 px-4 py-3 text-center text-white transition hover:bg-emerald-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Become a Tutor
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
