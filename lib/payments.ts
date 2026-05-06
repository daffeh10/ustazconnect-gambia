import ModemPay from 'modem-pay'

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

export function getModemPayClient() {
  const key = process.env.MODEMPAY_SECRET_KEY?.trim()

  if (!key) {
    throw new Error('Missing MODEMPAY_SECRET_KEY. Add it before testing real payments.')
  }

  return new ModemPay(key)
}
