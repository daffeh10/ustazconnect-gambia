import { composeEmail, sendEmail, type SendEmailResult } from '@/lib/email'
import type { createAdminClient } from '@/lib/supabase/admin'

type Database = ReturnType<typeof createAdminClient>

export interface PaymentReminderBooking {
  id: string
  tutor_id: string
  family_id: string | null
  family_name: string | null
  subjects: string[] | null
  grand_total: number | null
}

export const PAYMENT_REMINDER_SELECT = 'id,tutor_id,family_id,family_name,subjects,grand_total'

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorconnectgambia.com').replace(/\/$/, '')
}

/**
 * Emails the family a direct payment link for a booking the tutor accepted but
 * nobody has paid for. Callers decide eligibility and record the send time.
 */
export async function sendPaymentReminderEmail(db: Database, booking: PaymentReminderBooking): Promise<SendEmailResult> {
  if (!booking.family_id) return { sent: false, skipped: false, error: 'This booking has no family account.' }

  const [{ data: tutor }, familyResult] = await Promise.all([
    db.from('tutor_profiles').select('name').eq('id', booking.tutor_id).maybeSingle<{ name: string | null }>(),
    db.auth.admin.getUserById(booking.family_id),
  ])
  const familyEmail = familyResult.data.user?.email
  if (!familyEmail) return { sent: false, skipped: false, error: 'The family account has no email address.' }

  const subjects = (booking.subjects ?? []).filter(Boolean).join(', ')
  const amount = Number(booking.grand_total)
  return sendEmail({
    to: familyEmail,
    subject: 'Complete payment to start your lessons',
    text: composeEmail([
      `Hi ${booking.family_name || 'there'},`,
      '',
      `${tutor?.name || 'Your tutor'} accepted your booking, but payment has not been completed yet. Lessons are scheduled once payment is received.`,
      ...(subjects ? [`Subject: ${subjects}`] : []),
      ...(Number.isFinite(amount) && amount > 0 ? [`Amount: GMD ${amount.toLocaleString()}`] : []),
      '',
      `Pay securely here: ${getSiteUrl()}/payment/${booking.id}`,
      'You can pay with mobile money or card. If you no longer need this booking, just reply and let us know.',
    ]),
  })
}
