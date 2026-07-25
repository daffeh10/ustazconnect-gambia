import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { getAdminContext } from '@/lib/admin'

export async function POST() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await sendEmail({
      to: admin.email,
      subject: 'TutorConnect Gambia test email',
      text: composeEmail([
        `Hi ${admin.name || 'Admin'},`,
        '',
        'This is a TutorConnect Gambia transactional email test.',
      ]),
    })

    return NextResponse.json({ ok: result.sent, skipped: result.skipped, error: result.error || null })
  } catch (error) {
    console.error('test email failed', error)
    return NextResponse.json({ error: 'Could not send test email.' }, { status: 500 })
  }
}
