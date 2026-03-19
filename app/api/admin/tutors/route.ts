import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

interface TutorRow {
  id: string
  name: string
  email: string
  phone: string | null
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  created_at: string
}

function daysSince(dateString: string) {
  const createdAt = new Date(dateString).getTime()
  if (Number.isNaN(createdAt)) return 0
  return Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)))
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tutor_profiles')
      .select('id,name,email,phone,location,subjects,hourly_rate,bio,created_at')
      .eq('is_approved', false)
      .order('created_at', { ascending: true })

    if (error) throw error

    const tutors = ((data ?? []) as TutorRow[]).map((tutor) => ({
      ...tutor,
      applied_days_ago: daysSince(tutor.created_at),
    }))

    return NextResponse.json({ tutors })
  } catch (error) {
    console.error('admin tutors fetch failed', error)
    return NextResponse.json({ error: 'Could not load pending tutors.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const tutorId = typeof body?.tutorId === 'string' ? body.tutorId.trim() : ''
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : ''

    if (!tutorId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updatePayload =
      action === 'approve'
        ? { is_approved: true, updated_at: new Date().toISOString() }
        : { is_active: false, updated_at: new Date().toISOString() }

    const { error } = await supabase
      .from('tutor_profiles')
      .update(updatePayload)
      .eq('id', tutorId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin tutor update failed', error)
    return NextResponse.json({ error: 'Could not update tutor approval.' }, { status: 500 })
  }
}
