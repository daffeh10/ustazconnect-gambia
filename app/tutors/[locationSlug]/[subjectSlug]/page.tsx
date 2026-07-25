import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import { ALL_LOCATIONS, ALL_SUBJECTS } from '@/lib/constants'
import { findBySeoSlug, toSeoSlug } from '@/lib/seo-slugs'

interface SeoTutorPageProps {
  params: Promise<{
    locationSlug: string
    subjectSlug: string
  }>
}

export async function generateStaticParams() {
  const prioritySubjects = ALL_SUBJECTS.filter((subject) =>
    ['Quran', 'Math', 'English', 'WASSCE', 'Physics', 'Arabic'].some((term) =>
      subject.toLowerCase().includes(term.toLowerCase())
    )
  )
  const priorityLocations = ALL_LOCATIONS.slice(0, 30)

  return priorityLocations.flatMap((location) =>
    prioritySubjects.map((subject) => ({
      locationSlug: toSeoSlug(location),
      subjectSlug: toSeoSlug(subject),
    }))
  )
}

export async function generateMetadata({ params }: SeoTutorPageProps): Promise<Metadata> {
  const { locationSlug, subjectSlug } = await params
  const location = findBySeoSlug(ALL_LOCATIONS, locationSlug)
  const subject = findBySeoSlug(ALL_SUBJECTS, subjectSlug)

  if (!location || !subject) {
    return {
      title: 'TutorConnect Gambia',
    }
  }

  return {
    title: `${subject} Tutor in ${location} | TutorConnect Gambia`,
    description: `Find verified ${subject} tutors in ${location}. Browse profiles, compare rates, and book securely through TutorConnect Gambia.`,
  }
}

export default async function SeoTutorPage({ params }: SeoTutorPageProps) {
  const { locationSlug, subjectSlug } = await params
  const location = findBySeoSlug(ALL_LOCATIONS, locationSlug)
  const subject = findBySeoSlug(ALL_SUBJECTS, subjectSlug)

  if (!location || !subject) notFound()

  const searchHref = `/find-tutor?location=${encodeURIComponent(location)}&subject=${encodeURIComponent(subject)}`

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">{subject} tutor in {location}</h1>
          <p className="mt-4 text-gray-600">
            Browse TutorConnect Gambia tutors who teach {subject} around {location}. You can compare tutor profiles, rates, availability, and online options before sending a booking request.
          </p>
          <Link href={searchHref} className="mt-6 inline-flex rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700">
            View Matching Tutors
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
