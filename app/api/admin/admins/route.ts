import { NextResponse } from 'next/server'
import { buildPublicUrl } from '@/lib/auth'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'
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

function parseRole(value: string): AdminRole | null {
  if (value === 'owner' || value === 'admin') return value
  if (DIASPORA_QURAN_ENABLED && value === 'quran_verifier') return value
  return null
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

    const admins = (rows ?? []).map((row) => {
      const role = normalizeAdminRole(row.role)
      if (!role) throw new Error(`Admin ${row.id} has an invalid role.`)
      return {
        ...row,
        role,
        is_active: row.is_active !== false,
      }
    })

    return NextResponse.json({ admins })
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

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and a valid role are required.' }, { status: 400 })
    }
    if (name.length > 120 || email.length > 320) {
      return NextResponse.json({ error: 'Name or email is too long.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let userId = suppliedUserId

    if (!userId) {
      const invite = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: buildPublicUrl('/admin/login'),
        data: { role, full_name: name },
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

    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId)
    if (authUserError || !authUserData.user) {
      return NextResponse.json({ error: 'Supabase user not found.' }, { status: 400 })
    }
    if ((authUserData.user.email || '').toLowerCase() !== email) {
      return NextResponse.json(
        { error: 'The supplied user ID belongs to a different email address.' },
        { status: 400 }
      )
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

    if (
      !adminId ||
      !['disable', 'enable', 'role'].includes(action) ||
      (action === 'role' && !role)
    ) {
      return NextResponse.json({ error: 'Invalid admin update.' }, { status: 400 })
    }

    if (
      adminId === admin.id &&
      (action === 'disable' || (action === 'role' && role !== 'owner'))
    ) {
      return NextResponse.json({ error: 'You cannot remove your own owner access.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: target, error: targetError } = await supabase
      .from('admin_users')
      .select('id,role,is_active')
      .eq('id', adminId)
      .maybeSingle<{ id: string; role: string | null; is_active: boolean | null }>()

    if (targetError) throw targetError
    if (!target) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })

    const targetRole = normalizeAdminRole(target.role)
    if (!targetRole) {
      return NextResponse.json({ error: 'The target admin has an invalid role.' }, { status: 409 })
    }

    const removesActiveOwner =
      targetRole === 'owner' &&
      target.is_active !== false &&
      (action === 'disable' || (action === 'role' && role !== 'owner'))

    if (removesActiveOwner) {
      const { count, error: ownerCountError } = await supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('is_active', true)

      if (ownerCountError) throw ownerCountError
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'Add another active owner before removing the last owner.' },
          { status: 400 }
        )
      }
    }

    const updatePayload =
      action === 'role'
        ? { role: role as AdminRole }
        : { is_active: action === 'enable' }

    const { data: updated, error } = await supabase
      .from('admin_users')
      .update(updatePayload)
      .eq('id', adminId)
      .select('id')
      .maybeSingle<{ id: string }>()
    if (error) throw error
    if (!updated) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 })

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
