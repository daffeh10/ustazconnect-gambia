import Link from 'next/link'
import Header from './components/Header'
import Footer from './components/Footer'
import Avatar from './components/Avatar'
import MarketplaceSearch from './components/MarketplaceSearch'
import VerificationBadge from './components/VerificationBadge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPublicTutorName } from '@/lib/tutor-review'

export const dynamic = 'force-dynamic'

interface HomepageTutor {
  id: string
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  profile_photo_url: string | null
  offers_online: boolean | null
  verification_status: string | null
}

interface TutorReview {
  tutor_id: string
  rating: number
}

interface TutorWithReviews extends HomepageTutor {
  reviewCount: number
  reviewAverage: number | null
}

async function loadHomepageTutors(): Promise<TutorWithReviews[]> {
  try {
    const supabase = createAdminClient()
    const { data: tutorRows, error: tutorError } = await supabase
      .from('public_tutors')
      .select('id,name,location,subjects,hourly_rate,profile_photo_url,offers_online,verification_status')
      .order('created_at', { ascending: false })
      .limit(4)

    if (tutorError) throw tutorError

    const tutors = (tutorRows ?? []) as HomepageTutor[]
    if (tutors.length === 0) return []

    const { data: reviewRows, error: reviewError } = await supabase
      .from('reviews')
      .select('tutor_id,rating')
      .in('tutor_id', tutors.map((tutor) => tutor.id))

    if (reviewError) {
      console.error('Homepage reviews failed to load', reviewError)
    }

    const reviews = (reviewRows ?? []) as TutorReview[]

    return tutors.map((tutor) => {
      const tutorReviews = reviews.filter((review) => review.tutor_id === tutor.id)
      const reviewAverage =
        tutorReviews.length > 0
          ? tutorReviews.reduce((sum, review) => sum + Number(review.rating), 0) / tutorReviews.length
          : null

      return {
        ...tutor,
        reviewCount: tutorReviews.length,
        reviewAverage,
      }
    })
  } catch (error) {
    console.error('Homepage tutors failed to load', error)
    return []
  }
}

