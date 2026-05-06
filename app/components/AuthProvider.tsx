'use client'

import type { User } from '@supabase/supabase-js'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthProfile, type AuthRole } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import AuthModal from './AuthModal'

interface AuthProviderProps {
  children: ReactNode
}

interface SupabaseLikeError {
  code?: string | null
  message?: string | null
}

const AUTH_RETURN_TO_KEY = 'auth:returnTo'

function isNoRowError(error: SupabaseLikeError | null) {
  return error?.code?.toUpperCase() === 'PGRST116'
}

function getSafeReturnTo(returnTo?: string | null) {
  if (!returnTo) return null
  if (!returnTo.startsWith('/')) return null
  if (returnTo.startsWith('//')) return null
  if (returnTo.startsWith('/admin')) return null
  return returnTo
}

function readStoredReturnTo() {
  if (typeof window === 'undefined') return null
  return getSafeReturnTo(window.sessionStorage.getItem(AUTH_RETURN_TO_KEY))
}

function writeStoredReturnTo(returnTo?: string | null) {
  if (typeof window === 'undefined') return

  const safeValue = getSafeReturnTo(returnTo)
  if (safeValue) {
    window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, safeValue)
  } else {
    window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY)
  }
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthProfile>(null)
  const [role, setRole] = useState<AuthRole>('guest')
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authReturnTo, setAuthReturnTo] = useState<string | null>(null)

  const resolveRoleAndProfile = useCallback(
    async (userId: string): Promise<{ role: AuthRole; profile: AuthProfile }> => {
      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_users')
        .select('id,user_id,name,email,role')
        .eq('user_id', userId)
        .maybeSingle<Record<string, unknown>>()

      if (adminError && !isNoRowError(adminError)) {
        throw adminError
      }

      if (adminProfile) {
        return { role: 'admin', profile: adminProfile }
      }

      const { data: tutorProfile, error: tutorError } = await supabase
        .from('tutor_profiles')
        .select('id,user_id,name,email,phone,profile_photo_url')
        .eq('user_id', userId)
        .maybeSingle<Record<string, unknown>>()

      if (tutorError && !isNoRowError(tutorError)) {
        throw tutorError
      }

      if (tutorProfile) {
        return { role: 'tutor', profile: tutorProfile }
      }

      const { data: familyProfile, error: familyError } = await supabase
        .from('family_profiles')
        .select('id,user_id,parent_name,email,phone,location')
        .eq('user_id', userId)
        .maybeSingle<Record<string, unknown>>()

      if (familyError && !isNoRowError(familyError)) {
        throw familyError
      }

      if (familyProfile) {
        return { role: 'family', profile: familyProfile }
      }

      return { role: 'guest', profile: null }
    },
    [supabase]
  )

  const syncAuthState = useCallback(
    async (sessionUser: User | null) => {
      setUser(sessionUser)

      if (!sessionUser) {
        setProfile(null)
        setRole('guest')
        setIsLoading(false)
        return
      }

      try {
        const resolved = await resolveRoleAndProfile(sessionUser.id)
        setProfile(resolved.profile)
        setRole(resolved.role)
      } catch (error) {
        console.error('Failed to sync auth state', error)
        setProfile(null)
        setRole('guest')
      } finally {
        setIsLoading(false)
      }
    },
    [resolveRoleAndProfile]
  )

  useEffect(() => {
    let isMounted = true

    async function initializeAuthState() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) throw error
        if (!isMounted) return
        await syncAuthState(session?.user ?? null)
      } catch (error) {
        console.error('Failed to load auth session', error)
        if (isMounted) {
          setUser(null)
          setProfile(null)
          setRole('guest')
          setIsLoading(false)
        }
      }
    }

    void initializeAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthState(session?.user ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, syncAuthState])

  const openAuthModal = useCallback((returnTo?: string) => {
    const safeReturnTo = getSafeReturnTo(returnTo)
    setAuthReturnTo(safeReturnTo)
    writeStoredReturnTo(safeReturnTo)
    setIsAuthModalOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false)
    setAuthReturnTo(null)
    writeStoredReturnTo(null)
  }, [])

  const handleAuthSuccess = useCallback(() => {
    const destination = authReturnTo || readStoredReturnTo()
    setIsAuthModalOpen(false)
    setAuthReturnTo(null)
    writeStoredReturnTo(null)

    if (destination && destination !== pathname) {
      router.push(destination)
    }
  }, [authReturnTo, pathname, router])

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      isLoading,
      openAuthModal,
      closeAuthModal,
      isAuthModalOpen,
      authReturnTo,
    }),
    [authReturnTo, closeAuthModal, isAuthModalOpen, isLoading, openAuthModal, profile, role, user]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
        returnTo={authReturnTo ?? undefined}
      />
    </AuthContext.Provider>
  )
}
