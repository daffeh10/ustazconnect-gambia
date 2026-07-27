'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
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
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50">
      <nav className="mx-auto max-w-7xl px-4">
        <div className="flex min-h-16 items-center justify-between md:min-h-20">
          <Link
            href="/"
            className="font-serif text-xl font-bold text-stone-950 sm:text-2xl"
          >
            TutorConnect Gambia
          </Link>

          <div className="hidden items-center gap-5 lg:flex xl:gap-7">
            <Link
              href="/find-tutor"
              className="text-sm font-semibold text-stone-700 transition-colors hover:text-emerald-800"
            >
              Find a tutor
            </Link>
            <Link
              href="/online-quran"
              className="text-sm font-semibold text-stone-700 transition-colors hover:text-emerald-800"
            >
              Online Quran
            </Link>
            <Link
              href="/#compare-guide"
              className="text-sm font-semibold text-stone-700 transition-colors hover:text-emerald-800"
            >
              How it works
            </Link>

            {isLoading ? (
              <div className="h-12 w-28 animate-pulse bg-stone-200" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="flex items-center gap-2 text-sm font-semibold text-stone-700 transition-colors hover:text-emerald-800"
                >
                  <Avatar name={profileName} photoUrl={profilePhotoUrl} size="sm" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/account/settings"
                  className="text-sm font-semibold text-stone-700 transition-colors hover:text-emerald-800"
                >
                  Account
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="min-h-12 border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-stone-700 transition-colors hover:text-emerald-800"
                >
                  Sign In
                </Link>
                <Link
                  href="/register/tutor"
                  className="inline-flex min-h-12 items-center bg-stone-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-900"
                >
                  Teach with us
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex min-h-12 min-w-12 items-center justify-center text-stone-800 lg:hidden"
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
          <div className="space-y-2 border-t border-stone-200 pb-5 pt-4 lg:hidden">
            <Link
              href="/find-tutor"
              className="flex min-h-12 items-center font-semibold text-stone-700 transition-colors hover:text-emerald-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Find a tutor
            </Link>
            <Link
              href="/online-quran"
              className="flex min-h-12 items-center font-semibold text-stone-700 transition-colors hover:text-emerald-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Online Quran
            </Link>
            <Link
              href="/#compare-guide"
              className="flex min-h-12 items-center font-semibold text-stone-700 transition-colors hover:text-emerald-800"
              onClick={() => setIsMenuOpen(false)}
            >
              How it works
            </Link>

            {isLoading ? (
              <div className="h-12 w-full animate-pulse bg-stone-200" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="flex min-h-12 items-center gap-3 font-semibold text-stone-700 transition-colors hover:text-emerald-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Avatar name={profileName} photoUrl={profilePhotoUrl} size="sm" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/account/settings"
                  className="flex min-h-12 items-center font-semibold text-stone-700 transition-colors hover:text-emerald-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Account Settings
                </Link>
                <button
                  onClick={() => {
                    void handleSignOut()
                  }}
                  disabled={isSigningOut}
                  className="flex min-h-12 w-full items-center text-left font-semibold text-stone-700 transition-colors hover:text-emerald-800 disabled:opacity-60"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex min-h-12 items-center font-semibold text-stone-700 transition-colors hover:text-emerald-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/register/tutor"
                  className="flex min-h-12 items-center justify-center bg-stone-950 px-4 py-3 font-bold text-white transition-colors hover:bg-emerald-900"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Teach with us
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
