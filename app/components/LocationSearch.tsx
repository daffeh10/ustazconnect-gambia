'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOCATION_REGIONS } from '@/lib/constants'

export default function LocationSearch() {
  const [selectedLocation, setSelectedLocation] = useState('')
  const router = useRouter()

  function handleSearch() {
    if (selectedLocation) {
      router.push(`/find-ustaz?location=${encodeURIComponent(selectedLocation)}`)
    } else {
      router.push('/find-ustaz')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
      <label className="block text-left text-gray-700 font-medium mb-2">
        Select your area
      </label>
      <select
        value={selectedLocation}
        onChange={(e) => setSelectedLocation(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      >
        <option value="">Choose a location...</option>
        {LOCATION_REGIONS.map((region) => (
          <optgroup key={region.region} label={region.region}>
            {region.locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSearch}
        className="block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition text-center"
      >
        Find Tutors Near Me
      </button>
    </div>
  )
}
