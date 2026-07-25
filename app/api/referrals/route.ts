import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const referredName = getString(body?.referredName)
    const referredContact = getString(body?.referredContact)
    const referredType = getString(body?.referredType) === 'tutor' ? 'tutor' : 'family'

    if (!referredName || !referredContact) {
      return NextResponse.json({ error: 'Name and contact are required.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    if (userError) throw userError

    const supabase = createAdminClient()
    const { error } = await supabase.from('referrals').insert({
      referrer_user_id: user.id,
      referred_name: referredName,
      referred_contact: referredContact,
      referred_type: referredType,
      status: 'submitted',
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('referral submit failed', error)
    return NextResponse.json({ error: 'Could not submit referral. Make sure the remaining roadmap SQL has been applied.' }, { status: 500 })
  }
}
