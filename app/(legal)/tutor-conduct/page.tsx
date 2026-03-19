import Link from 'next/link'

export default function TutorConductPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-emerald-600 hover:underline">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-1">Tutor Code of Conduct</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

      <div className="text-base text-gray-700 leading-relaxed">
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Punctuality</h2>
        <p>
          Tutors are expected to arrive on time and to give at least 24 hours notice when they need
          to cancel or reschedule, except in genuine emergencies.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Professionalism</h2>
        <p>
          Tutors must behave respectfully in family homes, maintain appropriate communication, and
          present themselves honestly and professionally at all times.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">No Direct Payments</h2>
        <p>
          Tutors must not request or accept direct off-platform payments for lessons arranged
          through TutorConnect Gambia.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Student Safety</h2>
        <p>
          Tutors must always act in ways that protect the safety, dignity, and wellbeing of
          students. Any inappropriate conduct, harassment, or unsafe behaviour may lead to immediate
          action.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Consequences</h2>
        <p>
          Violations may lead to a warning, temporary suspension, or permanent ban depending on the
          seriousness and frequency of the issue.
        </p>
      </div>
    </main>
  )
}
