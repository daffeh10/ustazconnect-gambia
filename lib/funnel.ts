export type FunnelEventName =
  | 'marketplace_search'
  | 'service_selected'
  | 'tutor_profile_viewed'
  | 'booking_started'
  | 'booking_request_sent'
  | 'tutor_registration_started'
  | 'tutor_registration_completed'

type FunnelProperty = string | number | boolean

export function trackFunnelEvent(
  eventName: FunnelEventName,
  properties: Record<string, FunnelProperty> = {}
) {
  try {
    void fetch('/api/funnel-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        path: window.location.pathname,
        properties,
      }),
      keepalive: true,
    }).catch((error: unknown) => {
      console.error('Funnel event failed', error)
    })
  } catch (error) {
    console.error('Funnel event failed', error)
  }
}