export default async function Home() {
  const tutors = await loadHomepageTutors()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main>
        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 text-center md:pb-14 md:pt-14">
            <p className="mb-3 text-sm font-semibold uppercase text-emerald-700">
              TutorConnect Gambia
            </p>
            <h1 className="mx-auto max-w-4xl text-3xl font-bold text-gray-950 md:text-5xl">
              Find the right tutor, in person or online
            </h1>
            <p className="mx-auto mb-8 mt-4 max-w-2xl text-lg text-gray-600">
              Compare tutors by subject, area, price, availability, and review level.
            </p>
            <MarketplaceSearch />
            <Link
              href="/register/tutor"
              className="mt-5 inline-flex min-h-12 items-center font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Want to teach? Create a tutor account
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 md:py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-950">Tutors you can browse now</h2>
              <p className="mt-1 text-gray-600">Open a profile to compare the details that matter to you.</p>
            </div>
            <Link href="/find-tutor" className="hidden font-semibold text-emerald-700 hover:text-emerald-800 sm:block">
              View all tutors
            </Link>
          </div>

          {tutors.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tutors.map((tutor) => {
                const publicName = formatPublicTutorName(tutor.name)
                return (
                  <article key={tutor.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Avatar name={publicName} photoUrl={tutor.profile_photo_url} size="md" />
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-gray-950">{publicName}</h3>
                        <p className="truncate text-sm text-gray-500">{tutor.location || 'Online'}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <VerificationBadge status={tutor.verification_status} />
                    </div>
                    <p className="mt-4 line-clamp-2 min-h-10 text-sm text-gray-600">
                      {(tutor.subjects || []).slice(0, 3).join(', ') || 'Subjects being updated'}
                    </p>
                    <div className="mt-4 space-y-1 text-sm">
                      <p className="font-semibold text-gray-950">
                        GMD {(tutor.hourly_rate || 0).toLocaleString()}/hour
                      </p>
                      <p className="text-gray-500">
                        {tutor.reviewCount > 0 && tutor.reviewAverage !== null
                          ? `${tutor.reviewAverage.toFixed(1)} from ${tutor.reviewCount} completed-booking ${tutor.reviewCount === 1 ? 'review' : 'reviews'}`
                          : 'No completed-booking reviews yet'}
                      </p>
                      {tutor.offers_online && <p className="font-medium text-sky-700">Online lessons available</p>}
                    </div>
                    <Link
                      href={`/tutor/${tutor.id}`}
                      className="mt-5 flex min-h-12 items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
                    >
                      View Profile
                    </Link>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="border-y border-gray-200 py-8 text-gray-600">
              Tutor profiles are being updated. You can still search the full directory.
            </div>
          )}

          <Link
            href="/find-tutor"
            className="mt-5 flex min-h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 sm:hidden"
          >
            View All Tutors
          </Link>
        </section>

        <section className="border-y border-gray-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:py-14">
            <div>
              <p className="text-sm font-semibold uppercase text-emerald-700">Across The Gambia</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">In-person tutoring</h2>
              <p className="mt-3 text-gray-600">
                Find tutors for school subjects, exam preparation, Quran, languages, and professional courses across The Gambia.
              </p>
              <Link href="/find-tutor" className="mt-5 inline-flex min-h-12 items-center font-semibold text-emerald-700 hover:text-emerald-800">
                Find an in-person tutor
              </Link>
            </div>
            <div className="border-t border-gray-200 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <p className="text-sm font-semibold uppercase text-sky-700">For Gambians abroad</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">Online Quran</h2>
              <p className="mt-3 text-gray-600">
                Learn Quran online with Gambian teachers offering Quran Reading, Tajweed, Hifz, Arabic, and Islamic Studies.
              </p>
              <Link href="/online-quran#quran-tutors" className="mt-5 inline-flex min-h-12 items-center font-semibold text-sky-700 hover:text-sky-800">
                View Quran tutors
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:py-14">
          <h2 className="text-2xl font-bold text-gray-950">Choose the arrangement that suits your family</h2>
          <div className="mt-7 grid gap-7 md:grid-cols-3">
            <div>
              <h3 className="font-semibold text-gray-950">Intro session</h3>
              <p className="mt-2 text-gray-600">
                Meet the tutor for 45 minutes before committing to regular lessons. GMD 150 plus the service fee.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-950">Regular lessons</h3>
              <p className="mt-2 text-gray-600">
                Choose hourly lessons or a flat monthly package based on the tutor&apos;s available options.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-950">Learning together</h3>
              <p className="mt-2 text-gray-600">
                Add children who will learn together and see the full family price before sending the request.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-gray-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
            <h2 className="text-2xl font-bold">How booking works</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-4">
              {[
                ['1', 'Search and compare', 'Review subjects, areas, prices, availability, reviews, and review levels.'],
                ['2', 'Send a request', 'Choose an intro session, hourly lessons, or a monthly package.'],
                ['3', 'Tutor responds', 'The tutor reviews your request and normally responds within 48 hours.'],
                ['4', 'Pay and begin', 'After the tutor accepts, pay through Waychit and manage lessons from your dashboard.'],
              ].map(([number, title, description]) => (
                <li key={number}>
                  <span className="text-sm font-bold text-emerald-400">STEP {number}</span>
                  <h3 className="mt-2 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-gray-300">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
            <h2 className="text-2xl font-bold text-gray-950">Clear information about every tutor</h2>
            <div className="mt-7 grid gap-7 md:grid-cols-3">
              <div>
                <VerificationBadge status="basic" />
                <p className="mt-3 text-gray-600">
                  The tutor has created a profile. Qualifications have not been marked as reviewed.
                </p>
              </div>
              <div>
                <VerificationBadge status="profile_reviewed" />
                <p className="mt-3 text-gray-600">
                  TutorConnect has reviewed study evidence or a teaching reference submitted by the tutor.
                </p>
              </div>
              <div>
                <VerificationBadge status="qualification_verified" />
                <p className="mt-3 text-gray-600">
                  TutorConnect has reviewed a qualification document submitted by the tutor.
                </p>
              </div>
            </div>
            <div className="mt-8 grid gap-5 border-t border-gray-200 pt-7 md:grid-cols-2">
              <p className="text-gray-700">
                <strong className="text-gray-950">Reviews:</strong> Families and students can only leave a review after a completed lesson.
              </p>
              <p className="text-gray-700">
                <strong className="text-gray-950">Payment:</strong> Payment is requested only after the tutor accepts the booking.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-emerald-700">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center text-white md:py-14">
            <h2 className="text-2xl font-bold">Teach through TutorConnect Gambia</h2>
            <p className="mx-auto mt-4 max-w-2xl text-emerald-50">
              Create your profile, choose what and where you teach, set your price, and submit your information for review. Families can then find you and send booking requests through the platform.
            </p>
            <Link
              href="/register/tutor"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Create Tutor Account
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
