import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminRole } from '@/lib/admin'
import { buildPublicUrl } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function getAuthEmailTestError(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes('email address not authorized')) {
    return 'Custom SMTP is not configured. Supabase Auth only permits team addresses with its default mailer.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'The Supabase Auth email rate limit was reached. Wait before testing again.'
  }
  if (lower.includes('redirect')) {
    return 'The production callback URL is missing from Supabase Auth Redirect URLs.'
  }
  if (lower.includes('sending') || lower.includes('smtp')) {
    return 'Supabase Auth could not send through the configured SMTP provider. Check Auth and Resend logs.'
  }

  return 'Supabase Auth rejected the test. Check Authentication logs for the full provider error.'
}

export async function POST() {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner']) || !admin) {
      return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.auth.resetPasswordForEmail(admin.email, {
      redirectTo: buildPublicUrl('/update-password'),
    })

    if (error) {
      console.error('Supabase Auth email health test failed', {
        code: error.code,
        status: error.status,
        message: error.message,
      })
      return NextResponse.json(
        { ok: false, error: getAuthEmailTestError(error.message) },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Supabase Auth accepted the test. Check ${admin.email} and the Resend delivery log.`,
    })
  } catch (error) {
    console.error('Supabase Auth email health test crashed', error)
    return NextResponse.json(
      { error: 'Could not run the Auth email test.' },
      { status: 500 }
    )
  }
}
