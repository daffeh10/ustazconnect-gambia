import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { getAdminContext, hasAdminRole } from '@/lib/admin'

/**
 * Sends one test email to the signed-in admin and reports exactly what the
 * provider said.
 *
 * Every other send in the app is fire-and-forget, so a misconfigured key or an
 * unverified From address fails silently and looks identical to "the email never
 * arrived". Open this route while signed in to the admin to get the real answer.
 */
export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin']) || !admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!admin.email?.trim()) {
      return NextResponse.json(
        { error: 'Your admin account has no email address on file.' },
        { status: 400 }
      )
    }

    const configured = {
      resendApiKey: Boolean(process.env.RESEND_API_KEY),
      // The address itself is safe to show an admin, and it is the setting most
      // likely to be wrong: Resend rejects any From on an unverified domain.
      fromAddress:
        process.env.RESEND_FROM_EMAIL ||
        'TutorConnect Gambia <notifications@tutorconnectgambia.com> (default)',
    }

    const result = await sendEmail({
      to: admin.email.trim(),
      subject: 'TutorConnect email test',
      text: composeEmail([
        `Hi ${admin.name || 'there'},`,
        '',
        'This is a test message from the TutorConnect admin dashboard.',
        'If you are reading it, transactional email is working.',
      ]),
    })

    return NextResponse.json({
      sentTo: admin.email.trim(),
      configured,
      result,
      verdict: result.sent
        ? 'Email sent. Check your inbox, and your spam folder if it is not there.'
        : result.skipped
          ? 'RESEND_API_KEY is not visible to this deployment. Confirm it is set for Production and redeploy.'
          : `Resend refused the message: ${result.error || 'unknown error'}`,
    })
  } catch (error) {
    console.error('admin email test failed', error)
    return NextResponse.json({ error: 'Email test failed to run.' }, { status: 500 })
  }
}
