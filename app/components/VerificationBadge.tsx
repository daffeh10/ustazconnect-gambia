import { normalizeTutorVerificationStatus } from '@/lib/tutor-review'

interface VerificationBadgeProps {
  status?: string | null
}

type BadgeConfig = {
  text: string
  classes: string
}

const BADGE_CONFIG: Record<
  'basic' | 'profile_reviewed' | 'qualification_verified' | 'premium',
  BadgeConfig
> = {
  basic: {
    text: 'Basic',
    classes: 'bg-gray-100 text-gray-600',
  },
  profile_reviewed: {
    text: 'Profile Reviewed',
    classes: 'bg-sky-100 text-sky-700',
  },
  qualification_verified: {
    text: 'Qualification Verified',
    classes: 'bg-emerald-100 text-emerald-700',
  },
  premium: {
    text: '⭐ Premium',
    classes: 'bg-amber-100 text-amber-700',
  },
}

export default function VerificationBadge({ status }: VerificationBadgeProps) {
  const normalized = normalizeTutorVerificationStatus(status)
  const badge = BADGE_CONFIG[normalized]

  return (
    <span
      className={`${badge.classes} px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1`}
    >
      {badge.text}
    </span>
  )
}
