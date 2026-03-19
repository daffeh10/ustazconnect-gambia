import { Suspense } from 'react'
import AdminLoginClient from './AdminLoginClient'

function AdminLoginFallback() {
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Admin Portal
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">Sign in to Admin</h1>
            <p className="mt-2 text-sm text-gray-400">Loading admin login...</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginFallback />}>
      <AdminLoginClient />
    </Suspense>
  )
}
