import Link from 'next/link'
import Header from './components/Header'
import Footer from './components/Footer'
import Avatar from './components/Avatar'
import MarketplaceSearch from './components/MarketplaceSearch'
import VerificationBadge from './components/VerificationBadge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPublicTutorName } from '@/lib/tutor-review'
import { normalizeTutorSubjects } from '@/lib/tutor-subjects'
import {
  compareHomepageTutors,
  HOMEPAGE_TUTOR_COUNT,
  HOMEPAGE_TUTOR_POOL_SIZE,
} from '@/lib/tutor-ranking'
import { formatTutorGenderLabel } from '@/lib/tutor-profile'

export const dynamic = 'force-dynamic'

interface HomepageTutor {
  id: string
  created_at: string | null
  name: string
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  profile_photo_url: string | null
  verification_status: string | null
  gender?: string | null
}

interface TutorReview {
  tutor_id: string
  rating: number
}

interface TutorWithReviews extends HomepageTutor {
  reviewCount: number
  reviewAverage: number | null
}

const LEGACY_HOMEPAGE_TUTOR_SELECT =
  'id,name,location,subjects,hourly_rate,profile_photo_url,verification_status,created_at'
const ENHANCED_HOMEPAGE_TUTOR_SELECT = `${LEGACY_HOMEPAGE_TUTOR_SELECT},gender`
const PUBLIC_HOMEPAGE_TUTOR_SELECT = `${ENHANCED_HOMEPAGE_TUTOR_SELECT},is_test_account`

async function loadHomepageTutors(): Promise<TutorWithReviews[]> {
  try {
    const supabase = createAdminClient()
    const primaryResult = await supabase
      .from('public_tutors')
      .select(PUBLIC_HOMEPAGE_TUTOR_SELECT)
      .eq('is_test_account', false)
      .order('created_at', { ascending: false })
      .limit(HOMEPAGE_TUTOR_POOL_SIZE)
    let tutorRows = (primaryResult.data ?? null) as HomepageTutor[] | null
    let tutorError = primaryResult.error

    if (tutorError) {
      const enhancedResult = await supabase
        .from('public_tutors')
        .select(ENHANCED_HOMEPAGE_TUTOR_SELECT)
        .order('created_at', { ascending: false })
        .limit(HOMEPAGE_TUTOR_POOL_SIZE)

      tutorRows = (enhancedResult.data ?? null) as HomepageTutor[] | null
      tutorError = enhancedResult.error
    }

    if (tutorError) {
      const fallbackResult = await supabase
        .from('public_tutors')
        .select(LEGACY_HOMEPAGE_TUTOR_SELECT)
        .order('created_at', { ascending: false })
        .limit(HOMEPAGE_TUTOR_POOL_SIZE)

      tutorRows = (fallbackResult.data ?? null) as HomepageTutor[] | null
      tutorError = fallbackResult.error
    }

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

    const scoredTutors = tutors.map((tutor) => {
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

    return scoredTutors.sort(compareHomepageTutors).slice(0, HOMEPAGE_TUTOR_COUNT)
  } catch (error) {
    console.error('Homepage tutors failed to load', error)
    return []
  }
}

function formatRate(rate: number | null) {
  return rate ? `GMD ${rate.toLocaleString()}/hour` : 'See profile for rate'
}

function formatReviews(tutor: TutorWithReviews): string | null {
  if (tutor.reviewCount === 0 || tutor.reviewAverage === null) {
    return null
  }

  return `${tutor.reviewAverage.toFixed(1)} from ${tutor.reviewCount} ${
    tutor.reviewCount === 1 ? 'review' : 'reviews'
  }`
}

export default async function Home() {
  const tutors = await loadHomepageTutors()

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main>
        <section className="border-b border-emerald-100 bg-emerald-50">
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 text-center md:pb-14 md:pt-14">
            <p className="mb-3 text-sm font-semibold uppercase text-emerald-700">
              TutorConnect Gambia
            </p>
            <h1 className="mx-auto max-w-4xl text-3xl font-bold text-gray-950 md:text-5xl">
              Find the right tutor in The Gambia
            </h1>
            <p className="mx-auto mb-8 mt-4 max-w-3xl text-lg text-gray-600">
              Find tutors for Quran Reading with Tajweed, General Mathematics,
              Physics, English Language, WASSCE, Cambridge IGCSE, and more. Compare
              by subject, area, price, availability, and review level.
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
              <p className="mt-1 text-gray-600">
                Open a profile to compare the details that matter to you.
              </p>
            </div>
            <Link
              href="/find-tutor"
              className="hidden font-semibold text-emerald-700 hover:text-emerald-800 sm:block"
            >
              View all tutors
            </Link>
          </div>

          {tutors.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tutors.map((tutor) => {
                const publicName = formatPublicTutorName(tutor.name)
                const displaySubjects = normalizeTutorSubjects(tutor.subjects)
                const reviewSummary = formatReviews(tutor)
                const genderLabel = formatTutorGenderLabel(tutor.gender)

                return (
                  <article
                    key={tutor.id}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={publicName}
                        photoUrl={tutor.profile_photo_url}
                        size="md"
                      />
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-gray-950">{publicName}</h3>
                        <p className="truncate text-sm text-gray-500">
                          {tutor.location || 'Location being updated'}
                        </p>
                        {genderLabel && (
                          <p className="text-sm font-medium text-gray-600">{genderLabel}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <VerificationBadge status={tutor.verification_status} />
                    </div>
                    <p className="mt-4 line-clamp-2 min-h-10 text-sm text-gray-600">
                      {displaySubjects.slice(0, 3).join(', ') || 'Subjects being updated'}
                    </p>
                    <div className="mt-4 space-y-1 text-sm">
                      <p className="font-semibold text-gray-950">
                        {formatRate(tutor.hourly_rate)}
                      </p>
                      {reviewSummary && (
                        <p className="text-gray-500">{reviewSummary}</p>
                      )}
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

        <section className="bg-emerald-700">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center text-white md:py-14">
            <h2 className="text-2xl font-bold">Teach through TutorConnect Gambia</h2>
            <p className="mx-auto mt-4 max-w-2xl text-emerald-50">
              Create your profile, choose what and where you teach, set your price,
              and submit your information for review. Families can then find you and
              send booking requests through the platform.
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
