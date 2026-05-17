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
    <header className="bg-white shadow-sm">
      <nav className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            TutorConnect Gambia
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-4 items-center">
            <Link href="/find-tutor" className="text-gray-600 hover:text-emerald-700 transition">
              Find Tutor
            </Link>

            {isLoading ? (
              <div className="h-10 w-28 rounded-lg bg-gray-100 animate-pulse" />
            ) : isLoggedIn ? (
              <>
                <Link href={dashboardHref} className="flex items-center gap-3 text-gray-600 hover:text-emerald-700 transition">
                  <Avatar name={profileName} photoUrl={profilePhotoUrl} size="sm" />
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-emerald-700 transition">
                  Sign In
                </Link>
                <Link
                  href="/register/tutor"
                  className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Become a Tutor
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-600"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
            <Link
              href="/find-tutor"
              className="block text-gray-600 hover:text-emerald-700 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Find Tutor
            </Link>

            {isLoading ? (
              <div className="h-10 w-full rounded-lg bg-gray-100 animate-pulse" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="flex items-center gap-3 text-gray-600 hover:text-emerald-700 transition py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Avatar name={profileName} photoUrl={profilePhotoUrl} size="sm" />
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={() => {
                    void handleSignOut()
                  }}
                  disabled={isSigningOut}
                  className="block w-full text-left text-gray-600 hover:text-emerald-700 transition py-2 disabled:opacity-60"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block text-gray-600 hover:text-emerald-700 transition py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/register/tutor"
                  className="block bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition text-center"
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
