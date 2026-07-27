import { notFound } from 'next/navigation'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'

export default function AdminQuranLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (!DIASPORA_QURAN_ENABLED) notFound()

  return children
}
