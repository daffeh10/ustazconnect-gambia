import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { normalizeAuthActionType } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function getSafeNextPath(value: string | null, fallback: string) {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.startsWith('/admin')) return fallback
  return value
}

function buildRedirectUrl(request: NextRequest, pathname: string, errorCode?: string) {
  const redirectUrl = new URL(pathname, request.url)

  if (errorCode) {
    redirectUrl.searchParams.set('error_code', errorCode)
  }

  return redirectUrl
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const authType = normalizeAuthActionType(requestUrl.searchParams.get('type'))

  const fallbackNext = authType === 'recovery' ? '/update-password' : '/login'
  const nextPath = getSafeNextPath(requestUrl.searchParams.get('next'), fallbackNext)

  try {
    const supabase = await createClient()

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        return NextResponse.redirect(buildRedirectUrl(request, nextPath, 'otp_expired'))
      }

      return NextResponse.redirect(buildRedirectUrl(request, nextPath))
    }

    const supportedOtpType: EmailOtpType | null =
      authType === 'recovery' || authType === 'signup' || authType === 'invite' || authType === 'email_change'
        ? authType
        : null

    if (tokenHash && supportedOtpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: supportedOtpType,
      })

      if (error) {
        return NextResponse.redirect(buildRedirectUrl(request, nextPath, 'otp_expired'))
      }

      return NextResponse.redirect(buildRedirectUrl(request, nextPath))
    }

    return NextResponse.redirect(buildRedirectUrl(request, nextPath, 'invalid_link'))
  } catch (error) {
    console.error('Auth callback failed:', error)
    return NextResponse.redirect(buildRedirectUrl(request, nextPath, 'invalid_link'))
  }
}
