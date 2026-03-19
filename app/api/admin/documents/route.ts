import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'

interface DocumentRow {
  id: string
  tutor_id: string
  document_type: string
  document_name: string
  document_url: string
  status: string | null
  rejection_reason: string | null
  uploaded_at: string | null
}

interface TutorRow {
  id: string
  name: string | null
  email: string | null
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data: docs, error: docsError } = await supabase
      .from('tutor_documents')
      .select('id,tutor_id,document_type,document_name,document_url,status,rejection_reason,uploaded_at')
      .eq('status', 'pending')
      .order('uploaded_at', { ascending: true })

    if (docsError) throw docsError

    const documents = (docs ?? []) as DocumentRow[]
    const tutorIds = Array.from(new Set(documents.map((doc) => doc.tutor_id)))
    let tutorMap: Record<string, { name: string; email: string }> = {}

    if (tutorIds.length > 0) {
      const { data: tutors, error: tutorsError } = await supabase
        .from('tutor_profiles')
        .select('id,name,email')
        .in('id', tutorIds)

      if (tutorsError) throw tutorsError

      tutorMap = ((tutors ?? []) as TutorRow[]).reduce<Record<string, { name: string; email: string }>>(
        (acc, tutor) => {
          acc[tutor.id] = {
            name: tutor.name?.trim() || 'Tutor',
            email: tutor.email?.trim() || 'No email',
          }
          return acc
        },
        {}
      )
    }

    const enrichedDocuments = await Promise.all(
      documents.map(async (document) => {
        const { data: signedUrlData } = await supabase.storage
          .from('documents')
          .createSignedUrl(document.document_url, 60)

        return {
          ...document,
          tutor_name: tutorMap[document.tutor_id]?.name || 'Tutor',
          tutor_email: tutorMap[document.tutor_id]?.email || 'No email',
          signed_url: signedUrlData?.signedUrl || null,
        }
      })
    )

    return NextResponse.json({ documents: enrichedDocuments })
  } catch (error) {
    console.error('admin documents fetch failed', error)
    return NextResponse.json({ error: 'Could not load pending documents.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const documentId = typeof body?.documentId === 'string' ? body.documentId.trim() : ''
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : ''
    const rejectionReason = typeof body?.rejectionReason === 'string' ? body.rejectionReason.trim() : ''

    if (!documentId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('tutor_documents')
      .update({
        status,
        rejection_reason: status === 'rejected' ? rejectionReason || null : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin documents update failed', error)
    return NextResponse.json({ error: 'Could not update document status.' }, { status: 500 })
  }
}
