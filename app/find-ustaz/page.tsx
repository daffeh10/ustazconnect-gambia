'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface UstazProfile {
  id: string
  name: string
  phone: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
  bio: string | null
  available_days: string[] | null
}

const LOCATIONS = [
  'All Locations',
  'Serrekunda',
  'Banjul',
  'Bakau',
  'Brikama',
  'Kololi',
  'Kotu',
  'Fajara'
]

const SUBJECTS = [
  'All Subjects',
  'Quran Reading',
  'Tajweed',
  'Hifz (Memorization)',
  'Arabic Language',
  'Islamic Studies'
]

export default function FindUstaz() {
  const [ustazs, setUstazs] = useState<UstazProfile[]>([])
  const [filteredUstazs, setFilteredUstazs] = useState<UstazProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [locationFilter, setLocationFilter] = useState('All Locations')
  const [subjectFilter, setSubjectFilter] = useState('All Subjects')

  // Fetch ustazs from database
  useEffect(() => {
    async function fetchUstazs() {
      try {
        const { data, error } = await supabase
          .from('ustaz_profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        setUstazs(data || [])
        setFilteredUstazs(data || [])
      } catch (err) {
        setError('Failed to load ustazs. Please try again.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUstazs()
  }, [])

  // Apply filters
  useEffect(() => {
    let results = ustazs

    if (locationFilter !== 'All Locations') {
      results = results.filter(u => u.location === locationFilter)
    }

    if (subjectFilter !== 'All Subjects') {
      results = results.filter(u => u.subjects.includes(subjectFilter))
    }

    setFilteredUstazs(results)
  }, [locationFilter, subjectFilter, ustazs])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            UstazConnect
          </Link>
          <div className="flex gap-4">
            <Link href="/find-ustaz" className="text-emerald-700 font-medium">
              Find Ustaz
            </Link>
            <Link href="/register-ustaz" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
              Become an Ustaz
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find an Ustaz</h1>
        <p className="text-gray-600 mb-8">
          Browse our verified Quran teachers and find the perfect match for your family.
        </p>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading ustazs...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results Count */}
        {!isLoading && !error && (
          <p className="text-gray-600 mb-4">
            Showing {filteredUstazs.length} {filteredUstazs.length === 1 ? 'ustaz' : 'ustazs'}
          </p>
        )}

        {/* No Results */}
        {!isLoading && !error && filteredUstazs.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-4">No ustazs found matching your criteria.</p>
            <button
              onClick={() => {
                setLocationFilter('All Locations')
                setSubjectFilter('All Subjects')
              }}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Ustaz Cards */}
        {!isLoading && !error && filteredUstazs.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUstazs.map((ustaz) => (
              <div key={ustaz.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 font-bold text-xl">
                      {ustaz.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{ustaz.name}</h3>
                    <p className="text-sm text-gray-500">{ustaz.location}</p>
                  </div>
                </div>

                {/* Subjects */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {ustaz.subjects.slice(0, 3).map((subject) => (
                    <span
                      key={subject}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full"
                    >
                      {subject}
                    </span>
                  ))}
                  {ustaz.subjects.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      +{ustaz.subjects.length - 3} more
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Experience:</span>{' '}
                    {ustaz.experience_years === 21
                      ? 'Above 20 years'
                      : `${ustaz.experience_years} ${ustaz.experience_years === 1 ? 'year' : 'years'}`}
                  </p>
                  <p>
                    <span className="font-medium">Rate:</span> {ustaz.hourly_rate} Dalasi/hour
                  </p>
                </div>

                {/* View Profile Button */}
                <Link
                  href={`/ustaz/${ustaz.id}`}
                  className="block w-full text-center bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}