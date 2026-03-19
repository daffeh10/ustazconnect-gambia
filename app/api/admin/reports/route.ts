import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('reports')
      .select('id,reporter_type,reason,details,status,admin_notes,created_at,resolved_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ reports: data ?? [] })
  } catch (error) {
    console.error('admin reports fetch failed', error)
    return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const reportId = typeof body?.reportId === 'string' ? body.reportId.trim() : ''
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : ''
    const adminNotes = typeof body?.adminNotes === 'string' ? body.adminNotes.trim() : ''

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const resolvedAt = status === 'pending' ? null : new Date().toISOString()
    const { error } = await supabase
      .from('reports')
      .update({
        status,
        admin_notes: adminNotes || null,
        resolved_at: resolvedAt,
      })
      .eq('id', reportId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin reports update failed', error)
    return NextResponse.json({ error: 'Could not update report.' }, { status: 500 })
  }
}
