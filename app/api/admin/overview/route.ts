import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

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
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
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
      recentBookingsResult,
    ] = await Promise.all([
      supabase.from('tutor_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('tutor_profiles').select('id', { count: 'exact', head: true }).eq('is_approved', false),
      supabase.from('family_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', monthStart),
      supabase.from('payments').select('total').eq('status', 'completed').gte('paid_at', monthStart),
      supabase.from('bookings').select('id,family_name,tutor_id,status,grand_total,created_at').order('created_at', { ascending: false }).limit(10),
    ])

    const errors = [
      tutorsResult.error,
      pendingTutorsResult.error,
      familiesResult.error,
      activeBookingsResult.error,
      lessonsThisMonthResult.error,
      revenueResult.error,
      recentBookingsResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      throw errors[0]
    }

    const bookings = (recentBookingsResult.data ?? []) as BookingRow[]
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
        lessonsThisMonth: lessonsThisMonthResult.count ?? 0,
      },
      recentBookings: bookings.map((booking) => ({
        ...booking,
        tutor_name: tutorNames[booking.tutor_id] || 'Tutor',
      })),
    })
  } catch (error) {
    console.error('admin overview failed', error)
    return NextResponse.json({ error: 'Could not load admin overview.' }, { status: 500 })
  }
}
