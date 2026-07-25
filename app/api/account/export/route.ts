import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    if (userError) throw userError

    const supabase = createAdminClient()
    const [
      familyProfile,
      tutorProfile,
      familyBookings,
      tutorBookings,
      familyLessons,
      payments,
      reviews,
      reports,
    ] = await Promise.all([
      supabase.from('family_profiles').select('*').eq('user_id', user.id),
      supabase.from('tutor_profiles').select('*').eq('user_id', user.id),
      supabase.from('bookings').select('*').eq('family_id', user.id),
      supabase.from('tutor_profiles').select('id').eq('user_id', user.id).maybeSingle<{ id: string }>(),
      supabase.from('lessons').select('*').eq('family_id', user.id),
      supabase.from('payments').select('*').eq('family_id', user.id),
      supabase.from('reviews').select('*').eq('family_id', user.id),
      supabase.from('reports').select('*').eq('reporter_id', user.id),
    ])

    if (familyProfile.error) throw familyProfile.error
    if (tutorProfile.error) throw tutorProfile.error
    if (familyBookings.error) throw familyBookings.error
    if (tutorBookings.error) throw tutorBookings.error
    if (familyLessons.error) throw familyLessons.error
    if (payments.error) throw payments.error
    if (reviews.error) throw reviews.error
    if (reports.error) throw reports.error

    const tutorId = tutorBookings.data?.id || ''
    const [bookingsAsTutor, lessonsAsTutor, payouts] = tutorId
      ? await Promise.all([
          supabase.from('bookings').select('*').eq('tutor_id', tutorId),
          supabase.from('lessons').select('*').eq('tutor_id', tutorId),
          supabase.from('payouts').select('*').eq('tutor_id', tutorId),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]

    if (bookingsAsTutor.error) throw bookingsAsTutor.error
    if (lessonsAsTutor.error) throw lessonsAsTutor.error
    if (payouts.error) throw payouts.error

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        metadata: user.user_metadata,
      },
      familyProfile: familyProfile.data,
      tutorProfile: tutorProfile.data,
      bookingsAsFamily: familyBookings.data,
      bookingsAsTutor: bookingsAsTutor.data,
      lessonsAsFamily: familyLessons.data,
      lessonsAsTutor: lessonsAsTutor.data,
      payments: payments.data,
      payouts: payouts.data,
      reviews: reviews.data,
      reports: reports.data,
    })
  } catch (error) {
    console.error('account export failed', error)
    return NextResponse.json({ error: 'Could not export account data.' }, { status: 500 })
  }
}
