import { NextResponse } from 'next/server'
import { buildPublicUrl } from '@/lib/auth'
import { composeEmail, sendEmail } from '@/lib/email'
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

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
) {
  const perPage = 1_000

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const user = data.users.find(
      (candidate) => (candidate.email || '').trim().toLowerCase() === email
    )
    if (user) return user
    if (data.users.length < perPage) return null
  }

  throw new Error('Auth user lookup exceeded the supported page limit.')
}

function getInviteDeliveryError(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes('email address not authorized')) {
    return 'Supabase Auth cannot email this address until custom SMTP is configured.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'The Auth email rate limit was reached. Wait, then send one new invitation.'
  }
  if (lower.includes('redirect')) {
    return 'The invitation redirect is not allowed in Supabase Auth URL Configuration.'
  }
  if (lower.includes('sending') || lower.includes('smtp')) {
    return 'Supabase Auth could not hand the invitation to the configured email provider.'
  }

  return 'Supabase Auth could not send the invitation. Check the Auth logs for the provider error.'
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
    let invitationSent = false
    let invitedAuthUserCreated = false

    if (!userId) {
      const existingUser = await findAuthUserByEmail(supabase, email)

      if (existingUser) {
        userId = existingUser.id
      } else {
        const invite = await supabase.auth.admin.inviteUserByEmail(email, {
          // Admin invites use the implicit Auth flow, whose session is returned
          // in a URL fragment. Send it directly to the client page so the
          // fragment is not lost by a server-side callback.
          redirectTo: buildPublicUrl('/update-password'),
          data: { role, full_name: name },
        })

        if (invite.error) {
          console.error('Supabase admin invitation failed', {
            code: invite.error.code,
            status: invite.error.status,
            message: invite.error.message,
          })
          return NextResponse.json(
            { error: getInviteDeliveryError(invite.error.message) },
            { status: 502 }
          )
        }

        userId = invite.data.user?.id || ''
        invitationSent = true
        invitedAuthUserCreated = Boolean(userId)
      }
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

    const { data: existingAdmin, error: existingAdminError } = await supabase
      .from('admin_users')
      .select('id,is_active')
      .eq('user_id', userId)
      .maybeSingle<{ id: string; is_active: boolean | null }>()
    if (existingAdminError) throw existingAdminError
    if (existingAdmin) {
      return NextResponse.json(
        {
          error: existingAdmin.is_active === false
            ? 'This user already has disabled admin access. Enable the existing admin instead.'
            : 'This user already has admin access.',
        },
        { status: 409 }
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

    if (insert.error) {
      if (invitedAuthUserCreated) {
        const cleanup = await supabase.auth.admin.deleteUser(userId)
        if (cleanup.error) {
          console.error('Could not remove orphaned invited Auth user', {
            userId,
            message: cleanup.error.message,
          })
        }
      }
      throw insert.error
    }

    await writeAdminAuditLog({
      admin,
      action: 'admin.created',
      targetType: 'admin_user',
      targetId: userId,
      metadata: { email, role },
    })

    if (invitationSent) {
      return NextResponse.json({
        ok: true,
        message: 'Admin invited. They must open the newest invitation email and create a password.',
        delivery: 'invite_sent',
      })
    }

    const notification = await sendEmail({
      to: email,
      subject: 'TutorConnect Gambia admin access',
      text: composeEmail([
        `Hi ${name},`,
        '',
        'You now have access to the TutorConnect Gambia admin dashboard.',
        `Sign in: ${buildPublicUrl('/admin/login')}`,
        `Forgot your password? ${buildPublicUrl('/forgot-password')}`,
      ]),
    })

    if (!notification.sent) {
      return NextResponse.json({
        ok: true,
        message: 'Admin access was added for the existing TutorConnect account.',
        warning: notification.skipped
          ? 'The access email was not sent because RESEND_API_KEY is not configured.'
          : notification.error || 'The access email could not be sent.',
        delivery: 'access_granted_email_failed',
      })
    }

    return NextResponse.json({
      ok: true,
      message: 'Admin access was added and a sign-in email was sent to the existing user.',
      delivery: 'access_granted_email_sent',
    })
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
