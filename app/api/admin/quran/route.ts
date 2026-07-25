import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminRole } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { createAdminClient } from '@/lib/supabase/admin'

interface QuranVerificationRow {
  id: string
  tutor_id: string
  recitation_video_url: string | null
  tajweed_assessment: string | null
  credential_summary: string | null
  scholar_reference: string | null
  status: string | null
  rejection_reason: string | null
  created_at: string
  tutor_profiles?: { name: string | null; email: string | null } | null
}

interface QuranVerificationRaw extends Omit<QuranVerificationRow, 'tutor_profiles'> {
  tutor_profiles?: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin', 'quran_verifier'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('quran_verifications')
      .select('id,tutor_id,recitation_video_url,tajweed_assessment,credential_summary,scholar_reference,status,rejection_reason,created_at,tutor_profiles(name,email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw error
    const verifications = ((data ?? []) as unknown as QuranVerificationRaw[]).map((row) => ({
      ...row,
      tutor_profiles: Array.isArray(row.tutor_profiles)
        ? row.tutor_profiles[0] || null
        : row.tutor_profiles || null,
    }))
    return NextResponse.json({ verifications })
  } catch (error) {
    console.error('admin quran verification fetch failed', error)
    return NextResponse.json({ error: 'Could not load Quran verification queue.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin', 'quran_verifier']) || !admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const verificationId = getString(body?.verificationId)
    const action = getString(body?.action)
    const rejectionReason = getString(body?.rejectionReason)

    if (!verificationId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid Quran verification update.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('quran_verifications')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? rejectionReason || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', verificationId)

    if (error) throw error

    await writeAdminAuditLog({
      admin,
      action: action === 'approve' ? 'quran_verification.approved' : 'quran_verification.rejected',
      targetType: 'quran_verification',
      targetId: verificationId,
      metadata: { rejectionReason },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin quran verification update failed', error)
    return NextResponse.json({ error: 'Could not update Quran verification.' }, { status: 500 })
  }
}
