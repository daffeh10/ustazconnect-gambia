import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface TutorRow {
  id: string
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

async function getTutorIdForSession() {
  const authSupabase = await createServerClient()
  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser()

  if (!user) return { tutorId: '', error: 'Please sign in first.' }
  if (userError) throw userError

  const supabase = createAdminClient()
  const { data: tutor, error } = await supabase
    .from('tutor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle<TutorRow>()

  if (error) throw error
  if (!tutor) return { tutorId: '', error: 'Tutor profile not found.' }

  return { tutorId: tutor.id, error: '' }
}

export async function GET() {
  try {
    const { tutorId, error } = await getTutorIdForSession()
    if (error) return NextResponse.json({ error }, { status: tutorId ? 400 : 401 })

    const supabase = createAdminClient()
    const { data, error: fetchError } = await supabase
      .from('quran_verifications')
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError
    return NextResponse.json({ verification: data || null })
  } catch (error) {
    console.error('quran verification fetch failed', error)
    return NextResponse.json({ error: 'Quran verification is not available until the SQL is applied.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const { tutorId, error } = await getTutorIdForSession()
    if (error) return NextResponse.json({ error }, { status: tutorId ? 400 : 401 })

    const body = await request.json()
    const recitationVideoUrl = getString(body?.recitationVideoUrl)
    const tajweedAssessment = getString(body?.tajweedAssessment)
    const credentialSummary = getString(body?.credentialSummary)
    const scholarReference = getString(body?.scholarReference)

    if (!recitationVideoUrl || !tajweedAssessment || !credentialSummary || !scholarReference) {
      return NextResponse.json({ error: 'All Quran verification fields are required.' }, { status: 400 })
    }
    if (!isHttpsUrl(recitationVideoUrl)) {
      return NextResponse.json({ error: 'Use a valid HTTPS recitation video link.' }, { status: 400 })
    }
    if (
      recitationVideoUrl.length > 1000 ||
      tajweedAssessment.length > 4000 ||
      credentialSummary.length > 4000 ||
      scholarReference.length > 1000
    ) {
      return NextResponse.json({ error: 'One or more verification fields are too long.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: existing, error: existingError } = await supabase
      .from('quran_verifications')
      .select('id,status')
      .eq('tutor_id', tutorId)
      .in('status', ['pending', 'approved'])
      .limit(1)
      .maybeSingle<{ id: string; status: string }>()

    if (existingError) throw existingError
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.status === 'approved'
              ? 'Your Quran verification is already approved.'
              : 'Your Quran verification is already awaiting review.',
        },
        { status: 409 }
      )
    }

    const { error: insertError } = await supabase.from('quran_verifications').insert({
      tutor_id: tutorId,
      recitation_video_url: recitationVideoUrl,
      tajweed_assessment: tajweedAssessment,
      credential_summary: credentialSummary,
      scholar_reference: scholarReference,
      status: 'pending',
    })

    if (insertError) throw insertError
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('quran verification submit failed', error)
    return NextResponse.json({ error: 'Could not submit Quran verification yet.' }, { status: 500 })
  }
}
