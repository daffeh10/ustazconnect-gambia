'use client'

import { useId, useMemo, useState } from 'react'

interface SearchableMultiSelectProps {
  label: string
  options: readonly string[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  helperText?: string
}

export default function SearchableMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder,
  helperText,
}: SearchableMultiSelectProps) {
  const inputId = useId()
  const [query, setQuery] = useState('')

  const availableOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return options
      .filter((option) => !values.includes(option))
      .filter((option) => !normalizedQuery || option.toLowerCase().includes(normalizedQuery))
      .slice(0, 12)
  }, [options, query, values])

  function addValue(value: string) {
    onChange([...values, value])
    setQuery('')
  }

  function removeValue(value: string) {
    onChange(values.filter((item) => item !== value))
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {values.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => removeValue(value)}
              className="inline-flex min-h-12 items-center rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              aria-label={`Remove ${value}`}
            >
              {value}
              <span aria-hidden="true" className="ml-2 text-emerald-600">×</span>
            </button>
          ))}
        </div>
      )}
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
      />
      {query.trim() && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
          {availableOptions.length > 0 ? (
            availableOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => addValue(option)}
                className="block min-h-12 w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
              >
                {option}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-gray-500">No matching options.</p>
          )}
        </div>
      )}
      {helperText && <p className="mt-2 text-sm text-gray-500">{helperText}</p>}
    </div>
  )
}
