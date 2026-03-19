import type { MetadataRoute } from 'next'

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorconnect.gm').replace(/\/$/, '')
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard', '/family/', '/payment/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
