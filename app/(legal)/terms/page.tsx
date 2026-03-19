import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-emerald-600 hover:underline">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-1">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

      <div className="text-base text-gray-700 leading-relaxed">
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">What TutorConnect Gambia Does</h2>
        <p>
          TutorConnect Gambia helps families and students find in-person tutors across The Gambia.
          We introduce tutors and learners, support bookings, and help manage trust and communication
          on the platform. We are not a school and we do not guarantee exam results.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Rules for Tutors</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Show up on time and give proper notice if you need to cancel.</li>
          <li>Be honest about your qualifications, experience, and subjects.</li>
          <li>Behave professionally in family homes and around students.</li>
          <li>Do not ask families to pay you directly outside the platform.</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Rules for Families</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Pay agreed fees on time and use the proper booking process.</li>
          <li>Treat tutors respectfully and provide a safe learning environment.</li>
          <li>Give accurate information about the student and lesson needs.</li>
          <li>Report serious concerns honestly and without abuse.</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Disputes</h2>
        <p>
          If there is a disagreement about attendance, conduct, or payments, contact us at
          info@tutorconnect.gm. We review the issue and aim to respond within 7 days.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Suspension and Removal</h2>
        <p>
          We may suspend or remove accounts for off-platform payments, abuse, repeated no-shows,
          false qualifications, harassment, or any conduct that puts students or families at risk.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Governing Law</h2>
        <p>These terms are governed by the laws of the Republic of The Gambia.</p>
      </div>
    </main>
  )
}
