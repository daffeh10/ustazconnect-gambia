import type { Metadata } from 'next'
import UstazProfileClient from './UstazProfileClient'
import { createClient } from '@/lib/supabase/server'
import { isTutorPubliclyVisible } from '@/lib/tutor-review'
import { normalizeTutorSubjects } from '@/lib/tutor-subjects'

interface TutorMetadataRow {
  id: string
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  verification_status: string | null
  created_at: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()

  const { data: tutor } = await supabase
    .from('public_tutors')
    .select('id,name,location,subjects,hourly_rate,bio,verification_status,created_at')
    .eq('id', id)
    .maybeSingle<TutorMetadataRow>()

  if (
    !tutor ||
    !isTutorPubliclyVisible({
      verificationStatus: tutor.verification_status,
      createdAt: tutor.created_at,
    })
  ) {
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
  return <UstazProfileClient id={id} defaultLessonFormat={query.lessonFormat === 'online' ? 'online' : 'in_person'} />
}
