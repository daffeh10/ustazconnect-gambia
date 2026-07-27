import Link from 'next/link'
import Header from './components/Header'
import Footer from './components/Footer'
import Avatar from './components/Avatar'
import MarketplaceSearch from './components/MarketplaceSearch'
import VerificationBadge from './components/VerificationBadge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPublicTutorName } from '@/lib/tutor-review'
import {
  HIFZ_QURAN_MEMORISATION,
  normalizeTutorSubjects,
  QURAN_READING_WITH_TAJWEED,
} from '@/lib/tutor-subjects'

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
  available_days: string[] | null
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
      .select(
        'id,name,location,subjects,hourly_rate,profile_photo_url,offers_online,verification_status,available_days'
      )
      .order('created_at', { ascending: false })
      .limit(4)

    if (tutorError) throw tutorError

    const tutors = (tutorRows ?? []) as HomepageTutor[]
    if (tutors.length === 0) return []

    const { data: reviewRows, error: reviewError } = await supabase
      .from('reviews')
      .select('tutor_id,rating')
      .in(
        'tutor_id',
        tutors.map((tutor) => tutor.id)
      )

    if (reviewError) {
      console.error('Homepage reviews failed to load', reviewError)
    }

    const reviews = (reviewRows ?? []) as TutorReview[]

    return tutors.map((tutor) => {
      const tutorReviews = reviews.filter((review) => review.tutor_id === tutor.id)
      const reviewAverage =
        tutorReviews.length > 0
          ? tutorReviews.reduce((sum, review) => sum + Number(review.rating), 0) /
            tutorReviews.length
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

function formatRate(rate: number | null) {
  return rate ? `GMD ${rate.toLocaleString()}/hour` : 'See profile for rate'
}

function formatAvailability(days: string[] | null) {
  if (!days || days.length === 0) return 'Availability on profile'
  if (days.length <= 2) return days.join(' and ')
  return `${days.slice(0, 2).join(', ')} + more`
}

function formatReviews(tutor: TutorWithReviews) {
  if (tutor.reviewCount === 0 || tutor.reviewAverage === null) {
    return 'No completed-booking reviews yet'
  }

  return `${tutor.reviewAverage.toFixed(1)} from ${tutor.reviewCount} ${
    tutor.reviewCount === 1 ? 'review' : 'reviews'
  }`
}

export default async function Home() {
  const tutors = await loadHomepageTutors()
  const exampleTutor = tutors[0]

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main>
        <section className="border-b border-stone-200">
          <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
            <div className="px-4 py-12 sm:py-16 lg:py-20 lg:pr-16">
              <p className="flex items-center gap-3 text-xs font-bold uppercase text-emerald-800">
                <span className="h-1 w-8 bg-amber-400" aria-hidden="true" />
                TutorConnect Gambia
              </p>
              <h1 className="mt-6 max-w-2xl font-serif text-4xl font-medium leading-tight text-stone-950 sm:text-5xl">
                Good tutoring starts with the right match.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
                Find a tutor for Quran, school, exams, or professional courses.
                Compare by subject, area, price, availability, and review level.
              </p>
              <div className="mt-8">
                <MarketplaceSearch />
              </div>
            </div>

            <div className="hidden bg-emerald-900 px-4 py-10 text-white sm:block sm:px-8 lg:px-12 lg:py-14">
              <div className="h-full border border-emerald-700 p-5 sm:p-7">
                <p className="flex items-center gap-3 text-xs font-bold uppercase text-emerald-100">
                  <span className="h-1 w-8 bg-amber-300" aria-hidden="true" />
                  One marketplace, two clear routes
                </p>
                <h2 className="mt-6 max-w-lg font-serif text-3xl font-medium leading-tight sm:text-4xl">
                  Learn nearby in The Gambia or online from abroad.
                </h2>

                <div className="mt-9 grid border-y border-emerald-700 sm:grid-cols-2 sm:divide-x sm:divide-emerald-700">
                  <div className="py-6 sm:pr-6">
                    <p className="text-xs font-bold uppercase text-emerald-200">In The Gambia</p>
                    <h3 className="mt-2 font-serif text-2xl">Subject + area</h3>
                    <p className="mt-3 text-sm leading-6 text-emerald-100">
                      School subjects, exams, professional courses, Quran, and languages.
                    </p>
                    <div className="mt-5 flex items-center" aria-hidden="true">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      <span className="h-px w-10 bg-emerald-400" />
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      <span className="h-px w-10 bg-emerald-400" />
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                    </div>
                  </div>

                  <div className="border-t border-emerald-700 py-6 sm:border-t-0 sm:pl-6">
                    <p className="text-xs font-bold uppercase text-emerald-200">
                      For Gambians abroad
                    </p>
                    <h3 className="mt-2 font-serif text-2xl">Online Quran</h3>
                    <p className="mt-3 text-sm leading-6 text-emerald-100">
                      Quran Reading with Tajweed, Hifz (Quran memorisation), Arabic
                      Language, and Islamic Studies.
                    </p>
                    <div className="mt-5 flex items-center" aria-hidden="true">
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      <span className="h-px w-10 bg-emerald-400" />
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      <span className="h-px w-10 bg-emerald-400" />
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                    </div>
                  </div>
                </div>

                {exampleTutor ? (
                  <Link
                    href={`/tutor/${exampleTutor.id}`}
                    className="mt-8 grid gap-4 bg-stone-50 p-5 text-stone-950 transition-colors hover:bg-white sm:grid-cols-2"
                  >
                    <div>
                      <span className="text-xs font-bold uppercase text-emerald-800">
                        Current tutor profile
                      </span>
                      <strong className="mt-2 block">
                        {formatPublicTutorName(exampleTutor.name)} -{' '}
                        {normalizeTutorSubjects(exampleTutor.subjects)[0] ||
                          'Subjects on profile'}
                      </strong>
                    </div>
                    <div className="border-t border-stone-200 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
                      <strong className="block">{formatRate(exampleTutor.hourly_rate)}</strong>
                      <span className="mt-1 block text-xs text-stone-500">
                        Open the profile to compare details
                      </span>
                    </div>
                  </Link>
                ) : (
                  <Link
                    href="/find-tutor"
                    className="mt-8 block bg-stone-50 p-5 font-bold text-emerald-900 transition-colors hover:bg-white"
                  >
                    Browse the tutor directory
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="tutors" className="mx-auto max-w-7xl px-4 py-14 md:py-20">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-3xl font-medium text-stone-950 sm:text-4xl">
                Tutors currently available
              </h2>
              <p className="mt-2 text-stone-600">
                Real profiles, organised around the information families need to compare.
              </p>
            </div>
            <Link
              href="/find-tutor"
              className="inline-flex min-h-12 items-center self-start border-b-2 border-emerald-700 font-bold text-emerald-800 hover:text-emerald-950"
            >
              Browse the full directory
            </Link>
          </div>

          <div className="mt-8 grid gap-7 lg:grid-cols-3">
            <div className="border-t-4 border-stone-950 bg-white lg:col-span-2">
              {tutors.length > 0 ? (
                tutors.slice(0, 3).map((tutor) => {
                  const publicName = formatPublicTutorName(tutor.name)
                  const displaySubjects = normalizeTutorSubjects(tutor.subjects)
                  return (
                    <article
                      key={tutor.id}
                      className="grid gap-5 border-b border-stone-200 p-5 sm:grid-cols-3 sm:p-6"
                    >
                      <div className="sm:col-span-2">
                        <div className="flex items-start gap-4">
                          <Avatar
                            name={publicName}
                            photoUrl={tutor.profile_photo_url}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-stone-950">{publicName}</h3>
                              <VerificationBadge status={tutor.verification_status} />
                            </div>
                            <p className="mt-1 text-sm text-stone-600">
                              {tutor.location || 'Online'}
                              {tutor.offers_online ? ' - Online lessons available' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {displaySubjects.slice(0, 3).map((subject) => (
                            <span
                              key={subject}
                              className="border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700"
                            >
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-stone-200 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
                        <p className="font-bold text-stone-950">{formatRate(tutor.hourly_rate)}</p>
                        <p className="mt-2 text-sm text-stone-500">
                          {formatAvailability(tutor.available_days)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">{formatReviews(tutor)}</p>
                        <Link
                          href={`/tutor/${tutor.id}`}
                          className="mt-4 inline-flex min-h-12 items-center font-bold text-emerald-800 hover:text-emerald-950"
                        >
                          View profile
                          <span className="ml-2" aria-hidden="true">
                            -&gt;
                          </span>
                        </Link>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="p-8 text-stone-600">
                  <p>Tutor profiles are being updated.</p>
                  <Link
                    href="/find-tutor"
                    className="mt-4 inline-flex min-h-12 items-center font-bold text-emerald-800"
                  >
                    Search the full directory
                  </Link>
                </div>
              )}
            </div>

            <aside
              id="compare-guide"
              className="border-t-4 border-stone-950 bg-white p-6 sm:p-7"
            >
              <p className="flex items-center gap-3 text-xs font-bold uppercase text-emerald-800">
                <span className="h-1 w-8 bg-amber-400" aria-hidden="true" />
                Choose with confidence
              </p>
              <h2 className="mt-6 font-serif text-3xl font-medium leading-tight text-stone-950">
                A simple way to compare tutors
              </h2>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                You do not need to send us a message or wait for a recommendation.
                Use the same three checks for every profile.
              </p>

              <ol className="mt-6">
                <li className="grid grid-cols-6 gap-3 border-t border-stone-200 py-4">
                  <span className="text-xs font-bold text-emerald-800">01</span>
                  <div className="col-span-5">
                    <h3 className="font-bold text-stone-950">Check the match</h3>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Confirm the subject, learner level, lesson format, and area.
                    </p>
                  </div>
                </li>
                <li className="grid grid-cols-6 gap-3 border-t border-stone-200 py-4">
                  <span className="text-xs font-bold text-emerald-800">02</span>
                  <div className="col-span-5">
                    <h3 className="font-bold text-stone-950">Compare the evidence</h3>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Review price, availability, profile review level, and completed-booking reviews.
                    </p>
                  </div>
                </li>
                <li className="grid grid-cols-6 gap-3 border-y border-stone-200 py-4">
                  <span className="text-xs font-bold text-emerald-800">03</span>
                  <div className="col-span-5">
                    <h3 className="font-bold text-stone-950">Meet before committing</h3>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Use the 45-minute intro session when you want a first meeting.
                    </p>
                  </div>
                </li>
              </ol>

              <Link
                href="/find-tutor"
                className="mt-6 flex min-h-12 items-center justify-center bg-stone-950 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-900"
              >
                Browse and compare tutors
              </Link>
            </aside>
          </div>
        </section>

        <section className="bg-sky-950 text-white">
          <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
            <div className="px-4 py-14 sm:py-16 lg:pr-16">
              <p className="flex items-center gap-3 text-xs font-bold uppercase text-sky-200">
                <span className="h-1 w-8 bg-amber-300" aria-hidden="true" />
                Gambian teachers, wherever home is
              </p>
              <h2 className="mt-6 max-w-xl font-serif text-3xl font-medium leading-tight sm:text-4xl">
                Online Quran for families abroad
              </h2>
              <p className="mt-5 max-w-xl leading-7 text-sky-100">
                Find Gambian teachers for Quran Reading with Tajweed, Hifz
                (Quran memorisation), Arabic Language, and Islamic Studies. Compare
                teaching focus and availability before sending a lesson request.
              </p>
              <Link
                href="/online-quran#quran-tutors"
                className="mt-7 inline-flex min-h-12 items-center border-b-2 border-sky-300 font-bold text-white hover:text-sky-100"
              >
                Meet online Quran tutors
              </Link>
            </div>

            <div className="bg-sky-50 p-4 text-stone-950 sm:p-8 lg:p-12">
              <div className="grid border border-sky-200 sm:grid-cols-2">
                {[
                  [
                    QURAN_READING_WITH_TAJWEED,
                    'Build confident reading, pronunciation, and recitation together.',
                  ],
                  [
                    HIFZ_QURAN_MEMORISATION,
                    "Plan memorisation lessons around the learner's pace.",
                  ],
                  ['Arabic Language', 'Find language support from Gambian Quran teachers.'],
                  ['Islamic Studies', 'Find related teaching in the same directory.'],
                ].map(([title, description], index) => (
                  <div
                    key={title}
                    className={`min-h-36 p-5 ${
                      index < 3 ? 'border-b border-sky-200' : ''
                    } ${index === 2 ? 'sm:border-b-0' : ''} ${
                      index % 2 === 0 ? 'sm:border-r sm:border-sky-200' : ''
                    }`}
                  >
                    <h3 className="font-serif text-xl font-bold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-sky-950">
                Families and tutors agree on suitable lesson times before payment is requested.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3 md:items-center md:py-16">
            <div className="md:col-span-2">
              <p className="text-xs font-bold uppercase text-emerald-800">For tutors</p>
              <h2 className="mt-3 font-serif text-3xl font-medium text-stone-950">
                Teach what you know.
              </h2>
              <p className="mt-3 max-w-2xl leading-7 text-stone-600">
                Create your profile, choose what and where you teach, set your price,
                and submit your information for review.
              </p>
            </div>
            <Link
              href="/register/tutor"
              className="flex min-h-12 items-center justify-center bg-emerald-800 px-6 py-3 font-bold text-white transition-colors hover:bg-emerald-900 md:justify-self-end"
            >
              Create a tutor account
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
