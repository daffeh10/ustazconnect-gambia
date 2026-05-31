import { LOCATION_REGIONS } from '@/lib/constants'

type LocationGroup = {
  region: string
  locations: string[]
}

function normalizeLocationQuery(query: string) {
  return query.trim().toLowerCase()
}

export function filterLocationGroups(query: string): LocationGroup[] {
  const normalizedQuery = normalizeLocationQuery(query)

  if (!normalizedQuery) {
    return LOCATION_REGIONS.map((group) => ({
      region: group.region,
      locations: [...group.locations],
    }))
  }

  return LOCATION_REGIONS.map((group) => {
    const regionMatches = group.region.toLowerCase().includes(normalizedQuery)
    const locations = regionMatches
      ? [...group.locations]
      : group.locations.filter((location) =>
          location.toLowerCase().includes(normalizedQuery)
        )

    return {
      region: group.region,
      locations,
    }
  }).filter((group) => group.locations.length > 0)
}

export function matchesLocationSearch(
  location: string | null | undefined,
  query: string
) {
  const normalizedQuery = normalizeLocationQuery(query)

  if (!normalizedQuery) return true

  const normalizedLocation = (location || '').trim().toLowerCase()

  return normalizedLocation.includes(normalizedQuery)
}
