import { readAllRows } from '@/lib/database-pages'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, hasAdminRole } from '@/lib/admin'

interface BookingRow {
  id: string
  family_name: string
  tutor_id: string
  status: string | null
  grand_total: number
  created_at: string
}

interface TutorNameRow {
  id: string
  name: string | null
}

function startOfMonthIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const monthStart = startOfMonthIso()

    const [
      tutorsResult,
      pendingTutorsResult,
      familiesResult,
      activeBookingsResult,
      lessonsThisMonthResult,
      revenueResult,
      commissionsResult,
      recentBookingsResult,
    ] = await Promise.all([
      supabase.from('tutor_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('tutor_profiles').select('id', { count: 'exact', head: true }).eq('is_approved', false),
      supabase.from('family_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', monthStart),
      readAllRows((start, end) => supabase.from('payments').select('total,service_fee').eq('status', 'completed').gte('paid_at', monthStart).order('id').range(start, end)),
      readAllRows((start, end) => supabase.from('payouts').select('commission_deducted').eq('status', 'completed').gte('completed_at', monthStart).order('id').range(start, end)),
      supabase.from('bookings').select('id,family_name,tutor_id,status,grand_total,created_at').order('created_at', { ascending: false }).limit(10),
    ])

    const errors = [
      tutorsResult.error,
      pendingTutorsResult.error,
      familiesResult.error,
      activeBookingsResult.error,
      lessonsThisMonthResult.error,
      revenueResult.error,
      commissionsResult.error,
      recentBookingsResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      throw errors[0]
    }

    const bookings = (recentBookingsResult.data ?? []) as BookingRow[]
    const recentPayments = bookings.length ? await readAllRows((start, end) => supabase.from('payments')
      .select('booking_id,status,total').in('booking_id', bookings.map((booking) => booking.id))
      .order('id').range(start, end)) : { data: [] }
    const uniqueTutorIds = Array.from(new Set(bookings.map((booking) => booking.tutor_id)))
    let tutorNames: Record<string, string> = {}

    if (uniqueTutorIds.length > 0) {
      const { data: tutorRows, error: tutorNamesError } = await supabase
        .from('tutor_profiles')
        .select('id,name')
        .in('id', uniqueTutorIds)

      if (tutorNamesError) throw tutorNamesError

      tutorNames = ((tutorRows ?? []) as TutorNameRow[]).reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.name?.trim() || 'Tutor'
        return acc
      }, {})
    }

    const revenueThisMonth = (revenueResult.data ?? []).reduce((sum, payment) => {
      const total = typeof payment.total === 'number' ? payment.total : Number(payment.total) || 0
      return sum + total
    }, 0)

    return NextResponse.json({
      metrics: {
        totalTutors: tutorsResult.count ?? 0,
        pendingApproval: pendingTutorsResult.count ?? 0,
        totalFamilies: familiesResult.count ?? 0,
        activeBookings: activeBookingsResult.count ?? 0,
        revenueThisMonth,
        serviceFeesThisMonth: (revenueResult.data || []).reduce((sum, payment) => sum + Number(payment.service_fee || 0), 0),
        commissionsThisMonth: (commissionsResult.data || []).reduce((sum, payout) => sum + Number(payout.commission_deducted || 0), 0),
        lessonsThisMonth: lessonsThisMonthResult.count ?? 0,
      },
      recentBookings: bookings.map((booking) => {
        const attempts = recentPayments.data.filter((payment) => payment.booking_id === booking.id)
        const paid = attempts.filter((payment) => payment.status === 'completed')
        return {
          ...booking,
          tutor_name: tutorNames[booking.tutor_id] || 'Tutor',
          payment_status: paid.length ? 'Paid' : attempts.length ? 'No verified payment' : 'No payment started',
          amount_received: paid.reduce((total, payment) => total + Number(payment.total), 0),
        }
      }),
    })
  } catch (error) {
    console.error('admin overview failed', error)
    return NextResponse.json({ error: 'Could not load admin overview.' }, { status: 500 })
  }
}
