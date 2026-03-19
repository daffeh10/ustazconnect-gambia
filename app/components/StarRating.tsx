'use client'

import { useMemo, useState } from 'react'

interface StarRatingProps {
  rating: number
  interactive?: boolean
  onRate?: (n: number) => void
  size?: 'sm' | 'md'
}

export default function StarRating({
  rating,
  interactive = false,
  onRate,
  size = 'md',
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  const activeValue = useMemo(() => {
    if (interactive && hovered > 0) return hovered
    return Math.round(rating)
  }, [hovered, interactive, rating])

  const sizeClass = size === 'sm' ? 'text-lg' : 'text-xl'

  return (
    <div
      className={`inline-flex items-center gap-1 ${sizeClass}`}
      onMouseLeave={() => {
        if (interactive) setHovered(0)
      }}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1
        const filled = value <= activeValue
        const classes = filled ? 'text-amber-400' : 'text-gray-300'

        if (!interactive) {
          return (
            <span key={value} className={classes} aria-hidden="true">
              ★
            </span>
          )
        }

        return (
          <button
            key={value}
            type="button"
            onMouseEnter={() => setHovered(value)}
            onClick={() => onRate?.(value)}
            className={classes}
            aria-label={`Rate ${value} ${value === 1 ? 'star' : 'stars'}`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
