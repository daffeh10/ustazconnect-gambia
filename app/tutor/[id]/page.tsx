import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import UstazProfileClient from './UstazProfileClient'
import { createClient } from '@/lib/supabase/server'
import { isTutorPubliclyVisible } from '@/lib/tutor-review'
import { normalizeTutorSubjects } from '@/lib/tutor-subjects'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'

interface TutorMetadataRow {
  id: string
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  verification_status: string | null
  created_at: string | null
  is_test_account: boolean | null
}

interface TutorLookup {
  tutor: TutorMetadataRow | null
  // Distinguishes "this tutor is hidden" from "the lookup itself failed", so a
  // transient database error never 404s a real tutor's profile.
  lookupFailed: boolean
}

// cache() dedupes this across generateMetadata and the page render, which Next
// runs as two passes over the same request.
const loadPublicTutor = cache(async (id: string): Promise<TutorLookup> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('public_tutors')
      .select('id,name,location,subjects,hourly_rate,bio,verification_status,created_at,is_test_account')
      .eq('id', id)
      .maybeSingle<TutorMetadataRow>()

    if (error) throw error
    return { tutor: data, lookupFailed: false }
  } catch (error) {
    console.error('tutor profile lookup failed', error)
    return { tutor: null, lookupFailed: true }
  }
})

function isVisible(tutor: TutorMetadataRow | null) {
  return Boolean(
    tutor &&
      isTutorPubliclyVisible({
        isTestAccount: tutor.is_test_account,
        verificationStatus: tutor.verification_status,
        createdAt: tutor.created_at,
      })
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { tutor } = await loadPublicTutor(id)

  if (!tutor || !isVisible(tutor)) {
    return {
      title: 'Tutor Profile | TutorConnect Gambia',
      description: 'Browse tutor profiles across The Gambia on TutorConnect Gambia.',
    }
  }

  const location = tutor.location?.trim() || 'The Gambia'
  const subjects = normalizeTutorSubjects(tutor.subjects).slice(0, 3).join(', ')
  const subjectText = subjects || 'multiple subjects'
  const hourlyRate =
    typeof tutor.hourly_rate === 'number' && Number.isFinite(tutor.hourly_rate)
      ? `GMD ${tutor.hourly_rate.toLocaleString()}/hour`
      : 'Competitive rates'

  return {
    title: `${tutor.name} — ${location} Tutor | TutorConnect Gambia`,
    description:
      tutor.bio?.trim() ||
      `${tutor.name} teaches ${subjectText} in ${location}. ${hourlyRate}. In-home lessons.`,
    openGraph: {
      title: `${tutor.name} | TutorConnect Gambia`,
      description:
        tutor.bio?.trim() || `Tutor profile in ${location}, The Gambia`,
    },
  }
}

export default async function UstazProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ lessonFormat?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const { tutor, lookupFailed } = await loadPublicTutor(id)

  // Fail open on a lookup error: the client component repeats this check, so a
  // blip shows its error state rather than a hard 404 on a real profile.
  if (!lookupFailed && !isVisible(tutor)) {
    notFound()
  }

  return (
    <UstazProfileClient
      id={id}
      defaultLessonFormat={
        DIASPORA_QURAN_ENABLED && query.lessonFormat === 'online'
          ? 'online'
          : 'in_person'
      }
    />
  )
}
