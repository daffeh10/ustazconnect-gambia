import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminProfile } from '@/lib/admin'

export interface AdminAuditInput {
  admin: AdminProfile
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, unknown>
}

export async function writeAdminAuditLog(input: AdminAuditInput) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('admin_audit_logs').insert({
    actor_admin_id: input.admin.id,
    actor_user_id: input.admin.user_id,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId || null,
    metadata: input.metadata || {},
  })

  if (error) throw error
}
