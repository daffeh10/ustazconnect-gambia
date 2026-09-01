import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/app/components/Footer'
import Header from '@/app/components/Header'

export const metadata: Metadata = {
  title: 'Page Not Found | TutorConnect Gambia',
  description: 'Browse tutor profiles across The Gambia on TutorConnect Gambia.',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-emerald-700">404</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            We could not find that page
          </h1>
          <p className="mt-3 text-gray-600">
            The page may have moved, or the tutor you were looking for is no longer
            taking bookings. Other tutors across The Gambia are available now.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/find-tutor"
              className="flex min-h-12 items-center justify-center rounded-lg bg-emerald-600 px-6 text-white hover:bg-emerald-700"
            >
              Find a tutor
            </Link>
            <Link
              href="/"
              className="flex min-h-12 items-center justify-center rounded-lg border border-gray-300 px-6 text-gray-700 hover:bg-gray-50"
            >
              Go to homepage
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
