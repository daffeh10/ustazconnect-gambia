import Link from 'next/link'
import {
  buildAuthEmailActionPath,
  getSafeAuthEmailToken,
  getSafeSupabaseConfirmationUrl,
} from '@/lib/auth-email'

export default function InviteEmailLandingPage({
  searchParams,
}: {
  searchParams: Promise<{
    confirmation_url?: string
    token_hash?: string
    type?: string
  }>
}) {
  return <InviteEmailLanding searchParams={searchParams} />
}

async function InviteEmailLanding({
  searchParams,
}: {
  searchParams: Promise<{
    confirmation_url?: string
    token_hash?: string
    type?: string
  }>
}) {
  const params = await searchParams
  const tokenHash = getSafeAuthEmailToken(params.token_hash, params.type, 'invite')
  const confirmationUrl = getSafeSupabaseConfirmationUrl(params.confirmation_url)
  const actionUrl = tokenHash
    ? buildAuthEmailActionPath(tokenHash, 'invite')
    : confirmationUrl

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto mb-4 max-w-md">
        <Link href="/" className="font-medium text-emerald-700 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="mx-auto max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
        <h1 className="mb-3 text-3xl font-bold text-gray-900 md:text-4xl">
          Accept admin invitation
        </h1>
        <p className="mb-6 text-base text-gray-600">
          Continue to verify your email and create your TutorConnect Gambia password.
        </p>

        {actionUrl ? (
          <a
            href={actionUrl}
            className="block w-full rounded-lg bg-emerald-600 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Continue securely
          </a>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This invitation is incomplete or invalid. Ask the owner to send a new invitation.
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          Invitations expire and can only be used once. Always open the newest invitation email.
        </p>

        <div className="mt-6 text-center">
          <Link href="/admin/login" className="text-sm font-medium text-emerald-700 hover:underline">
            Back to admin sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
