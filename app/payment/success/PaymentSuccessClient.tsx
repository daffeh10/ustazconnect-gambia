'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ConfirmationState = 'checking' | 'success' | 'pending' | 'failed'

export default function PaymentSuccessClient() {
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>('checking')
  const [error, setError] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function checkPaymentStatus() {
      const bookingId = searchParams.get('bookingId') || ''

      if (!bookingId) {
        if (isMounted) {
          setError('Missing booking details for payment confirmation.')
          setConfirmationState('failed')
        }
        return
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) throw new Error('You must be signed in to view this payment confirmation.')

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const confirmResponse = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, familyId: user.id }),
          })

          const confirmPayload = (await confirmResponse.json()) as {
            status?: string
            error?: string
          }

          if (!confirmResponse.ok) {
            throw new Error(confirmPayload.error || 'Could not confirm payment status.')
          }

          if (confirmPayload.status === 'completed') {
            if (isMounted) {
              setConfirmationState('success')
            }
            return
          }

          if (confirmPayload.status === 'failed' || confirmPayload.status === 'cancelled') {
            if (isMounted) {
              setError('Your payment was not completed. Please try again.')
              setConfirmationState('failed')
            }
            return
          }

          const { data: paymentRow, error: paymentLoadError } = await supabase
            .from('payments')
            .select('status')
            .eq('booking_id', bookingId)
            .eq('family_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle<{ status: string | null }>()

          if (paymentLoadError) throw paymentLoadError

          const { data: bookingRow, error: bookingLoadError } = await supabase
            .from('bookings')
            .select('status')
            .eq('id', bookingId)
            .eq('family_id', user.id)
            .maybeSingle<{ status: string | null }>()

          if (bookingLoadError) throw bookingLoadError

          if (paymentRow?.status === 'completed' && bookingRow?.status === 'active') {
            if (isMounted) {
              setConfirmationState('success')
            }
            return
          }

          if (paymentRow?.status === 'failed' || paymentRow?.status === 'cancelled') {
            if (isMounted) {
              setError('Your payment was not completed. Please try again.')
              setConfirmationState('failed')
            }
            return
          }

          await new Promise((resolve) => setTimeout(resolve, 1500))
        }

        if (isMounted) {
          setError('Your payment is still being confirmed. Please check your family dashboard in a moment.')
          setConfirmationState('pending')
        }
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not confirm your payment.')
          setConfirmationState('failed')
        }
      }
    }

    void checkPaymentStatus()

    return () => {
      isMounted = false
    }
  }, [searchParams, supabase])

  async function handleRetryConfirmation() {
    setIsRetrying(true)
    setConfirmationState('checking')
    setError('')

    try {
      const bookingId = searchParams.get('bookingId') || ''
      if (!bookingId) {
        throw new Error('Missing booking details for payment confirmation.')
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('You must be signed in to confirm this payment.')

      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, familyId: user.id }),
      })

      const payload = (await response.json()) as { status?: string; error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Could not confirm payment status.')
      }

      if (payload.status === 'completed') {
        setConfirmationState('success')
        return
      }

      if (payload.status === 'failed' || payload.status === 'cancelled') {
        setError('Your payment was not completed. Please try again from your family dashboard.')
        setConfirmationState('failed')
        return
      }

      setError('Your payment is still being confirmed. Please check your family dashboard in a moment.')
      setConfirmationState('pending')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not confirm your payment.')
      setConfirmationState('failed')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
        {confirmationState === 'checking' ? (
          <>
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Confirming payment...</h1>
            <p className="text-gray-600 mt-2">Please wait while ModemPay and TutorConnect confirm your booking.</p>
          </>
        ) : confirmationState === 'failed' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-2xl mx-auto mb-4">
              !
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment confirmation failed</h1>
            <p className="text-gray-600 mt-2">{error}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/family/dashboard"
                className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                Back to dashboard
              </Link>
              <button
                type="button"
                onClick={handleRetryConfirmation}
                disabled={isRetrying}
                className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? 'Checking again...' : 'Check again now'}
              </button>
            </div>
          </>
        ) : confirmationState === 'pending' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mx-auto mb-4">
              …
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment still processing</h1>
            <p className="text-gray-600 mt-2">{error}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetryConfirmation}
                disabled={isRetrying}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? 'Checking again...' : 'Check again now'}
              </button>
              <Link
                href="/family/dashboard"
                className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Go to dashboard
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mx-auto mb-4">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Payment confirmed!</h1>
            <p className="text-gray-600 mt-2">Your booking is now active and your lesson plan is ready.</p>
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
