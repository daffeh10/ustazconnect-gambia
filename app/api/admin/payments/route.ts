import { readAllRows } from '@/lib/database-pages'
import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminRole } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { summarizeBookingPayments, type AdminBooking } from '@/lib/admin-payments'
import { reconcilePayment, type PaymentRecord } from '@/lib/payment-reconciliation'
import { writeAdminAuditLog } from '@/lib/admin-audit'

export async function GET(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const page = Math.max(1, Math.min(100_000, Number.parseInt(params.get('page') || '1', 10) || 1))
    const search = (params.get('search') || '').trim().slice(0, 120)
    const db = createAdminClient()
    let query = db.from('bookings').select('id,family_name,tutor_id,status,grand_total,monthly_total,service_fee,booking_type,created_at,payment_reminder_sent_at', { count: 'exact' })
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)) query = query.eq('id', search)
    else if (search) query = query.ilike('family_name', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1)
    if (error) throw error
    const bookings = (data || []) as AdminBooking[]
    if (!bookings.length) return NextResponse.json({ bookings: [], total: count || 0, page })
    const [paymentsResult, tutorsResult] = await Promise.all([
      readAllRows((start, end) => db.from('payments').select('*').in('booking_id', bookings.map((booking) => booking.id)).order('created_at', { ascending: false }).order('id').range(start, end)),
      db.from('tutor_profiles').select('id,name').in('id', [...new Set(bookings.map((booking) => booking.tutor_id))]),
    ])
    if (paymentsResult.error) throw paymentsResult.error
    if (tutorsResult.error) throw tutorsResult.error
    const tutors = new Map((tutorsResult.data || []).map((tutor) => [tutor.id, tutor.name]))
    const payments = (paymentsResult.data || []) as PaymentRecord[]
    return NextResponse.json({ page, total: count || 0, bookings: bookings.map((booking) => ({
      ...booking, tutor_name: tutors.get(booking.tutor_id) || 'Tutor',
      ...summarizeBookingPayments(booking, payments.filter((payment) => payment.booking_id === booking.id)),
    })) })
  } catch (error) {
    console.error('Admin payments load failed', error)
    return NextResponse.json({ error: 'Could not load payments. Check that the payment recovery migration has been applied.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin || !hasAdminRole(admin, ['owner', 'admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body: { paymentId?: unknown } = await request.json()
    if (typeof body.paymentId !== 'string') return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 })
    const db = createAdminClient()
    const { data: payment, error } = await db.from('payments').select('*').eq('id', body.paymentId).maybeSingle<PaymentRecord>()
    if (error) throw error
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    const checked = await reconcilePayment(db, payment)
    await writeAdminAuditLog({ admin, action: 'payment.reconciled', targetType: 'payment', targetId: payment.id, metadata: { status: checked.status } })
    return NextResponse.json({ status: checked.status, message: checked.verification_error || (checked.status === 'completed' ? 'Payment recorded and booking activation checked.' : `Waychit checked. Payment status: ${checked.status}.`) })
  } catch (error) {
    console.error('Admin payment reconciliation failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not verify this payment.' }, { status: 502 })
  }
}
