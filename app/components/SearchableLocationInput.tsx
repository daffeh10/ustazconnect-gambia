'use client'

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { filterLocationGroups } from '@/lib/location-search'

interface SearchableLocationInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export default function SearchableLocationInput({
  label,
  value,
  onChange,
  placeholder,
}: SearchableLocationInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const listboxId = `${inputId}-locations`
  const deferredValue = useDeferredValue(value)

  const filteredGroups = useMemo(
    () => filterLocationGroups(deferredValue),
    [deferredValue]
  )

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative mb-4">
      <label htmlFor={inputId} className="block text-left text-gray-700 font-medium mb-2">
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          className="w-full rounded-lg border border-gray-300 p-3 pr-20 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
            className="absolute inset-y-0 right-3 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Clear
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
            Type to narrow locations or browse by region.
          </div>

          <div
            id={listboxId}
            role="listbox"
            className="max-h-72 overflow-y-auto px-4 py-3"
          >
            {filteredGroups.length > 0 ? (
              <div className="space-y-4">
                {filteredGroups.map((group) => (
                  <div key={group.region}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {group.region}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.locations.map((location) => (
                        <button
                          key={location}
                          type="button"
                          onClick={() => {
                            onChange(location)
                            setIsOpen(false)
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            value.trim().toLowerCase() === location.toLowerCase()
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700'
                          }`}
                        >
                          {location}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                No locations matched. Try a nearby town or region name.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
