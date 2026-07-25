import { createClient } from '@/lib/supabase/server'

export type AdminRole = 'owner' | 'admin' | 'quran_verifier'

export interface AdminProfile {
  id: string
  user_id: string
  name: string
  email: string
  role: AdminRole | string | null
  is_active?: boolean | null
}

export async function getAdminContext() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (!user) return { user: null, admin: null, supabase }
  if (userError) throw userError

  let { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('id,user_id,name,email,role,is_active')
    .eq('user_id', user.id)
    .maybeSingle<AdminProfile>()

  if (
    adminError &&
    (
      adminError.message.toLowerCase().includes('is_active') ||
      adminError.message.toLowerCase().includes('column')
    )
  ) {
    const fallback = await supabase
      .from('admin_users')
      .select('id,user_id,name,email,role')
      .eq('user_id', user.id)
      .maybeSingle<AdminProfile>()

    admin = fallback.data
    adminError = fallback.error
  }

  if (adminError) throw adminError

  if (admin && admin.is_active === false) {
    return { user, admin: null, supabase }
  }

  return { user, admin: admin ?? null, supabase }
}

export function hasAdminRole(admin: AdminProfile | null, allowedRoles: AdminRole[]) {
  if (!admin) return false
  return allowedRoles.includes(normalizeAdminRole(admin.role))
}

export function normalizeAdminRole(role: string | null | undefined): AdminRole {
  if (role === 'owner' || role === 'quran_verifier') return role
  return 'admin'
}
