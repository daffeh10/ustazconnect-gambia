'use client'

import { useEffect, useState } from 'react'
import { normalizeTutorVerificationStatus } from '@/lib/tutor-review'

interface VerificationBadgeProps {
  status?: string | null
}

type BadgeConfig = {
  text: string
  classes: string
  description: string
}

const BADGE_CONFIG: Record<
  'basic' | 'profile_reviewed' | 'qualification_verified' | 'premium',
  BadgeConfig
> = {
  basic: {
    text: 'Basic',
    classes: 'bg-gray-100 text-gray-600',
    description: 'The tutor has created a profile. Qualifications have not been marked as reviewed.',
  },
  profile_reviewed: {
    text: 'Profile Reviewed',
    classes: 'bg-sky-100 text-sky-700',
    description: 'TutorConnect reviewed study evidence or a teaching reference submitted by this tutor.',
  },
  qualification_verified: {
    text: 'Qualification Verified',
    classes: 'bg-emerald-100 text-emerald-700',
    description: 'TutorConnect reviewed a qualification document submitted by this tutor.',
  },
  premium: {
    text: 'Premium',
    classes: 'bg-amber-100 text-amber-700',
    description: 'This is a legacy profile label.',
  },
}

export default function VerificationBadge({ status }: VerificationBadgeProps) {
  const normalized = normalizeTutorVerificationStatus(status)
  const badge = BADGE_CONFIG[normalized]
  const [isMobileExplanationOpen, setIsMobileExplanationOpen] = useState(false)

  function handleInformationClick() {
    if (window.matchMedia('(max-width: 639px)').matches) {
      setIsMobileExplanationOpen(true)
    }
  }

  useEffect(() => {
    if (!isMobileExplanationOpen) return

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMobileExplanationOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileExplanationOpen])

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span
        className={`${badge.classes} inline-flex items-center rounded-full px-3 py-1 text-sm font-medium`}
      >
        {badge.text}
      </span>
      <span className="group relative inline-flex shrink-0">
        <button
          type="button"
          aria-label={`${badge.text}: ${badge.description}`}
          aria-expanded={isMobileExplanationOpen}
          onClick={handleInformationClick}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:h-5 sm:w-5 sm:cursor-help"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold">
            i
          </span>
        </button>
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-md bg-gray-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:block"
        >
          {badge.description}
        </span>
      </span>

      {isMobileExplanationOpen && (
        <span
          className="fixed inset-0 z-50 flex items-end bg-gray-950/40 p-4 sm:hidden"
          onClick={() => setIsMobileExplanationOpen(false)}
        >
          <span
            role="dialog"
            aria-modal="true"
            aria-label={`${badge.text} verification details`}
            className="mx-auto block w-full max-w-sm rounded-lg bg-white p-5 text-left text-gray-900 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="block text-base font-semibold">{badge.text}</span>
            <span className="mt-2 block text-sm font-normal leading-6 text-gray-600">
              {badge.description}
            </span>
            <button
              type="button"
              autoFocus
              onClick={() => setIsMobileExplanationOpen(false)}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Close
            </button>
          </span>
        </span>
      )}
    </span>
  )
}
