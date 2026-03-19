'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Header() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [dashboardHref, setDashboardHref] = useState('/dashboard')

  useEffect(() => {
    let isMounted = true

    async function syncUserState(userId: string | null) {
      if (!isMounted) return

      if (!userId) {
        setIsLoggedIn(false)
        setDashboardHref('/dashboard')
        return
      }

      setIsLoggedIn(true)

      try {
        const { data: adminProfile, error: adminError } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (adminError) throw adminError

        if (!isMounted) return

        if (adminProfile) {
          setDashboardHref('/admin')
          return
        }

        const { data: familyProfile, error: familyError } = await supabase
          .from('family_profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (familyError && familyError.code !== 'PGRST116' && familyError.code !== '42P01') {
          throw familyError
        }

        if (!isMounted) return
        setDashboardHref(familyProfile ? '/family/dashboard' : '/dashboard')
      } catch (error) {
        console.error('Failed to resolve header auth state', error)
        if (isMounted) {
          setDashboardHref('/dashboard')
        }
      }
    }

    // Check initial auth state on mount
    async function checkUser() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) throw error
        await syncUserState(session?.user?.id ?? null)
      } catch (authError) {
        console.error('Failed to load current user in header', authError)
        if (isMounted) {
          setIsLoggedIn(false)
          setDashboardHref('/dashboard')
        }
      }
    }
    void checkUser()

    // Stay in sync when user logs in or out (including other tabs)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUserState(session?.user?.id ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSignOut() {
    setIsMenuOpen(false)
    setIsSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    } catch (error) {
      console.error('Header sign-out failed', error)
    } finally {
      setIsLoggedIn(false)
      setDashboardHref('/dashboard')
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
            <Link href="/find-ustaz" className="text-gray-600 hover:text-emerald-700 transition">
              Find Tutor
            </Link>

            {isLoggedIn ? (
              <>
                <Link href={dashboardHref} className="text-gray-600 hover:text-emerald-700 transition">
                  Dashboard
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
                  href="/register"
                  className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Join Free
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
              href="/find-ustaz"
              className="block text-gray-600 hover:text-emerald-700 transition py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Find Tutor
            </Link>

            {isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="block text-gray-600 hover:text-emerald-700 transition py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
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
                  href="/register"
                  className="block bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Join Free
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
