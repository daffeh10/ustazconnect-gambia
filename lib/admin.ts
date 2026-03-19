import { createClient } from '@/lib/supabase/server'

export interface AdminProfile {
  id: string
  user_id: string
  name: string
  email: string
  role: string | null
}

export async function getAdminContext() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) return { user: null, admin: null, supabase }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('id,user_id,name,email,role')
    .eq('user_id', user.id)
    .maybeSingle<AdminProfile>()

  if (adminError) throw adminError

  return { user, admin: admin ?? null, supabase }
}
