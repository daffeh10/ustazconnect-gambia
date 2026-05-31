import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin'
import {
  getTutorDocumentTypeLabel,
  getTutorReviewPathFromApprovedDocumentTypes,
} from '@/lib/tutor-review'

interface TutorRow {
  id: string
  name: string
  email: string
  phone: string | null
  location: string | null
  subjects: string[] | null
  hourly_rate: number | null
  bio: string | null
  profile_photo_url: string | null
  verification_status: string | null
  created_at: string
}

interface TutorDocumentRow {
  tutor_id: string
  document_type: string
  status: string | null
  uploaded_at: string | null
}

function daysSince(dateString: string) {
  const createdAt = new Date(dateString).getTime()
  if (Number.isNaN(createdAt)) return 0
  return Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)))
}

function getLatestDocumentStatusByType(documents: TutorDocumentRow[]) {
  const latestStatusByType = new Map<string, string>()

  for (const document of documents) {
    const normalizedType = document.document_type.toLowerCase().trim()
    if (!latestStatusByType.has(normalizedType)) {
      latestStatusByType.set(
        normalizedType,
        (document.status || 'pending').toLowerCase().trim()
      )
    }
  }

  return latestStatusByType
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tutor_profiles')
      .select(
        'id,name,email,phone,location,subjects,hourly_rate,bio,profile_photo_url,verification_status,created_at'
      )
      .eq('is_approved', false)
      .order('created_at', { ascending: true })

    if (error) throw error

    const tutors = (data ?? []) as TutorRow[]
    const tutorIds = tutors.map((tutor) => tutor.id)
    let allDocuments: TutorDocumentRow[] = []

    if (tutorIds.length > 0) {
      const { data: documents, error: documentsError } = await supabase
        .from('tutor_documents')
        .select('tutor_id,document_type,status,uploaded_at')
        .in('tutor_id', tutorIds)
        .order('uploaded_at', { ascending: false })

      if (documentsError) throw documentsError
      allDocuments = (documents ?? []) as TutorDocumentRow[]
    }

    const documentsByTutorId = new Map<string, TutorDocumentRow[]>()
    for (const document of allDocuments) {
      const tutorDocuments = documentsByTutorId.get(document.tutor_id) ?? []
      tutorDocuments.push(document)
      documentsByTutorId.set(document.tutor_id, tutorDocuments)
    }

    const enrichedTutors = tutors.map((tutor) => {
      const latestStatusByType = getLatestDocumentStatusByType(
        documentsByTutorId.get(tutor.id) ?? []
      )
      const approvedDocumentTypes = Array.from(latestStatusByType.entries())
        .filter(([, status]) => status === 'approved')
        .map(([documentType]) => documentType)
      const reviewPath = getTutorReviewPathFromApprovedDocumentTypes(approvedDocumentTypes)

      return {
        ...tutor,
        applied_days_ago: daysSince(tutor.created_at),
        has_profile_photo: Boolean(tutor.profile_photo_url),
        review_path: reviewPath,
        can_approve: Boolean(tutor.profile_photo_url) && Boolean(reviewPath),
        document_statuses: Array.from(latestStatusByType.entries()).map(
          ([documentType, status]) => ({
            document_type: documentType,
            document_label: getTutorDocumentTypeLabel(documentType),
            status,
          })
        ),
      }
    })

    return NextResponse.json({ tutors: enrichedTutors })
  } catch (error) {
    console.error('admin tutors fetch failed', error)
    return NextResponse.json({ error: 'Could not load pending tutors.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const tutorId = typeof body?.tutorId === 'string' ? body.tutorId.trim() : ''
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : ''

    if (!tutorId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (action === 'approve') {
      const tutorResult = await supabase
        .from('tutor_profiles')
        .select('id,profile_photo_url')
        .eq('id', tutorId)
        .single()
      const tutor = tutorResult.data as { id: string; profile_photo_url: string | null } | null
      const tutorError = tutorResult.error

      if (tutorError) throw tutorError

      if (!tutor?.profile_photo_url) {
        return NextResponse.json(
          { error: 'A profile photo is required before this tutor can be approved.' },
          { status: 400 }
        )
      }

      const { data: documents, error: documentsError } = await supabase
        .from('tutor_documents')
        .select('tutor_id,document_type,status,uploaded_at')
        .eq('tutor_id', tutorId)
        .order('uploaded_at', { ascending: false })

      if (documentsError) throw documentsError

      const latestStatusByType = getLatestDocumentStatusByType(
        (documents ?? []) as TutorDocumentRow[]
      )
      const approvedDocumentTypes = Array.from(latestStatusByType.entries())
        .filter(([, status]) => status === 'approved')
        .map(([documentType]) => documentType)
      const reviewPath = getTutorReviewPathFromApprovedDocumentTypes(approvedDocumentTypes)

      if (!reviewPath) {
        return NextResponse.json(
          {
            error:
              'Approve a qualification document, current study proof, or teaching reference before listing this tutor.',
          },
          { status: 400 }
        )
      }

      const { error: approveError } = await supabase
        .from('tutor_profiles')
        .update({
          is_approved: true,
          verification_status: reviewPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tutorId)

      if (approveError) throw approveError

      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase
      .from('tutor_profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', tutorId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin tutor update failed', error)
    return NextResponse.json({ error: 'Could not update tutor approval.' }, { status: 500 })
  }
}
