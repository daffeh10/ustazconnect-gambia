'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const LOCATIONS = [
  'Serrekunda',
  'Banjul',
  'Bakau',
  'Brikama',
  'Kololi',
  'Kotu',
  'Fajara'
]

const SUBJECTS = [
  'Quran Reading',
  'Tajweed',
  'Hifz (Memorization)',
  'Arabic Language',
  'Islamic Studies'
]

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
]

export default function RegisterUstaz() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    subjects: [] as string[],
    experience_years: 0,
    hourly_rate: 0,
    bio: '',
    available_days: [] as string[]
  })

  const handleSubjectChange = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }))
  }

  const handleDayChange = (day: string) => {
    setFormData(prev => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter(d => d !== day)
        : [...prev.available_days, day]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    // Validation
    if (!formData.name || !formData.phone || !formData.location) {
      setError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    if (formData.subjects.length === 0) {
      setError('Please select at least one subject')
      setIsSubmitting(false)
      return
    }

    if (formData.hourly_rate <= 0) {
      setError('Please enter a valid hourly rate')
      setIsSubmitting(false)
      return
    }

    try {
      const { error: supabaseError } = await supabase
        .from('ustaz_profiles')
        .insert([formData])

      if (supabaseError) {
        throw supabaseError
      }

      setIsSuccess(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-emerald-700">
              UstazConnect
            </Link>
          </nav>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h1>
            <p className="text-gray-600 mb-6">
              Your profile has been created. Families can now find you on UstazConnect.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/find-ustaz"
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                View All Ustazs
              </Link>
              <Link
                href="/"
                className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </main>
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
            <Link href="/register-ustaz" className="bg-emerald-600 text-white px-4 py-2 rounded-lg">
              Become an Ustaz
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Become an Ustaz</h1>
        <p className="text-gray-600 mb-8">
          Join UstazConnect and start teaching Quran to families in your area.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your full name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="+220 XXX XXXX"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select your area</option>
              {LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Subjects You Teach <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SUBJECTS.map((subject) => (
                <label key={subject} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.subjects.includes(subject)}
                    onChange={() => handleSubjectChange(subject)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{subject}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Experience - Now a Dropdown */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Years of Experience
            </label>
            <select
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value={0}>Select years</option>
              {[...Array(20)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} {i + 1 === 1 ? 'year' : 'years'}
                </option>
              ))}
              <option value={21}>Above 20 years</option>
            </select>
          </div>

          {/* Hourly Rate - No helper text */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Hourly Rate (Dalasi) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={formData.hourly_rate}
              onChange={(e) => setFormData({ ...formData, hourly_rate: parseInt(e.target.value) || 0 })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g., 100"
            />
          </div>

          {/* Available Days */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Available Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <label
                  key={day}
                  className={`px-3 py-2 border rounded-lg cursor-pointer transition ${
                    formData.available_days.includes(day)
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.available_days.includes(day)}
                    onChange={() => handleDayChange(day)}
                    className="sr-only"
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              About You
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Tell families about your teaching experience, qualifications, and approach..."
              maxLength={500}
            />
            <p className="text-sm text-gray-500 mt-1">{formData.bio.length}/500 characters</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Registering...' : 'Register as Ustaz'}
          </button>
        </form>
      </main>
    </div>
  )
}