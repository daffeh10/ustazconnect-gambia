function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function getSiteUrl(request?: Request) {
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (envSiteUrl) {
    return trimTrailingSlash(envSiteUrl)
  }

  if (request) {
    return trimTrailingSlash(new URL(request.url).origin)
  }

  throw new Error('Missing NEXT_PUBLIC_SITE_URL. Add it before testing real payments.')
}

export function getWaychitApiKey() {
  const key = process.env.WAYCHIT_API_KEY?.trim()

  if (!key) {
    throw new Error('Missing WAYCHIT_API_KEY. Add it before testing real payments.')
  }

  return key
}

export function getWaychitWebhookSecret() {
  const secret = process.env.WAYCHIT_WEBHOOK_SECRET?.trim()

  if (!secret) {
    throw new Error('Missing WAYCHIT_WEBHOOK_SECRET. Add it before testing real payments.')
  }

  return secret
}

export function getWaychitApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `https://api.waychit.com/v1${normalizedPath}`
}
