'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TutorPackageManagerProps {
  tutorId: string
}

interface TutorPackage {
  id: string
  title: string
  description: string | null
  frequency_per_week: number
  hours_per_visit: number
  monthly_price: number
  additional_child_amount: number | null
  is_active: boolean | null
}

export default function TutorPackageManager({ tutorId }: TutorPackageManagerProps) {
  const [supabase] = useState(() => createClient())
  const [packages, setPackages] = useState<TutorPackage[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(3)
  const [hoursPerVisit, setHoursPerVisit] = useState('1')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [additionalChildAmount, setAdditionalChildAmount] = useState('0')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSchemaMissing, setIsSchemaMissing] = useState(false)

  const loadPackages = useCallback(async () => {
    if (!tutorId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { data, error: loadError } = await supabase
        .from('tutor_packages')
        .select('id,title,description,frequency_per_week,hours_per_visit,monthly_price,additional_child_amount,is_active')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false })

      if (loadError) throw loadError
      setPackages((data ?? []) as TutorPackage[])
      setIsSchemaMissing(false)
    } catch (err) {
      console.error(err)
      const messageText = err instanceof Error ? err.message.toLowerCase() : ''
      if (
        messageText.includes('tutor_packages') ||
        messageText.includes('schema cache') ||
        messageText.includes('does not exist')
      ) {
        setIsSchemaMissing(true)
        setPackages([])
      } else {
        setError('Could not load monthly packages.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [supabase, tutorId])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      const priceValue = Number(monthlyPrice)
      const hoursValue = Number(hoursPerVisit)
      const additionalChildValue = Number(additionalChildAmount)

      if (!title.trim()) throw new Error('Package title is required.')
      if (!Number.isFinite(priceValue) || priceValue <= 0) throw new Error('Monthly price must be greater than zero.')
      if (!Number.isFinite(hoursValue) || hoursValue <= 0) throw new Error('Hours per visit must be greater than zero.')
      if (!Number.isFinite(additionalChildValue) || additionalChildValue < 0) throw new Error('Additional child amount cannot be negative.')

      const { error: insertError } = await supabase.from('tutor_packages').insert({
        tutor_id: tutorId,
        title: title.trim(),
        description: description.trim() || null,
        frequency_per_week: frequencyPerWeek,
        hours_per_visit: hoursValue,
        monthly_price: Math.round(priceValue),
        additional_child_amount: Math.round(additionalChildValue),
        is_active: true,
      })

      if (insertError) throw insertError

      setTitle('')
      setDescription('')
      setFrequencyPerWeek(3)
      setHoursPerVisit('1')
      setMonthlyPrice('')
      setAdditionalChildAmount('0')
      setMessage('Package saved.')
      await loadPackages()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not save package.')
    } finally {
      setIsSaving(false)
    }
  }

  async function togglePackage(pkg: TutorPackage) {
    setError('')
    setMessage('')

    try {
      const { error: updateError } = await supabase
        .from('tutor_packages')
        .update({ is_active: !pkg.is_active, updated_at: new Date().toISOString() })
        .eq('id', pkg.id)

      if (updateError) throw updateError
      setMessage(pkg.is_active ? 'Package hidden.' : 'Package published.')
      await loadPackages()
    } catch (err) {
      console.error(err)
      setError('Could not update package.')
    }
  }

  if (isSchemaMissing) {
    return (
      <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Monthly Packages</h2>
        <p className="mt-2 text-sm text-gray-600">
          Monthly packages will be available after Abdul runs the remaining roadmap SQL in Supabase.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900">Monthly Packages</h2>
      <p className="mt-1 text-sm text-gray-600">
        Publish flat monthly options families can choose instead of hourly booking.
      </p>

      {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="package-title" className="block text-sm font-medium text-gray-700 mb-1">Package title</label>
          <input
            id="package-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
            placeholder="Example: Quran 3 days weekly"
          />
        </div>
        <div>
          <label htmlFor="package-price" className="block text-sm font-medium text-gray-700 mb-1">Monthly price (GMD)</label>
          <input
            id="package-price"
            type="number"
            min="1"
            value={monthlyPrice}
            onChange={(event) => setMonthlyPrice(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="package-frequency" className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
          <select
            id="package-frequency"
            value={frequencyPerWeek}
            onChange={(event) => setFrequencyPerWeek(Number(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((value) => (
              <option key={value} value={value}>{value}x/week</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="package-hours" className="block text-sm font-medium text-gray-700 mb-1">Hours per visit</label>
          <input
            id="package-hours"
            type="number"
            min="0.5"
            step="0.5"
            value={hoursPerVisit}
            onChange={(event) => setHoursPerVisit(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="additional-child" className="block text-sm font-medium text-gray-700 mb-1">Extra per additional child (GMD)</label>
          <input
            id="additional-child"
            type="number"
            min="0"
            value={additionalChildAmount}
            onChange={(event) => setAdditionalChildAmount(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="package-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            id="package-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
            placeholder="Optional notes for families"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Add Package'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading packages...</p>
        ) : packages.length === 0 ? (
          <p className="text-sm text-gray-500">No monthly packages yet.</p>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
              <div>
                <p className="font-medium text-gray-900">{pkg.title}</p>
                <p className="text-sm text-gray-600">
                  {pkg.frequency_per_week}x/week, {pkg.hours_per_visit} hour{pkg.hours_per_visit === 1 ? '' : 's'} per visit · GMD {pkg.monthly_price.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void togglePackage(pkg)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {pkg.is_active ? 'Hide' : 'Publish'}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
