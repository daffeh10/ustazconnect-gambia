'use client'

import { useEffect, useState } from 'react'

interface Metrics {
  totalTutors: number
  pendingApproval: number
  totalFamilies: number
  activeBookings: number
  revenueThisMonth: number
  lessonsThisMonth: number
}

interface RecentBooking {
  id: string
  family_name: string
  tutor_name: string
  status: string | null
  grand_total: number
  created_at: string
}

function formatMoney(value: number) {
  return `D${value.toLocaleString()}`
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadOverview() {
      try {
        const response = await fetch('/api/admin/overview')
        const payload = (await response.json()) as {
          metrics?: Metrics
          recentBookings?: RecentBooking[]
          error?: string
        }

        if (!response.ok || !payload.metrics) {
          throw new Error(payload.error || 'Could not load admin overview.')
        }

        if (!isMounted) return
        setMetrics(payload.metrics)
        setRecentBookings(payload.recentBookings || [])
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load admin overview.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      isMounted = false
    }
  }, [])

  const metricCards = [
    { label: 'Total Tutors', value: metrics?.totalTutors ?? 0 },
    { label: 'Pending Approval', value: metrics?.pendingApproval ?? 0 },
    { label: 'Total Families', value: metrics?.totalFamilies ?? 0 },
    { label: 'Active Bookings', value: metrics?.activeBookings ?? 0 },
    { label: 'Revenue This Month', value: formatMoney(metrics?.revenueThisMonth ?? 0) },
    { label: 'Lessons This Month', value: metrics?.lessonsThisMonth ?? 0 },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-600 mt-2">Monitor platform activity and review the most recent bookings.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((card) => (
          <article key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '—' : card.value}</p>
          </article>
        ))}
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900">Recent Bookings</h2>
        <p className="text-sm text-gray-600 mt-1">Last 10 bookings across the platform.</p>

        {isLoading ? (
          <p className="mt-6 text-gray-500">Loading bookings...</p>
        ) : recentBookings.length === 0 ? (
          <p className="mt-6 text-gray-500">No recent bookings yet.</p>
        ) : (
          <div className="overflow-x-auto mt-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-3 pr-4 font-medium">Family</th>
                  <th className="py-3 pr-4 font-medium">Tutor</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-3 pr-4 text-gray-900">{booking.family_name}</td>
                    <td className="py-3 pr-4 text-gray-700">{booking.tutor_name}</td>
                    <td className="py-3 pr-4 capitalize text-gray-700">{booking.status || 'pending'}</td>
                    <td className="py-3 pr-4 text-gray-900">{formatMoney(booking.grand_total)}</td>
                    <td className="py-3 text-gray-700">{formatDate(booking.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
