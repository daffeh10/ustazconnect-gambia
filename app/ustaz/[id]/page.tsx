import type { Metadata } from 'next'
import UstazProfileClient from './UstazProfileClient'
import { createAdminClient } from '@/lib/supabase/admin'

interface TutorMetadataRow {
  id: string
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: tutor } = await supabase
    .from('tutor_profiles')
    .select('id,name,location,subjects,hourly_rate,bio')
    .eq('id', id)
    .maybeSingle<TutorMetadataRow>()

  if (!tutor) {
    return {
      title: 'Tutor Profile | TutorConnect Gambia',
      description: 'Browse verified tutors across The Gambia on TutorConnect Gambia.',
    }
  }

  const location = tutor.location?.trim() || 'The Gambia'
  const subjects = (tutor.subjects ?? []).slice(0, 3).join(', ')
  const subjectText = subjects || 'multiple subjects'
  const hourlyRate =
    typeof tutor.hourly_rate === 'number' && Number.isFinite(tutor.hourly_rate)
      ? `D${tutor.hourly_rate}/hour`
      : 'Competitive rates'

  return {
    title: `${tutor.name} — ${location} Tutor | TutorConnect Gambia`,
    description:
      tutor.bio?.trim() ||
      `${tutor.name} teaches ${subjectText} in ${location}. ${hourlyRate}. In-home lessons.`,
    openGraph: {
      title: `${tutor.name} | TutorConnect Gambia`,
      description:
        tutor.bio?.trim() || `Qualified tutor in ${location}, The Gambia`,
    },
  }
}

export default async function UstazProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <UstazProfileClient id={id} />
}
