import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const notes = getString(body?.notes)
    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    if (userError) throw userError

    const supabase = createAdminClient()
    const { error } = await supabase.from('privacy_requests').insert({
      user_id: user.id,
      request_type: 'delete',
      notes: notes || null,
      status: 'submitted',
    })

    if (error) {
      const message = error.message.toLowerCase()
      if (!message.includes('privacy_requests') && !message.includes('does not exist') && !message.includes('schema cache')) {
        throw error
      }
    }

    await sendEmail({
      to: 'tutorconnectgambia@gmail.com',
      subject: 'Account deletion request',
      text: composeEmail([
        'A user requested account deletion.',
        '',
        `User ID: ${user.id}`,
        `Email: ${user.email || 'No email'}`,
        notes ? `Notes: ${notes}` : 'Notes: none',
      ]),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('delete request failed', error)
    return NextResponse.json({ error: 'Could not submit deletion request.' }, { status: 500 })
  }
}
