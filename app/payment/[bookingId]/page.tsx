'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BookingRow {
  id: string
  tutor_id: string
  family_id: string | null
  subjects: string[] | null
  hours_per_month: number
  monthly_total: number
  service_fee: number
  grand_total: number
  status: string | null
}

interface TutorRow {
  id: string
  name: string | null
}

function formatMoney(value: number) {
  return `D${value.toLocaleString()}`
}

export default function PaymentPage() {
  const params = useParams<{ bookingId: string }>()
  const bookingId = typeof params?.bookingId === 'string' ? params.bookingId : ''
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState<BookingRow | null>(null)
  const [tutorName, setTutorName] = useState('Tutor')

  useEffect(() => {
    let isMounted = true

    async function loadPaymentPage() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        if (!user) {
          router.push('/login')
          router.refresh()
          return
        }

        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select('id,tutor_id,family_id,subjects,hours_per_month,monthly_total,service_fee,grand_total,status')
          .eq('id', bookingId)
          .eq('family_id', user.id)
          .maybeSingle<BookingRow>()

        if (bookingError) throw bookingError
        if (!bookingData) {
          throw new Error('Booking not found.')
        }

        const { data: tutorData, error: tutorError } = await supabase
          .from('tutor_profiles')
          .select('id,name')
          .eq('id', bookingData.tutor_id)
          .maybeSingle<TutorRow>()

        if (tutorError) throw tutorError
        if (!isMounted) return

        setBooking(bookingData)
        setTutorName(tutorData?.name?.trim() || 'Tutor')
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError('Could not load this payment page. Please refresh and try again.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPaymentPage()

    return () => {
      isMounted = false
    }
  }, [bookingId, router, supabase])

  async function handlePayment() {
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/wave/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })

      const payload = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Could not start payment.')
      }

      window.location.href = payload.url
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not start payment.')
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-gray-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/family/dashboard" className="text-sm text-emerald-600 hover:underline">
            ← Back to dashboard
          </Link>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Payment unavailable</h1>
            <p className="text-gray-600 mt-2">{error || 'The booking could not be loaded.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const sessionsCount = Math.floor(booking.hours_per_month / 2)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/family/dashboard" className="text-sm text-emerald-600 hover:underline">
          ← Back to dashboard
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-md mx-auto mt-6">
          <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-sm text-gray-600 mt-2">
            Confirm this month&apos;s tutoring payment securely through Wave.
          </p>

          <div className="mt-6 space-y-3 text-sm text-gray-700">
            <p className="flex justify-between gap-4">
              <span>Tutor</span>
              <span className="font-medium text-right">{tutorName}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Subjects</span>
              <span className="font-medium text-right">{(booking.subjects || []).join(', ') || 'Not set'}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Sessions count</span>
              <span className="font-medium">{sessionsCount}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Subtotal</span>
              <span className="font-medium">{formatMoney(booking.monthly_total)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Service fee</span>
              <span className="font-medium">{formatMoney(booking.service_fee)}</span>
            </p>
            <p className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatMoney(booking.grand_total)}</span>
            </p>
          </div>

          {booking.status !== 'confirmed' && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              This booking is currently marked as <span className="font-medium">{booking.status || 'unknown'}</span>. Only confirmed bookings can be paid.
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handlePayment}
            disabled={isSubmitting || booking.status !== 'confirmed'}
            className="mt-6 w-full bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Starting payment...' : 'Pay with Wave'}
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            Your payment is processed securely. If something goes wrong, we can review and refund eligible issues.
          </p>
        </div>
      </div>
    </div>
  )
}
