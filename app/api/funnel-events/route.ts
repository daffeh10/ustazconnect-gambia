import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FunnelEventName } from '@/lib/funnel'

const ALLOWED_EVENTS = new Set<FunnelEventName>([
  'marketplace_search',
  'service_selected',
  'tutor_profile_viewed',
  'booking_started',
  'booking_request_sent',
  'tutor_registration_started',
  'tutor_registration_completed',
])

const ALLOWED_PROPERTIES = new Set([
  'mode',
  'subject',
  'location',
  'tutor_id',
  'booking_type',
])

function getString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function sanitizeProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string | number | boolean>>(
    (properties, [key, propertyValue]) => {
      if (!ALLOWED_PROPERTIES.has(key)) return properties

      if (typeof propertyValue === 'string') {
        properties[key] = propertyValue.trim().slice(0, 100)
      } else if (typeof propertyValue === 'number' && Number.isFinite(propertyValue)) {
        properties[key] = propertyValue
      } else if (typeof propertyValue === 'boolean') {
        properties[key] = propertyValue
      }

      return properties
    },
    {}
  )
}

function isTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'

  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 10_000) {
      return NextResponse.json({ error: 'Request too large.' }, { status: 413 })
    }

    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      return NextResponse.json({ error: 'Unsupported content type.' }, { status: 415 })
    }

    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const eventName = getString(body?.eventName, 60) as FunnelEventName
    const path = getString(body?.path, 200)

    if (!ALLOWED_EVENTS.has(eventName) || !path.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('funnel_events').insert({
      event_name: eventName,
      path,
      properties: sanitizeProperties(body?.properties),
    })

    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('funnel event insert failed', error)
    return NextResponse.json({ error: 'Event not recorded.' }, { status: 500 })
  }
}
