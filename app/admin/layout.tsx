'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/tutors', label: 'Tutors' },
  { href: '/admin/documents', label: 'Documents' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/payouts', label: 'Payouts' },
  { href: '/admin/analytics', label: 'Analytics' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [adminName, setAdminName] = useState('Admin')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') return

    let isMounted = true

    async function loadAdminName() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user || !isMounted) return

        const { data: admin } = await supabase
          .from('admin_users')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle<{ name: string | null }>()

        if (isMounted && admin?.name) {
          setAdminName(admin.name)
        }
      } catch (error) {
        console.error('Failed to load admin profile', error)
      }
    }

    void loadAdminName()

    return () => {
      isMounted = false
    }
  }, [pathname, supabase])

  useEffect(() => {
    setIsNavOpen(false)
  }, [pathname])

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/admin/login')
      router.refresh()
    } catch (error) {
      console.error('Admin sign-out failed', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/admin" className="block">
            <p className="text-xl font-bold text-emerald-600">TutorConnect</p>
            <p className="text-xs text-gray-500">Admin</p>
          </Link>

          <button
            type="button"
            onClick={() => setIsNavOpen((current) => !current)}
            className="rounded-lg border border-gray-300 p-2 text-gray-700"
            aria-label="Toggle admin navigation"
            aria-expanded={isNavOpen}
          >
            {isNavOpen ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {isNavOpen && (
        <div className="fixed inset-0 z-20 bg-gray-950/40 md:hidden" onClick={() => setIsNavOpen(false)}>
          <aside
            className="h-full w-72 max-w-[85vw] bg-gray-900 px-4 py-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-8">
              <p className="text-2xl font-bold text-emerald-500">TutorConnect</p>
              <p className="mt-1 text-sm text-gray-400">Admin</p>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-4 py-2 transition-colors ${
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="mt-8 border-t border-gray-800 pt-4">
              <p className="mb-3 text-sm text-gray-400">{adminName}</p>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full rounded-lg border border-gray-700 px-4 py-2 text-left text-gray-300 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-60"
              >
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 hidden w-56 bg-gray-900 px-4 py-6 md:block">
        <div className="mb-8">
          <Link href="/admin" className="block">
            <p className="text-2xl font-bold text-emerald-500">TutorConnect</p>
            <p className="text-sm text-gray-400 mt-1">Admin</p>
          </Link>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-2 transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-6 left-4 right-4">
          <p className="text-sm text-gray-400 mb-3">{adminName}</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full rounded-lg border border-gray-700 px-4 py-2 text-left text-gray-300 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-60"
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      <main className="min-h-screen bg-gray-50 p-4 md:ml-56 md:p-8">{children}</main>
    </div>
  )
}
