'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PaymentSuccessClient() {
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function finalizePayment() {
      const bookingId = searchParams.get('bookingId') || ''
      const ref = searchParams.get('ref') || ''

      if (!bookingId || !ref) {
        if (isMounted) {
          setError('Missing payment confirmation details.')
          setIsLoading(false)
        }
        return
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) throw new Error('You must be signed in to confirm this payment.')

        const { data: paymentRow, error: paymentLoadError } = await supabase
          .from('payments')
          .select('id,status')
          .eq('booking_id', bookingId)
          .eq('family_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string; status: string | null }>()

        if (paymentLoadError) throw paymentLoadError
        if (!paymentRow) throw new Error('Payment record not found.')

        if (paymentRow.status !== 'completed') {
          const { error: paymentUpdateError } = await supabase
            .from('payments')
            .update({
              status: 'completed',
              wave_reference: ref,
              paid_at: new Date().toISOString(),
            })
            .eq('id', paymentRow.id)

          if (paymentUpdateError) throw paymentUpdateError
        }

        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', bookingId)
          .eq('family_id', user.id)

        if (bookingUpdateError) throw bookingUpdateError
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not confirm your payment.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void finalizePayment()

    return () => {
      isMounted = false
    }
  }, [searchParams, supabase])

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
        {isLoading ? (
          <>
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Confirming payment...</h1>
            <p className="text-gray-600 mt-2">Please wait while we update your booking.</p>
          </>
        ) : error ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-2xl mx-auto mb-4">
              !
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment confirmation failed</h1>
            <p className="text-gray-600 mt-2">{error}</p>
            <Link
              href="/family/dashboard"
              className="inline-flex mt-6 items-center rounded-lg bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Back to dashboard
            </Link>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mx-auto mb-4">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment confirmed!</h1>
            <p className="text-gray-600 mt-2">Your tutor has been notified.</p>
            <Link
              href="/family/dashboard"
              className="inline-flex mt-6 items-center rounded-lg bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Go to my dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
