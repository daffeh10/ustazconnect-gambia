interface VerificationBadgeProps {
  status?: string | null
}

type BadgeConfig = {
  text: string
  classes: string
}

const BADGE_CONFIG: Record<'basic' | 'verified' | 'premium', BadgeConfig> = {
  basic: {
    text: 'Basic',
    classes: 'bg-gray-100 text-gray-600',
  },
  verified: {
    text: '✓ Verified',
    classes: 'bg-emerald-100 text-emerald-700',
  },
  premium: {
    text: '⭐ Premium',
    classes: 'bg-amber-100 text-amber-700',
  },
}

function normalizeStatus(status?: string | null): 'basic' | 'verified' | 'premium' {
  const cleaned = (status || '').toLowerCase().trim()

  if (cleaned === 'verified') return 'verified'
  if (cleaned === 'premium') return 'premium'
  return 'basic'
}

export default function VerificationBadge({ status }: VerificationBadgeProps) {
  const normalized = normalizeStatus(status)
  const badge = BADGE_CONFIG[normalized]

  return (
    <span
      className={`${badge.classes} px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1`}
    >
      {badge.text}
    </span>
  )
}
