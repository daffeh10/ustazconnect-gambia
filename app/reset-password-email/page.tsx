import Link from 'next/link'

function getSafeConfirmationUrl(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) return null

  try {
    const decoded = decodeURIComponent(value)
    const url = new URL(decoded)

    if (!url.protocol.startsWith('http')) {
      return null
    }

    return decoded
  } catch {
    return null
  }
}

export default function ResetPasswordEmailLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation_url?: string }>
}) {
  return <ResetPasswordEmailLanding searchParams={searchParams} />
}

async function ResetPasswordEmailLanding({
  searchParams,
}: {
  searchParams: Promise<{ confirmation_url?: string }>
}) {
  const params = await searchParams
  const confirmationUrl = getSafeConfirmationUrl(params.confirmation_url)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto mb-4">
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Continue password reset</h1>
        <p className="text-base text-gray-600 mb-6">
          Click the button below to open your secure TutorConnect Gambia password reset page.
        </p>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          For security, this email uses a two-step reset link. This helps prevent email scanners from accidentally consuming your one-time reset link before you use it.
        </div>

        {confirmationUrl ? (
          <a
            href={confirmationUrl}
            className="block w-full rounded-lg bg-emerald-600 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Continue to reset password
          </a>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This reset email is incomplete or invalid. Please request a new one.
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          If you requested more than one reset email, always use the newest one.
        </p>

        <div className="mt-6 text-center">
          <Link href="/forgot-password" className="text-sm font-medium text-emerald-700 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    </div>
  )
}
