'use client'

import Image from 'next/image'

type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: AvatarSize
  className?: string
}

const SIZE_STYLES: Record<AvatarSize, { container: string; image: number; text: string }> = {
  sm: {
    container: 'h-10 w-10',
    image: 40,
    text: 'text-base',
  },
  md: {
    container: 'h-16 w-16',
    image: 64,
    text: 'text-2xl',
  },
  lg: {
    container: 'h-24 w-24',
    image: 96,
    text: 'text-4xl',
  },
}

function getInitial(name: string) {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}

export default function Avatar({
  name,
  photoUrl,
  size = 'md',
  className = '',
}: AvatarProps) {
  const styles = SIZE_STYLES[size]
  const label = `${name} avatar`

  return (
    <div
      className={`${styles.container} overflow-hidden rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 ${className}`.trim()}
      aria-label={label}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={label}
          width={styles.image}
          height={styles.image}
          quality={75}
          className="h-full w-full object-cover rounded-full"
        />
      ) : (
        <span className={`font-bold ${styles.text}`}>{getInitial(name)}</span>
      )}
    </div>
  )
}
