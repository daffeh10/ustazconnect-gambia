import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface BookingRow {
  id: string
  family_id: string | null
  tutor_id: string
  hourly_rate: number
  monthly_total: number
  service_fee: number
  grand_total: number
  status: string | null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : ''

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,family_id,tutor_id,hourly_rate,monthly_total,service_fee,grand_total,status')
      .eq('id', bookingId)
      .maybeSingle<BookingRow>()

    if (bookingError) throw bookingError
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }
    if (!booking.family_id) {
      return NextResponse.json({ error: 'Booking is missing a family account.' }, { status: 400 })
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed bookings can be paid.' }, { status: 400 })
    }

    const { error: paymentInsertError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      family_id: booking.family_id,
      amount: booking.monthly_total,
      service_fee: booking.service_fee,
      total: booking.grand_total,
      payment_method: 'wave',
      status: 'pending',
    })

    if (paymentInsertError) throw paymentInsertError

    const waveApiKey = process.env.WAVE_API_KEY || ''
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin

    if (waveApiKey.startsWith('placeholder')) {
      return NextResponse.json({
        url: `${siteUrl}/payment/success?ref=SIMULATED&bookingId=${encodeURIComponent(bookingId)}`,
      })
    }

    return NextResponse.json(
      { error: 'Real Wave checkout is not configured yet. Keep the placeholder key for simulation.' },
      { status: 501 }
    )
  } catch (error) {
    console.error('create-payment route failed', error)
    return NextResponse.json({ error: 'Could not create payment session.' }, { status: 500 })
  }
}
