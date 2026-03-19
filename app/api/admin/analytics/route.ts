import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

interface TutorAnalyticsRow {
  created_at: string | null
  subjects: string[] | null
  location: string | null
}

interface FamilyAnalyticsRow {
  created_at: string | null
}

interface LessonAnalyticsRow {
  completed_at: string | null
}

interface PaymentAnalyticsRow {
  paid_at: string | null
  total: number | string | null
}

interface ChartPoint {
  label: string
  value: number
}

function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function buildWeeklySeries() {
  const currentWeekStart = startOfWeek(new Date())
  return Array.from({ length: 8 }, (_, index) => {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(currentWeekStart.getDate() - (7 - index) * 7)
    const label = weekStart.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })

    return {
      key: weekStart.toISOString().slice(0, 10),
      date: weekStart,
      label,
      value: 0,
    }
  })
}

function bucketWeeklyDates(rows: Array<string | null | undefined>) {
  const weeks = buildWeeklySeries()
  const weekMap = new Map(weeks.map((week) => [week.key, week]))

  for (const value of rows) {
    if (!value) continue
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) continue
    const bucketKey = startOfWeek(date).toISOString().slice(0, 10)
    const bucket = weekMap.get(bucketKey)
    if (bucket) {
      bucket.value += 1
    }
  }

  return weeks.map(({ label, value }) => ({ label, value }))
}

function bucketWeeklyRevenue(rows: PaymentAnalyticsRow[]) {
  const weeks = buildWeeklySeries()
  const weekMap = new Map(weeks.map((week) => [week.key, week]))

  for (const row of rows) {
    if (!row.paid_at) continue
    const date = new Date(row.paid_at)
    if (Number.isNaN(date.getTime())) continue
    const bucketKey = startOfWeek(date).toISOString().slice(0, 10)
    const bucket = weekMap.get(bucketKey)
    if (!bucket) continue

    const total = typeof row.total === 'number' ? row.total : Number(row.total) || 0
    bucket.value += total
  }

  return weeks.map(({ label, value }) => ({ label, value }))
}

function topCounts(entries: string[], limit = 5): ChartPoint[] {
  const counts = entries.reduce<Map<string, number>>((acc, entry) => {
    const key = entry.trim()
    if (!key) return acc
    acc.set(key, (acc.get(key) ?? 0) + 1)
    return acc
  }, new Map())

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }))
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const [tutorsResult, familiesResult, lessonsResult, paymentsResult] = await Promise.all([
      supabase.from('tutor_profiles').select('created_at,subjects,location'),
      supabase.from('family_profiles').select('created_at'),
      supabase.from('lessons').select('completed_at').eq('status', 'completed'),
      supabase.from('payments').select('paid_at,total').eq('status', 'completed'),
    ])

    const errors = [
      tutorsResult.error,
      familiesResult.error,
      lessonsResult.error,
      paymentsResult.error,
    ].filter(Boolean)

    if (errors.length > 0) {
      throw errors[0]
    }

    const tutors = (tutorsResult.data ?? []) as TutorAnalyticsRow[]
    const families = (familiesResult.data ?? []) as FamilyAnalyticsRow[]
    const lessons = (lessonsResult.data ?? []) as LessonAnalyticsRow[]
    const payments = (paymentsResult.data ?? []) as PaymentAnalyticsRow[]

    const tutorSignups = bucketWeeklyDates(tutors.map((row) => row.created_at))
    const familySignups = bucketWeeklyDates(families.map((row) => row.created_at))
    const lessonsCompleted = bucketWeeklyDates(lessons.map((row) => row.completed_at))
    const revenue = bucketWeeklyRevenue(payments)

    const topSubjects = topCounts(
      tutors.flatMap((row) => row.subjects ?? []).filter(Boolean),
      5
    )
    const topLocations = topCounts(
      tutors.map((row) => row.location ?? '').filter(Boolean),
      5
    )

    return NextResponse.json({
      tutorSignups,
      familySignups,
      lessonsCompleted,
      revenue,
      topSubjects,
      topLocations,
    })
  } catch (error) {
    console.error('admin analytics failed', error)
    return NextResponse.json({ error: 'Could not load data.' }, { status: 500 })
  }
}
