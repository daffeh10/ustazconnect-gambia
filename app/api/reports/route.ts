import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

const REPORT_REASONS = new Set([
  'Did not show up for the lesson',
  'Inappropriate behaviour',
  'Qualifications not as described',
  'Safety concern',
  'Other',
])

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tutorId = getString(body?.tutorId)
    const reason = getString(body?.reason)
    const details = getString(body?.details)

    if (!tutorId || !REPORT_REASONS.has(reason) || details.length > 2_000) {
      return NextResponse.json({ error: 'Please provide valid report details.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    if (userError) throw userError

    const supabase = createAdminClient()
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('user_id')
      .eq('id', tutorId)
      .eq('is_approved', true)
      .eq('is_active', true)
      .maybeSingle<{ user_id: string }>()

    if (tutorError) throw tutorError
    if (!tutor) {
      return NextResponse.json({ error: 'Tutor not found.' }, { status: 404 })
    }
    if (tutor.user_id === user.id) {
      return NextResponse.json({ error: 'You cannot report your own profile.' }, { status: 400 })
    }

    const reporterType =
      user.user_metadata?.role === 'family' || user.user_metadata?.role === 'tutor'
        ? user.user_metadata.role
        : 'user'
    const { error: insertError } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reporter_type: reporterType,
      reported_user_id: tutor.user_id,
      reason,
      details: details || null,
    })

    if (insertError) throw insertError
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('report submission failed', error)
    return NextResponse.json({ error: 'Could not submit your report.' }, { status: 500 })
  }
}
