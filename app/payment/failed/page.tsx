import Link from 'next/link'

interface PaymentFailedPageProps {
  searchParams?: Promise<{
    bookingId?: string
  }>
}

export default async function PaymentFailedPage({ searchParams }: PaymentFailedPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const bookingId = typeof resolvedSearchParams.bookingId === 'string' ? resolvedSearchParams.bookingId : ''
  const retryHref = bookingId ? `/payment/${bookingId}` : '/family/dashboard'

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-2xl mx-auto mb-4">
          !
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Payment failed</h1>
        <p className="text-gray-600 mt-2">
          We could not confirm your payment. Please try again or contact support if the problem continues.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={retryHref}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-3 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Try again
          </Link>
          <Link
            href="/family/dashboard"
            className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
