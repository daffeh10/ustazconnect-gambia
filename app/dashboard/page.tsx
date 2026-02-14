'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Inquiry {
  id: string
  family_name: string
  family_phone: string
  message: string | null
  created_at: string
}

interface UstazProfile {
  id: string
  name: string
  phone: string
  location: string
  subjects: string[]
  experience_years: number
  hourly_rate: number
}

export default function Dashboard() {
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [ustaz, setUstaz] = useState<UstazProfile | null>(null)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (!phone.trim()) {
      setError('Please enter your phone number')
      setIsLoading(false)
      return
    }

    try {
      const { data: ustazData, error: ustazError } = await supabase
        .from('ustaz_profiles')
        .select('*')
        .eq('phone', phone.trim())
        .single()

      if (ustazError || !ustazData) {
        setError('No ustaz found with this phone number.')
        setIsLoading(false)
        return
      }

      const { data: inquiryData } = await supabase
        .from('inquiries')
        .select('*')
        .eq('ustaz_id', ustazData.id)
        .order('created_at', { ascending: false })

      setUstaz(ustazData)
      setInquiries(inquiryData || [])
      setIsLoggedIn(true)
    } catch (err) {
      setError('Something went wrong.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUstaz(null)
    setInquiries([])
    setPhone('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-emerald-700">UstazConnect</Link>
            <Link href="/register-ustaz" className="bg-emerald-600 text-white px-4 py-2 rounded-lg">Become an Ustaz</Link>
          </nav>
        </header>
        <main className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ustaz Dashboard</h1>
            <p className="text-gray-600 mb-6">Enter your registered phone number to view your inquiries.</p>
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="+220 XXX XXXX" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">{isLoading ? 'Loading...' : 'View My Inquiries'}</button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-emerald-700">UstazConnect</Link>
          <button onClick={handleLogout} className="text-gray-600 hover:text-red-600">Logout</button>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {ustaz?.name}</h1>
          <p className="text-gray-600">{ustaz?.location} - {ustaz?.hourly_rate} Dalasi/hour</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Inquiries ({inquiries.length})</h2>
          {inquiries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No inquiries yet. When families contact you, they will appear here.</p>
          ) : (
            <div className="space-y-4">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900">{inquiry.family_name}</h3>
                  <p className="text-emerald-600">{inquiry.family_phone}</p>
                  <p className="text-gray-500 text-sm">{formatDate(inquiry.created_at)}</p>
                  {inquiry.message && <p className="text-gray-600 mt-2 bg-gray-50 p-3 rounded">{inquiry.message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}