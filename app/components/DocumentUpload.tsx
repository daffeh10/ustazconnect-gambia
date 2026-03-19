'use client'

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type DocumentType = 'national_id' | 'certificate' | 'cv'

interface DocumentUploadProps {
  tutorId: string
  documentType: DocumentType
  label: string
}

interface TutorDocumentRow {
  id: string
  document_name: string
  document_url: string
  status: string | null
  rejection_reason: string | null
  uploaded_at: string | null
}

function getStatusBadge(status?: string | null) {
  const normalized = (status || 'pending').toLowerCase()

  if (normalized === 'approved') {
    return {
      text: 'Approved',
      classes: 'bg-emerald-100 text-emerald-700',
    }
  }

  if (normalized === 'rejected') {
    return {
      text: 'Rejected',
      classes: 'bg-red-100 text-red-700',
    }
  }

  return {
    text: 'Pending',
    classes: 'bg-amber-100 text-amber-700',
  }
}

export default function DocumentUpload({ tutorId, documentType, label }: DocumentUploadProps) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [documentRow, setDocumentRow] = useState<TutorDocumentRow | null>(null)

  const loadDocument = useCallback(async () => {
    if (!tutorId) {
      setIsLoading(false)
      setDocumentRow(null)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { data, error: fetchError } = await supabase
        .from('tutor_documents')
        .select('id,document_name,document_url,status,rejection_reason,uploaded_at')
        .eq('tutor_id', tutorId)
        .eq('document_type', documentType)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle<TutorDocumentRow>()

      if (fetchError) throw fetchError
      setDocumentRow(data || null)
    } catch (err) {
      console.error(err)
      setError('Could not load document status. Please refresh.')
    } finally {
      setIsLoading(false)
    }
  }, [documentType, supabase, tutorId])

  useEffect(() => {
    void loadDocument()
  }, [loadDocument])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      alert('Please upload an image or PDF file.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB. Please choose a smaller file.')
      event.target.value = ''
      return
    }

    setIsUploading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        throw new Error('You are not signed in. Please sign in again and retry.')
      }

      const safeFilename = file.name.replace(/\s+/g, '-')
      const filePath = `${tutorId}/${documentType}/${Date.now()}-${safeFilename}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        const storageError = new Error(`Storage upload failed: ${uploadError.message}`)
        ;(storageError as Error & { code?: string }).code = uploadError.name || 'storage_upload_error'
        throw storageError
      }

      const { error: insertError } = await supabase.from('tutor_documents').insert([
        {
          tutor_id: tutorId,
          document_type: documentType,
          document_name: file.name,
          document_url: filePath,
          status: 'pending',
          rejection_reason: null,
        },
      ])

      if (insertError) {
        const tableError = new Error(`Document record insert failed: ${insertError.message}`)
        ;(tableError as Error & { code?: string }).code = insertError.code || 'table_insert_error'
        throw tableError
      }

      await loadDocument()
    } catch (err) {
      console.error(err)
      const errorMessage =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message.toLowerCase()
          : ''
      const errorCode =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code.toLowerCase()
          : ''

      if (
        errorMessage.includes('bucket not found') ||
        errorMessage.includes('no such bucket') ||
        errorMessage.includes('bucket does not exist')
      ) {
        setError('The documents storage bucket is missing or misconfigured. Please verify the bucket name is exactly "documents".')
      } else if (
        errorMessage.includes('row-level security') ||
        errorMessage.includes('permission denied') ||
        errorCode === '42501'
      ) {
        setError(`Upload blocked by permissions. ${errorMessage || 'Please apply documents bucket and tutor_documents RLS policies in Supabase.'}`)
      } else if (errorMessage.includes('not signed in') || errorMessage.includes('jwt')) {
        setError('Your session expired. Please sign out, sign in again, then retry upload.')
      } else {
        const readableError =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : ''
        setError(readableError ? `Upload failed: ${readableError}` : 'Upload failed. Please try again.')
      }
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const statusBadge = getStatusBadge(documentRow?.status)

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {!isLoading && documentRow && (
          <span className={`${statusBadge.classes} px-2.5 py-1 rounded-full text-xs font-medium`}>
            {statusBadge.text}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 mt-2">Loading document status...</p>
      ) : documentRow ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm text-gray-600">{documentRow.document_name}</p>
          {documentRow.uploaded_at && (
            <p className="text-xs text-gray-500">
              Uploaded {new Date(documentRow.uploaded_at).toLocaleDateString('en-GB')}
            </p>
          )}
          {documentRow.status?.toLowerCase() === 'rejected' && documentRow.rejection_reason && (
            <p className="text-sm text-red-700 mt-1">{documentRow.rejection_reason}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-2">No file uploaded yet.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="mt-3 bg-white text-gray-700 font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isUploading ? 'Uploading...' : documentRow ? 'Replace File' : 'Upload File'}
      </button>

      {error && (
        <p className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
