import { computeBookingAllocation } from '@/lib/pricing'
import type { PaymentRecord } from '@/lib/payment-reconciliation'

export interface AdminBooking {
  id: string
  family_name: string
  tutor_id: string
  status: string | null
  grand_total: number
  monthly_total: number
  service_fee: number
  booking_type: string | null
  created_at: string
  payment_reminder_sent_at: string | null
}

export function summarizeBookingPayments(booking: AdminBooking, payments: PaymentRecord[]) {
  const completed = payments.filter((payment) => payment.status === 'completed')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const paid = completed[0]
  const lessonAmount = Number(paid?.amount ?? booking.monthly_total)
  const serviceFee = Number(paid?.service_fee ?? booking.service_fee)
  const allocation = computeBookingAllocation(lessonAmount, serviceFee, booking.booking_type === 'trial')
  const amountReceived = completed.reduce((total, payment) => total + Number(payment.total), 0)
  return {
    amountReceived,
    serviceFee,
    lessonAmount,
    ...allocation,
    allocationBasis: paid ? 'paid' as const : 'expected' as const,
    paymentLabel: paid ? 'Paid' : payments.length === 0 ? 'No payment started'
      : payments.some((payment) => payment.verification_error) ? 'Needs review'
      : payments.some((payment) => payment.status === 'pending') ? 'Awaiting payment verification'
      : 'Not paid — previous checkout ended',
    duplicatePayment: completed.length > 1,
    needsReview: completed.length > 1 || payments.some((payment) => Boolean(payment.verification_error))
      || (Boolean(paid) && !['active', 'completed'].includes(booking.status || ''))
      || (!paid && booking.status === 'active'),
    // Never send the internal client reference or the hosted checkout URL to
    // the admin browser; provider/transaction IDs are sufficient for tracing.
    attempts: payments.map((payment) => ({
      id: payment.id, status: payment.status, total: payment.total,
      providerId: payment.provider_payment_id, transactionReference: payment.wave_reference,
      providerStatus: payment.provider_status, createdAt: payment.created_at, paidAt: payment.paid_at,
      lastCheckedAt: payment.last_checked_at, error: payment.verification_error,
    })),
  }
}

export type AdminPaymentBooking = AdminBooking & ReturnType<typeof summarizeBookingPayments> & { tutor_name: string }
