import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import Avatar from '@/app/components/Avatar'
import { formatForeignEstimate } from '@/lib/currency-estimates'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPublicTutorName } from '@/lib/tutor-review'
import {
  HIFZ_QURAN_MEMORISATION,
  normalizeTutorSubjects,
  QURAN_READING_WITH_TAJWEED,
} from '@/lib/tutor-subjects'

export const metadata: Metadata = {
  title: 'Trusted Gambian Quran Teachers Online | TutorConnect Gambia',
  description:
    'Book verified Gambian Quran teachers for online lessons with diaspora-friendly scheduling. Pay securely in GMD with approximate USD, GBP, and EUR guidance.',
}

export const dynamic = 'force-dynamic'

interface QuranTutor {
  id: string
  name: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  profile_photo_url: string | null
  verification_status: string | null
}

async function loadQuranTutors() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tutor_profiles')
      .select('id,name,subjects,hourly_rate,bio,profile_photo_url,verification_status,quran_verifications!inner(status)')
      .eq('is_approved', true)
      .eq('is_active', true)
      .eq('offers_online', true)
      .overlaps('subjects', [
        QURAN_READING_WITH_TAJWEED,
        'Quran Reading',
        'Tajweed',
        HIFZ_QURAN_MEMORISATION,
        'Hifz',
        'Hifz (Memorization)',
        'Hifz (Memorisation)',
        'Arabic Language',
        'Arabic',
        'Islamic Studies',
      ])
      .eq('quran_verifications.status', 'approved')
      .order('created_at', { ascending: false })
      .limit(12)

    if (error) throw error
    return (data ?? []) as QuranTutor[]
  } catch (error) {
    console.error('online quran tutors failed to load', error)
    return []
  }
}

export default async function OnlineQuranPage() {
  const tutors = await loadQuranTutors()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main>
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase text-sky-700">For Gambians abroad</p>
              <h1 className="mt-3 text-3xl font-bold text-gray-900 md:text-5xl">Learn Quran online with verified Gambian teachers</h1>
              <p className="mt-5 text-lg text-gray-600">
                For families abroad looking for Quran Reading with Tajweed, Hifz
                (Quran memorisation), Arabic Language, or Islamic Studies with teachers
                who understand Gambian families and can arrange lessons across time zones.
              </p>
              <p className="mt-4 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                Tutors listed here have passed TutorConnect&apos;s dedicated Quran review.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="#quran-tutors" className="inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700">
                  View Quran Tutors
                </Link>
                <Link href="/register/tutor" className="inline-flex min-h-12 items-center rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 hover:bg-gray-50">
                  Apply as a Quran Tutor
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="quran-tutors" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Available Online Quran Tutors</h2>
            <p className="mt-2 text-gray-600">Charges are processed in GMD. Foreign-currency amounts are approximate guidance only.</p>
          </div>

          {tutors.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-600">
              <p>Quran tutor profiles are still being reviewed. Please check again soon or contact TutorConnect for help finding a teacher.</p>
              <a
                href="mailto:tutorconnectgambia@gmail.com?subject=Help%20finding%20an%20online%20Quran%20teacher"
                className="mt-5 inline-flex min-h-12 items-center font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Contact TutorConnect
              </a>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {tutors.map((tutor) => (
                <article key={tutor.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={formatPublicTutorName(tutor.name || 'Tutor')}
                      photoUrl={tutor.profile_photo_url}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-gray-900">{formatPublicTutorName(tutor.name || 'Tutor')}</h3>
                      <p className="text-sm font-medium text-emerald-700">Quran review passed</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    {normalizeTutorSubjects(tutor.subjects).slice(0, 3).join(', ')}
                  </p>
                  <p className="mt-3 text-sm font-medium text-gray-900">
                    GMD {(tutor.hourly_rate || 0).toLocaleString()}/hour · {formatForeignEstimate(tutor.hourly_rate || 0)}
                  </p>
                  {tutor.bio && <p className="mt-3 text-sm text-gray-600">{tutor.bio.slice(0, 120)}</p>}
                  <Link href={`/tutor/${tutor.id}?lessonFormat=online`} className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700">
                    View Profile
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
