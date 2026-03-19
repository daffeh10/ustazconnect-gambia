import Link from 'next/link'

export default function RefundPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-emerald-600 hover:underline">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-1">Refund Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

      <div className="text-base text-gray-700 leading-relaxed">
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">If the Tutor Cancels Early</h2>
        <p>
          If a tutor cancels before any lesson has taken place, the family is entitled to a full
          refund for that booking.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">First-Lesson Refund</h2>
        <p>
          If the first lesson happens and the family is not satisfied, a refund request may be made
          within 48 hours. We will review the case before confirming the refund.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">After Two or More Lessons</h2>
        <p>
          No refund is available after two or more lessons have been completed, except where the
          law requires otherwise or there is clear fraud or safety misconduct.
        </p>
      </div>
    </main>
  )
}
