import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorconnect.gm').replace(/\/$/, '')
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
      url: `${baseUrl}/find-ustaz`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Keep deploys from failing if admin-only env vars are missing in a new environment.
  if (!supabaseUrl || !serviceRoleKey) {
    return staticRoutes
  }

  try {
    const supabase = createAdminClient()
    const { data: tutors } = await supabase
      .from('tutor_profiles')
      .select('id')
      .eq('is_approved', true)

    const tutorRoutes: MetadataRoute.Sitemap = (tutors ?? []).map((tutor) => ({
      url: `${baseUrl}/ustaz/${tutor.id}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    return [...staticRoutes, ...tutorRoutes]
  } catch {
    return staticRoutes
  }
}
