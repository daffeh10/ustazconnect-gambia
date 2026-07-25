import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { computePayableSummary, type PayoutBookingInfo } from '@/lib/payouts'

interface BookingRow {
  id: string
  status: string | null
  hourly_rate: number | null
  booking_type?: string | null
}

interface LessonRow {
  booking_id: string
  duration_minutes: number | null
  status: string | null
  completed_at: string | null
  created_at: string
}

interface PayoutRow {
  status: string | null
  lessons_count: number | null
}

export async function POST() {
  try {
    // Authenticate the tutor from their session.
    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (userError) throw userError
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to request a payout.' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: profile, error: profileError } = await supabase
      .from('tutor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()

    if (profileError) throw profileError
    if (!profile) {
      return NextResponse.json({ error: 'No tutor profile found for this account.' }, { status: 403 })
    }

    const tutorId = profile.id

    // Recompute the payable amount server-side from authoritative data. Never trust
    // an amount supplied by the client.
    const [bookingsResult, lessonsResult, payoutsResult] = await Promise.all([
      supabase.from('bookings').select('id,status,hourly_rate,booking_type').eq('tutor_id', tutorId),
      supabase
        .from('lessons')
        .select('booking_id,duration_minutes,status,completed_at,created_at')
        .eq('tutor_id', tutorId),
      supabase.from('payouts').select('status,lessons_count').eq('tutor_id', tutorId),
    ])

    let bookingRows = (bookingsResult.data ?? []) as BookingRow[]
    if (bookingsResult.error) {
      const message = bookingsResult.error.message.toLowerCase()
      if (message.includes('booking_type') || message.includes('column')) {
        const fallback = await supabase.from('bookings').select('id,status,hourly_rate').eq('tutor_id', tutorId)
        if (fallback.error) throw fallback.error
        bookingRows = (fallback.data ?? []) as BookingRow[]
      } else {
        throw bookingsResult.error
      }
    }
    if (lessonsResult.error) throw lessonsResult.error
    if (payoutsResult.error) throw payoutsResult.error

    const bookingsById: Record<string, PayoutBookingInfo> = {}
    for (const booking of bookingRows) {
      bookingsById[booking.id] = {
        status: booking.status,
        hourly_rate: booking.hourly_rate,
        booking_type: booking.booking_type || 'monthly',
      }
    }

    const summary = computePayableSummary({
      lessons: (lessonsResult.data ?? []) as LessonRow[],
      bookingsById,
      existingPayouts: (payoutsResult.data ?? []) as PayoutRow[],
    })

    if (summary.lessonsCount <= 0 || summary.amount <= 0) {
      return NextResponse.json(
        { error: 'No completed lessons are available for payout yet.' },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabase.from('payouts').insert({
      tutor_id: tutorId,
      amount: summary.amount,
      commission_deducted: summary.commissionDeducted,
      lessons_count: summary.lessonsCount,
      period_start: summary.periodStart,
      period_end: summary.periodEnd,
      status: 'pending',
    })

    if (insertError) throw insertError

    return NextResponse.json({
      ok: true,
      amount: summary.amount,
      lessonsCount: summary.lessonsCount,
    })
  } catch (error) {
    console.error('payout request route failed', error)
    return NextResponse.json({ error: 'Could not request payout right now.' }, { status: 500 })
  }
}
