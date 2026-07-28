import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import { toSeoSlug } from '@/lib/seo-slugs'
import { isTutorPubliclyVisible } from '@/lib/tutor-review'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorconnectgambia.com').replace(/\/$/, '')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/find-tutor`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/how-it-works`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...(DIASPORA_QURAN_ENABLED
      ? [
          {
            url: `${baseUrl}/online-quran`,
            changeFrequency: 'weekly' as const,
            priority: 0.9,
          },
        ]
      : []),
    {
      url: `${baseUrl}/register`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
  const prioritySubjects = ALL_SUBJECTS.filter((subject) =>
    ['Quran', 'Math', 'English', 'WASSCE', 'Physics', 'Arabic'].some((term) =>
      subject.toLowerCase().includes(term.toLowerCase())
    )
  )
  const seoRoutes: MetadataRoute.Sitemap = ALL_LOCATIONS.slice(0, 30).flatMap((location) =>
    prioritySubjects.map((subject) => ({
      url: `${baseUrl}/tutors/${toSeoSlug(location)}/${toSeoSlug(subject)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    }))
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Keep deploys from failing if admin-only env vars are missing in a new environment.
  if (!supabaseUrl || !serviceRoleKey) {
    return [...staticRoutes, ...seoRoutes]
  }

  try {
    const supabase = createAdminClient()
    const { data: tutors } = await supabase
      .from('tutor_profiles')
      .select('id,verification_status,created_at')
      .eq('is_approved', true)

    const tutorRoutes: MetadataRoute.Sitemap = (tutors ?? [])
      .filter((tutor) =>
        isTutorPubliclyVisible({
          verificationStatus: tutor.verification_status,
          createdAt: tutor.created_at,
        })
      )
      .map((tutor) => ({
        url: `${baseUrl}/tutor/${tutor.id}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      }))

    return [...staticRoutes, ...seoRoutes, ...tutorRoutes]
  } catch {
    return [...staticRoutes, ...seoRoutes]
  }
}
