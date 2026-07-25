import { NextResponse } from 'next/server'
import { buildPublicUrl } from '@/lib/auth'
import { getAdminContext, hasAdminRole, normalizeAdminRole, type AdminRole } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { createAdminClient } from '@/lib/supabase/admin'

interface AdminUserRow {
  id: string
  user_id: string
  name: string
  email: string
  role: string | null
  is_active?: boolean | null
  created_at?: string | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseRole(value: string): AdminRole {
  if (value === 'owner' || value === 'quran_verifier') return value
  return 'admin'
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner'])) {
      return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
    }

    const supabase = createAdminClient()
    let rows: AdminUserRow[] | null = null
    const primaryResult = await supabase
      .from('admin_users')
      .select('id,user_id,name,email,role,is_active,created_at')
      .order('created_at', { ascending: false })
    let error = primaryResult.error
    rows = (primaryResult.data ?? null) as AdminUserRow[] | null

    if (
      error &&
      (error.message.toLowerCase().includes('is_active') || error.message.toLowerCase().includes('column'))
    ) {
      const fallback = await supabase
        .from('admin_users')
        .select('id,user_id,name,email,role')
        .order('name', { ascending: true })
      rows = (fallback.data ?? null) as AdminUserRow[] | null
      error = fallback.error
    }

    if (error) throw error

    return NextResponse.json({
      admins: (rows ?? []).map((row) => ({
        ...row,
        role: normalizeAdminRole(row.role),
        is_active: row.is_active !== false,
      })),
    })
  } catch (error) {
    console.error('admin users fetch failed', error)
    return NextResponse.json({ error: 'Could not load admins.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner']) || !admin) {
      return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
    }

    const body = await request.json()
    const name = getString(body?.name)
    const email = getString(body?.email).toLowerCase()
    const suppliedUserId = getString(body?.userId)
    const role = parseRole(getString(body?.role))

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let userId = suppliedUserId

    if (!userId) {
      const invite = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: buildPublicUrl('/admin/login'),
        data: { role: 'admin', full_name: name },
      })

      if (invite.error) {
        return NextResponse.json(
          {
            error:
              'Could not invite this email. If the user already exists, paste their Supabase user ID and try again.',
          },
          { status: 400 }
        )
      }

      userId = invite.data.user?.id || ''
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing Supabase user ID for admin.' }, { status: 400 })
    }

    let insert = await supabase.from('admin_users').insert({
      user_id: userId,
      name,
      email,
      role,
      is_active: true,
      created_by: admin.id,
    })

    if (
      insert.error &&
      (
        insert.error.message.toLowerCase().includes('is_active') ||
        insert.error.message.toLowerCase().includes('created_by') ||
        insert.error.message.toLowerCase().includes('column')
      )
    ) {
      insert = await supabase.from('admin_users').insert({
        user_id: userId,
        name,
        email,
        role,
      })
    }

    if (insert.error) throw insert.error

    await writeAdminAuditLog({
      admin,
      action: 'admin.created',
      targetType: 'admin_user',
      targetId: userId,
      metadata: { email, role },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin users create failed', error)
    return NextResponse.json({ error: 'Could not add admin.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner']) || !admin) {
      return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
    }

    const body = await request.json()
    const adminId = getString(body?.adminId)
    const action = getString(body?.action)
    const role = parseRole(getString(body?.role))

    if (!adminId || !['disable', 'enable', 'role'].includes(action)) {
      return NextResponse.json({ error: 'Invalid admin update.' }, { status: 400 })
    }

    if (adminId === admin.id && action === 'disable') {
      return NextResponse.json({ error: 'You cannot disable your own owner account.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updatePayload =
      action === 'role'
        ? { role }
        : { is_active: action === 'enable' }

    const { error } = await supabase.from('admin_users').update(updatePayload).eq('id', adminId)
    if (error) throw error

    await writeAdminAuditLog({
      admin,
      action: action === 'role' ? 'admin.role_changed' : `admin.${action}d`,
      targetType: 'admin_user',
      targetId: adminId,
      metadata: action === 'role' ? { role } : {},
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin users update failed', error)
    return NextResponse.json({ error: 'Could not update admin.' }, { status: 500 })
  }
}
