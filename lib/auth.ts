import type { SupabaseClient, User } from '@supabase/supabase-js'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value)
    return LOCAL_HOSTNAMES.has(url.hostname) || url.hostname.endsWith('.local')
  } catch {
    return false
  }
}

export function getPublicSiteUrl() {
  const envUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL?.trim() || '')
  const browserUrl =
    typeof window !== 'undefined' ? trimTrailingSlash(window.location.origin) : ''

  if (browserUrl && !isLocalUrl(browserUrl)) {
    return browserUrl
  }

  if (envUrl && !isLocalUrl(envUrl)) {
    return envUrl
  }

  return browserUrl || envUrl || 'http://localhost:3000'
}

export function buildPublicUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getPublicSiteUrl()}${normalizedPath}`
}

export function normalizeAuthActionType(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/[^a-z_]/g, '')
}

export function passwordMeetsRequirements(password: string) {
  return password.length >= 8
}

export function getFriendlyRegistrationError(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'This email is already registered. Please sign in instead.'
  }

  if (
    lower.includes('invalid email') ||
    lower.includes('unable to validate email address') ||
    lower.includes('email address is invalid')
  ) {
    return 'Please enter a valid email address.'
  }

  if (
    lower.includes('error sending confirmation email') ||
    lower.includes('email rate limit exceeded')
  ) {
    return 'We could not send a confirmation email right now. Please try again in a few minutes.'
  }

  if (lower.includes('password')) {
    return 'Password must be at least 8 characters long.'
  }

  return 'We could not create your account. Please check your details and try again.'
}

export function isEmailConfirmationPendingError(message: string) {
  const lower = message.toLowerCase()

  return (
    lower.includes('email not confirmed') ||
    lower.includes('email address not confirmed') ||
    lower.includes('confirm your email') ||
    lower.includes('signup is disabled for unconfirmed users')
  )
}

export function getFriendlyLoginError(message: string) {
  if (isEmailConfirmationPendingError(message)) {
    return 'Your email is not confirmed yet. Check your inbox or resend the confirmation email below.'
  }

  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }

  if (lower.includes('invalid refresh token') || lower.includes('refresh token not found')) {
    return 'Your sign-in session has expired. Please sign in again.'
  }

  if (lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a moment and try again.'
  }

  return 'We could not sign you in right now. Please try again.'
}

function getFallbackDisplayName(user: User) {
  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name.trim()
      : ''

  if (metadataName) {
    return metadataName
  }

  const emailLocalPart = user.email?.split('@')[0]?.trim()
  return emailLocalPart || 'User'
}

function getTutorSubjectsFromMetadata(user: User) {
  const metadataSubjects = user.user_metadata?.selected_subjects

  if (!Array.isArray(metadataSubjects)) {
    return [] as string[]
  }

  return metadataSubjects.filter((subject): subject is string => typeof subject === 'string' && subject.trim().length > 0)
}

function isMissingSchemaError(error: { code?: string | null; message?: string | null } | null) {
  const code = error?.code?.toLowerCase() || ''
  const message = error?.message?.toLowerCase() || ''

  return (
    code === '42p01' ||
    code === 'pgrst205' ||
    message.includes('relation') ||
    message.includes('does not exist')
  )
}

function isDuplicateError(error: { code?: string | null; message?: string | null } | null) {
  const code = error?.code?.toLowerCase() || ''
  const message = error?.message?.toLowerCase() || ''

  return code === '23505' || message.includes('duplicate key')
}

export async function ensureProfileForUser(supabase: SupabaseClient, user: User) {
  const role =
    typeof user.user_metadata?.role === 'string'
      ? user.user_metadata.role.toLowerCase().trim()
      : ''
  const email = user.email?.trim()

  if (!role || !email) {
    return
  }

  const displayName = getFallbackDisplayName(user)

  if (role === 'family') {
    const { data, error } = await supabase
      .from('family_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()

    if (error && !isMissingSchemaError(error)) {
      throw error
    }

    if (!data) {
      const { error: insertError } = await supabase.from('family_profiles').insert({
        user_id: user.id,
        parent_name: displayName,
        email,
      })

      if (insertError && !isDuplicateError(insertError)) {
        throw insertError
      }
    }
  }

  if (role === 'tutor') {
    const { data, error } = await supabase
      .from('tutor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()

    if (error && !isMissingSchemaError(error)) {
      throw error
    }

    if (!data) {
      const tutorSubjects = getTutorSubjectsFromMetadata(user)
      const { error: insertError } = await supabase.from('tutor_profiles').insert({
        user_id: user.id,
        name: displayName,
        email,
        subjects: tutorSubjects,
        is_active: true,
        is_approved: false,
      })

      if (insertError && !isDuplicateError(insertError)) {
        throw insertError
      }
    }
  }
}
