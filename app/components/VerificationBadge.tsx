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

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${badge.classes} inline-flex items-center rounded-full px-3 py-1 text-sm font-medium`}
      >
        {badge.text}
      </span>
      <span className="group relative inline-flex">
        <button
          type="button"
          aria-label={`${badge.text}: ${badge.description}`}
          className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          i
        </button>
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 w-64 rounded-md bg-gray-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          {badge.description}
        </span>
      </span>
    </span>
  )
}
