export function getSafeSupabaseConfirmationUrl(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) return null

  try {
    const decoded = decodeURIComponent(value)
    const url = new URL(decoded)
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '')

    if (
      url.protocol !== 'https:' ||
      url.origin !== supabaseUrl.origin ||
      url.pathname !== '/auth/v1/verify'
    ) {
      return null
    }

    return decoded
  } catch {
    return null
  }
}

export type AuthEmailActionType = 'recovery' | 'invite'

export function getSafeAuthEmailToken(
  tokenValue: string | string[] | undefined,
  typeValue: string | string[] | undefined,
  expectedType: AuthEmailActionType
) {
  if (
    !tokenValue ||
    Array.isArray(tokenValue) ||
    !typeValue ||
    Array.isArray(typeValue) ||
    typeValue !== expectedType
  ) {
    return null
  }

  const token = tokenValue.trim()
  if (token.length < 20 || token.length > 512 || !/^[A-Za-z0-9._~-]+$/.test(token)) {
    return null
  }

  return token
}

export function buildAuthEmailActionPath(
  tokenHash: string,
  type: AuthEmailActionType
) {
  const params = new URLSearchParams({ token_hash: tokenHash, type })
  return `/update-password?${params.toString()}`
}
