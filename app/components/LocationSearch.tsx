'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SearchableLocationInput from '@/app/components/SearchableLocationInput'

export default function LocationSearch() {
  const [selectedLocation, setSelectedLocation] = useState('')
  const router = useRouter()

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedLocation = selectedLocation.trim()

    if (normalizedLocation) {
      router.push(`/find-tutor?location=${encodeURIComponent(normalizedLocation)}`)
      return
    }

    router.push('/find-tutor')
  }

  return (
    <form
      onSubmit={handleSearch}
      className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6"
    >
      <SearchableLocationInput
        label="Select your area"
        value={selectedLocation}
        onChange={setSelectedLocation}
        placeholder="Search for Bakau, Brikama, Sukuta..."
      />
      <button
        type="submit"
        className="block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition text-center"
      >
        Find Tutors Near Me
      </button>
    </form>
  )
}
