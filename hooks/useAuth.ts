'use client'

import type { User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthRole = 'tutor' | 'family' | 'admin' | 'guest'
export type AuthProfile = Record<string, unknown> | null

export interface AuthContextValue {
  user: User | null
  profile: AuthProfile
  role: AuthRole
  isLoading: boolean
  openAuthModal: (returnTo?: string) => void
  closeAuthModal: () => void
  isAuthModalOpen: boolean
  authReturnTo: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}
