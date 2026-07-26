import { PRICING } from '@/lib/pricing'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function queueTrialPayout(params: {
  supabase: AdminClient
  bookingId: string
  tutorId: string
  confirmedAt: string
}) {
  const payoutDate = params.confirmedAt.slice(0, 10)
  const { error } = await params.supabase.from('payouts').insert({
    tutor_id: params.tutorId,
    booking_id: params.bookingId,
    payout_type: 'trial',
    amount: PRICING.trialFeeAmount,
    commission_deducted: 0,
    lessons_count: 1,
    period_start: payoutDate,
    period_end: payoutDate,
    status: 'pending',
  })

  if (error?.code === '23505') return false
  if (error) throw error
  return true
}
