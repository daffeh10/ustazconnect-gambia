'use client'

import { FormEvent, useEffect, useState } from 'react'
import { DIASPORA_QURAN_ENABLED } from '@/lib/features'

interface AdminRow {
  id: string
  user_id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'quran_verifier'
  is_active: boolean
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<AdminRow['role']>('admin')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [processingId, setProcessingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadAdmins() {
    setError('')
    try {
      const response = await fetch('/api/admin/admins')
      const payload = (await response.json()) as { admins?: AdminRow[]; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not load admins.')
      setAdmins(payload.admins || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not load admins.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAdmins()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, userId: userId.trim() || null, role }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not add admin.')

      setName('')
      setEmail('')
      setUserId('')
      setRole('admin')
      setMessage('Admin added.')
      await loadAdmins()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not add admin.')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateAdmin(adminId: string, action: 'enable' | 'disable' | 'role', nextRole?: AdminRow['role']) {
    setProcessingId(adminId)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, action, role: nextRole || 'admin' }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not update admin.')

      setMessage('Admin updated.')
      await loadAdmins()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update admin.')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Access</h1>
        <p className="text-gray-600 mt-2">Owner-only access for co-founder admins and Quran verifiers.</p>
      </div>

      {message && <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{message}</div>}
      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Add Admin</h2>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input id="admin-name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="admin-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select id="admin-role" value={role} onChange={(event) => setRole(event.target.value as AdminRow['role'])} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500">
              <option value="admin">Admin</option>
              {DIASPORA_QURAN_ENABLED && (
                <option value="quran_verifier">Quran Verifier</option>
              )}
              <option value="owner">Owner</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-user-id" className="block text-sm font-medium text-gray-700 mb-1">Supabase user ID</label>
            <input id="admin-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500" placeholder="Optional for existing users" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {isSaving ? 'Adding...' : 'Add Admin'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Current Admins</h2>
        {isLoading ? (
          <p className="mt-4 text-gray-500">Loading admins...</p>
        ) : admins.length === 0 ? (
          <p className="mt-4 text-gray-500">No admins found.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {admins.map((admin) => (
              <article key={admin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="font-medium text-gray-900">{admin.name}</p>
                  <p className="text-sm text-gray-600">{admin.email} · {admin.role.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500">{admin.is_active ? 'Active' : 'Disabled'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {admin.role !== 'owner' && (
                    <select
                      value={admin.role}
                      onChange={(event) => void updateAdmin(admin.id, 'role', event.target.value as AdminRow['role'])}
                      disabled={processingId === admin.id}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="admin">Admin</option>
                      {DIASPORA_QURAN_ENABLED && (
                        <option value="quran_verifier">Quran Verifier</option>
                      )}
                      {!DIASPORA_QURAN_ENABLED && admin.role === 'quran_verifier' && (
                        <option value="quran_verifier">Quran Verifier (deferred)</option>
                      )}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => void updateAdmin(admin.id, admin.is_active ? 'disable' : 'enable')}
                    disabled={processingId === admin.id}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {admin.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
