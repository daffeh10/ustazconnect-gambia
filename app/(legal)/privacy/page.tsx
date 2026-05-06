import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-emerald-600 hover:underline">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-1">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: May 2026</p>

      <div className="text-base text-gray-700 leading-relaxed">
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">What Data We Collect</h2>
        <p>
          We collect the personal information needed to run the platform. This may include your
          name, email address, phone number, location, profile details, and payment reference
          information linked to lessons or bookings.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">How We Use Your Data</h2>
        <p>
          We use your data to match families with tutors, manage accounts, process booking-related
          actions, and send useful service updates. In some cases, we may use WhatsApp or similar
          contact details to send booking and support notifications.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Your Privacy Rights</h2>
        <p>
          We aim to handle personal information responsibly and in line with The Gambia&apos;s
          Personal Data Protection and Privacy Act, 2025. You can contact us to request access,
          correction, or deletion of the personal data we hold about your account, subject to any
          records we must keep for disputes, fraud prevention, payments, or legal compliance.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">How Long We Keep Data</h2>
        <p>
          We keep account, booking, payment, and support records for as long as they are reasonably
          needed to operate the platform, resolve disputes, prevent abuse, and meet legal or
          financial obligations. When data is no longer needed, we aim to delete it or reduce it to
          the minimum we must keep.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">We Do Not Sell Your Data</h2>
        <p>
          TutorConnect Gambia does not sell your personal information to advertisers, brokers, or
          any outside company. We only use your data to operate and improve the platform.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Account Deletion</h2>
        <p>
          If you want your account removed, email info@tutorconnect.gm. We may keep limited records
          when required for disputes, fraud prevention, or legal compliance.
        </p>
      </div>
    </main>
  )
}
