import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

interface PayoutRow {
  id: string
  tutor_id: string
  amount: number
  lessons_count: number | null
  requested_at: string
}

interface TutorRow {
  id: string
  name: string | null
  phone: string | null
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data: payouts, error: payoutsError } = await supabase
      .from('payouts')
      .select('id,tutor_id,amount,lessons_count,requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })

    if (payoutsError) throw payoutsError

    const rows = (payouts ?? []) as PayoutRow[]
    const tutorIds = Array.from(new Set(rows.map((payout) => payout.tutor_id)))
    let tutorMap: Record<string, { name: string; phone: string }> = {}

    if (tutorIds.length > 0) {
      const { data: tutors, error: tutorsError } = await supabase
        .from('tutor_profiles')
        .select('id,name,phone')
        .in('id', tutorIds)

      if (tutorsError) throw tutorsError

      tutorMap = ((tutors ?? []) as TutorRow[]).reduce<Record<string, { name: string; phone: string }>>(
        (acc, tutor) => {
          acc[tutor.id] = {
            name: tutor.name?.trim() || 'Tutor',
            phone: tutor.phone?.trim() || 'No phone',
          }
          return acc
        },
        {}
      )
    }

    return NextResponse.json({
      payouts: rows.map((payout) => ({
        ...payout,
        tutor_name: tutorMap[payout.tutor_id]?.name || 'Tutor',
        tutor_phone: tutorMap[payout.tutor_id]?.phone || 'No phone',
      })),
    })
  } catch (error) {
    console.error('admin payouts fetch failed', error)
    return NextResponse.json({ error: 'Could not load payout requests.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const payoutId = typeof body?.payoutId === 'string' ? body.payoutId.trim() : ''
    const waveReference = typeof body?.waveReference === 'string' ? body.waveReference.trim() : ''

    if (!payoutId || !waveReference) {
      return NextResponse.json({ error: 'Wave reference is required.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('payouts')
      .update({
        status: 'completed',
        wave_reference: waveReference,
        completed_at: new Date().toISOString(),
      })
      .eq('id', payoutId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin payout update failed', error)
    return NextResponse.json({ error: 'Could not mark payout as paid.' }, { status: 500 })
  }
}
