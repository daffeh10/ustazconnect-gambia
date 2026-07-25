import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import Footer from '@/app/components/Footer'
import { formatForeignEstimate } from '@/lib/currency-estimates'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPublicTutorName } from '@/lib/tutor-review'

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
      .contains('subjects', ['Quran Reading'])
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
              <h1 className="text-3xl font-bold text-gray-900 md:text-5xl">Trusted Gambian Quran teachers online</h1>
              <p className="mt-5 text-lg text-gray-600">
                For Gambian families abroad who want Quran reading, Tajweed, Hifz, Arabic, or Islamic Studies with teachers who understand the culture and can teach online.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/find-tutor?subject=Quran%20Reading&online=1" className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700">
                  Browse Quran Tutors
                </Link>
                <Link href="/register/tutor" className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 hover:bg-gray-50">
                  Register as Quran Tutor
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Available Online Quran Tutors</h2>
            <p className="mt-2 text-gray-600">Charges are processed in GMD. Foreign-currency amounts are approximate guidance only.</p>
          </div>

          {tutors.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-600">
              Online Quran tutor listings are being reviewed. Check back soon or browse all tutors.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {tutors.map((tutor) => (
                <article key={tutor.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">{formatPublicTutorName(tutor.name || 'Tutor')}</h3>
                  <p className="mt-2 text-sm text-gray-600">{(tutor.subjects || []).slice(0, 3).join(', ')}</p>
                  <p className="mt-3 text-sm font-medium text-gray-900">
                    GMD {(tutor.hourly_rate || 0).toLocaleString()}/hour · {formatForeignEstimate(tutor.hourly_rate || 0)}
                  </p>
                  {tutor.bio && <p className="mt-3 text-sm text-gray-600">{tutor.bio.slice(0, 120)}</p>}
                  <Link href={`/tutor/${tutor.id}`} className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
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
