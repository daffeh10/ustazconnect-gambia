import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/app/components/Footer'
import Header from '@/app/components/Header'

export const metadata: Metadata = {
  title: 'How TutorConnect Works | TutorConnect Gambia',
  description:
    'See how to compare tutors, send a booking request, and choose an intro session, hourly lessons, or a monthly package.',
}

const BOOKING_STEPS = [
  {
    number: '1',
    title: 'Search and compare',
    description:
      'Review subjects, areas, prices, availability, reviews, and review levels.',
  },
  {
    number: '2',
    title: 'Send a request',
    description: 'Choose an intro session, hourly lessons, or a monthly package.',
  },
  {
    number: '3',
    title: 'Tutor responds',
    description:
      'The tutor reviews your request and normally responds within 48 hours.',
  },
  {
    number: '4',
    title: 'Pay and begin',
    description:
      'Complete payment through Waychit and manage lessons from your dashboard.',
  },
]

const LESSON_OPTIONS = [
  {
    title: 'Intro session',
    description:
      'Meet the tutor for 45 minutes before committing to regular lessons. GMD 150 plus the service fee.',
  },
  {
    title: 'Regular lessons',
    description:
      "Choose hourly lessons or a flat monthly package based on the tutor's available options.",
  },
  {
    title: 'Learning together',
    description:
      'Add children who will learn together and see the full family price before sending the request.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main>
        <section className="border-b border-emerald-100 bg-emerald-50">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center md:py-16">
            <h1 className="text-3xl font-bold text-gray-950 md:text-4xl">
              How TutorConnect works
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Find a tutor, compare the details, and choose the lesson arrangement
              that works for your family.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:py-14">
          <ol className="grid gap-8 md:grid-cols-4">
            {BOOKING_STEPS.map((step) => (
              <li key={step.number}>
                <span className="text-sm font-bold text-emerald-700">
                  STEP {step.number}
                </span>
                <h2 className="mt-2 font-semibold text-gray-950">{step.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
            <h2 className="text-2xl font-bold text-gray-950">Lesson options</h2>
            <div className="mt-7 grid gap-7 md:grid-cols-3">
              {LESSON_OPTIONS.map((option) => (
                <div key={option.title}>
                  <h3 className="font-semibold text-gray-950">{option.title}</h3>
                  <p className="mt-2 text-gray-600">{option.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center md:py-14">
            <Link
              href="/find-tutor"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              Find a Tutor
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
