'use client'

import { useState, useEffect, use } from 'react'
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
  created_at: string
}

export default function UstazProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ustaz, setUstaz] = useState<UstazProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Inquiry form state
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [inquiryData, setInquiryData] = useState({
    family_name: '',
    family_phone: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inquirySuccess, setInquirySuccess] = useState(false)
  const [inquiryError, setInquiryError] = useState('')

  useEffect(() => {
    async function fetchUstaz() {
      try {
        const { data, error } = await supabase
          .from('ustaz_profiles')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        setUstaz(data)
      } catch (err) {
        setError('Ustaz not found.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUstaz()
  }, [id])

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setInquiryError('')

    if (!inquiryData.family_name || !inquiryData.family_phone) {
      setInquiryError('Please fill in your name and phone number')
      setIsSubmitting(false)
      return
    }

    try {
      const { error } = await supabase
        .from('inquiries')
        .insert([{
          ustaz_id: id,
          family_name: inquiryData.family_name,
          family_phone: inquiryData.family_phone,
          message: inquiryData.message
        }])

      if (error) throw error

      setInquirySuccess(true)
      setShowInquiryForm(false)
    } catch (err) {
      setInquiryError('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <nav className="max-w-6xl mx-auto px-4 py-4">
            <Link href="/" className="text-2xl font-bold text-emerald-700">
              UstazConnect
            </Link>
          </nav>
        </header>
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !ustaz) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <nav className="max-w-6xl mx-auto px-4 py-4">
            <Link href="/" className="text-2xl font-bold text-emerald-700">
              UstazConnect
            </Link>
          </nav>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ustaz Not Found</h1>
          <p className="text-gray-600 mb-6">The profile you are looking for does not exist.</p>
          <Link href="/find-ustaz" className="text-emerald-600 hover:text-emerald-700">
            ← Browse all ustazs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-emerald-700">
            UstazConnect
          </Link>
          <div className="flex gap-4">
            <Link href="/find-ustaz" className="text-gray-600 hover:text-emerald-700 transition">
              Find Ustaz
            </Link>
            <Link href="/register-ustaz" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
              Become an Ustaz
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/find-ustaz" className="text-emerald-600 hover:text-emerald-700 mb-6 inline-block">
          ← Back to all ustazs
        </Link>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Profile Header */}
          <div className="bg-emerald-600 px-6 py-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
                <span className="text-emerald-600 font-bold text-4xl">
                  {ustaz.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-white">
                <h1 className="text-3xl font-bold">{ustaz.name}</h1>
                <p className="text-emerald-100 flex items-center gap-2 mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {ustaz.location}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            {/* Quick Info */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Experience</p>
                <p className="text-xl font-semibold text-gray-900">
                  {ustaz.experience_years === 21
                    ? '20+ years'
                    : `${ustaz.experience_years} ${ustaz.experience_years === 1 ? 'year' : 'years'}`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Hourly Rate</p>
                <p className="text-xl font-semibold text-gray-900">{ustaz.hourly_rate} Dalasi</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">Subjects</p>
                <p className="text-xl font-semibold text-gray-900">{ustaz.subjects.length}</p>
              </div>
            </div>

            {/* Subjects */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Subjects Taught</h2>
              <div className="flex flex-wrap gap-2">
                {ustaz.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>

            {/* Available Days */}
            {ustaz.available_days && ustaz.available_days.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Days</h2>
                <div className="flex flex-wrap gap-2">
                  {ustaz.available_days.map((day) => (
                    <span
                      key={day}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {ustaz.bio && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{ustaz.bio}</p>
              </div>
            )}

            {/* Contact Button */}
            {!inquirySuccess && (
              <button
                onClick={() => setShowInquiryForm(true)}
                className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition"
              >
                Contact This Ustaz
              </button>
            )}

            {/* Success Message */}
            {inquirySuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-emerald-800 mb-1">Inquiry Sent!</h3>
                <p className="text-emerald-700 text-sm">
                  {ustaz.name} will contact you soon at the phone number you provided.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Inquiry Modal */}
        {showInquiryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Contact {ustaz.name}</h2>
                <button
                  onClick={() => setShowInquiryForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {inquiryError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                  {inquiryError}
                </div>
              )}

              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-1 text-sm">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={inquiryData.family_name}
                    onChange={(e) => setInquiryData({ ...inquiryData, family_name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1 text-sm">
                    Your Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={inquiryData.family_phone}
                    onChange={(e) => setInquiryData({ ...inquiryData, family_phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="+220 XXX XXXX"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1 text-sm">
                    Message
                  </label>
                  <textarea
                    value={inquiryData.message}
                    onChange={(e) => setInquiryData({ ...inquiryData, message: e.target.value })}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Tell the ustaz about your child and what you're looking for..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInquiryForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}