'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ChartPoint {
  label: string
  value: number
}

interface AnalyticsPayload {
  tutorSignups: ChartPoint[]
  familySignups: ChartPoint[]
  lessonsCompleted: ChartPoint[]
  revenue: ChartPoint[]
  topSubjects: ChartPoint[]
  topLocations: ChartPoint[]
  funnel: ChartPoint[]
  searchDemand: ChartPoint[]
  error?: string
}

function SkeletonCard() {
  return <div className="h-72 animate-pulse rounded-lg bg-gray-200" />
}

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      <div className="h-72">{children}</div>
    </section>
  )
}

function EmptyChartState({ error }: { error: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      {error}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadAnalytics() {
      try {
        const response = await fetch('/api/admin/analytics')
        const payload = (await response.json()) as AnalyticsPayload

        if (!response.ok) {
          throw new Error(payload.error || 'Could not load data')
        }

        if (!isMounted) return
        setData(payload)
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setError('Could not load data')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [])

  const noDataMessage = error || 'No activity recorded yet.'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-2 text-gray-600">
          Review signups, marketplace activity, lesson completion, revenue, and tutor distribution trends.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ChartCard title="New Tutors Per Week">
            {!data ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tutorSignups}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="New Families Per Week">
            {!data ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.familySignups}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Lessons Completed Per Week">
            {!data ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.lessonsCompleted}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Revenue Per Week (GMD)">
            {!data ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => `GMD ${Number(value).toLocaleString()}`} />
                  <Line type="monotone" dataKey="value" stroke="#d97706" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top 5 Subjects">
            {!data ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topSubjects} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#059669" name="Tutors" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top 5 Locations">
            {!data ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topLocations} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#0284c7" name="Tutors" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Marketplace Funnel (Last 30 Days)">
            {!data || data.funnel.every((point) => point.value === 0) ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.funnel} layout="vertical" margin={{ left: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={150}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#059669" name="Events" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Most Searched Subjects (Last 30 Days)">
            {!data || data.searchDemand.length === 0 ? (
              <EmptyChartState error={noDataMessage} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.searchDemand} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={130}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0284c7" name="Searches" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  )
}
