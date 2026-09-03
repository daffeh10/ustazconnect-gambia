import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, hasAdminRole } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import {
  TUTOR_REVIEW_CONTACT_EMAIL,
  getTutorDocumentTypeLabel,
  hasReviewDocumentOnFile,
  normalizeTutorVerificationStatus,
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
  is_approved: boolean | null
  verification_status: string | null
  is_test_account: boolean | null
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

function hasCoreProfileDetails(tutor: TutorRow) {
  return Boolean(
    tutor.name?.trim() &&
    tutor.email?.trim() &&
    tutor.phone?.trim() &&
    tutor.location?.trim() &&
    Array.isArray(tutor.subjects) &&
    tutor.subjects.length > 0 &&
    typeof tutor.hourly_rate === 'number' &&
    tutor.hourly_rate > 0
  )
}

/**
 * The gate for listing a tutor publicly. This is the promise the tutor
 * dashboard makes to them ("upload a clear profile photo and at least one
 * review document"), so it has to be enforced here or the copy is a lie.
 */
function isReadyForBasicApproval(tutor: TutorRow, documents: TutorDocumentRow[]) {
  return (
    hasCoreProfileDetails(tutor) &&
    Boolean(tutor.profile_photo_url) &&
    hasReviewDocumentOnFile(documents)
  )
}

function describeApprovalBlockers(tutor: TutorRow, documents: TutorDocumentRow[]) {
  const missing: string[] = []

  if (!tutor.phone?.trim()) missing.push('phone number')
  if (!tutor.location?.trim()) missing.push('location')
  if (!Array.isArray(tutor.subjects) || tutor.subjects.length === 0) {
    missing.push('at least one subject')
  }
  if (typeof tutor.hourly_rate !== 'number' || tutor.hourly_rate <= 0) {
    missing.push('a valid hourly rate')
  }
  if (!tutor.profile_photo_url) missing.push('a profile photo')
  if (!hasReviewDocumentOnFile(documents)) {
    missing.push('at least one review document that has not been rejected')
  }

  return missing
}

export async function GET() {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tutor_profiles')
      .select(
        'id,name,email,phone,location,subjects,hourly_rate,bio,profile_photo_url,is_approved,verification_status,is_test_account,created_at'
      )
      .order('created_at', { ascending: true })

    if (error) throw error

    const tutors = ((data ?? []) as TutorRow[]).filter((tutor) => {
      const normalizedStatus = normalizeTutorVerificationStatus(tutor.verification_status)
      return !tutor.is_approved || (Boolean(tutor.is_approved) && normalizedStatus === 'basic')
    })
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
      const tutorDocuments = documentsByTutorId.get(tutor.id) ?? []
      const latestStatusByType = getLatestDocumentStatusByType(tutorDocuments)
      const approvedDocumentTypes = Array.from(latestStatusByType.entries())
        .filter(([, status]) => status === 'approved')
        .map(([documentType]) => documentType)
      const reviewPath = getTutorReviewPathFromApprovedDocumentTypes(approvedDocumentTypes)
      const canEarnVerifiedStatus = Boolean(tutor.profile_photo_url) && Boolean(reviewPath)
      const approvalOutcome = canEarnVerifiedStatus ? reviewPath : 'basic'
      const canApprove = isReadyForBasicApproval(tutor, tutorDocuments)

      return {
        ...tutor,
        applied_days_ago: daysSince(tutor.created_at),
        has_profile_photo: Boolean(tutor.profile_photo_url),
        has_review_document: hasReviewDocumentOnFile(tutorDocuments),
        approval_blockers: describeApprovalBlockers(tutor, tutorDocuments),
        review_path: reviewPath,
        approval_outcome: approvalOutcome,
        can_approve: canApprove,
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
    if (!hasAdminRole(admin, ['owner', 'admin']) || !admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const tutorId = typeof body?.tutorId === 'string' ? body.tutorId.trim() : ''
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : ''

    if (!tutorId || !['approve', 'reject', 'request_changes'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    // A tutor cannot act on "no" without being told why, so the reason is required.
    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { error: 'Please give a brief reason. It is sent to the tutor so they know what to fix.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Tell a tutor exactly what is still missing, without rejecting them.
    if (action === 'request_changes') {
      const [tutorResult, documentsResult] = await Promise.all([
        supabase
          .from('tutor_profiles')
          .select('id,name,email,phone,location,subjects,hourly_rate,bio,profile_photo_url,is_approved,verification_status,is_test_account,created_at')
          .eq('id', tutorId)
          .maybeSingle(),
        supabase
          .from('tutor_documents')
          .select('tutor_id,document_type,status,uploaded_at')
          .eq('tutor_id', tutorId),
      ])

      if (tutorResult.error) throw tutorResult.error
      if (documentsResult.error) throw documentsResult.error

      const tutor = tutorResult.data as TutorRow | null
      if (!tutor) return NextResponse.json({ error: 'Tutor not found.' }, { status: 404 })

      const blockers = describeApprovalBlockers(tutor, (documentsResult.data ?? []) as TutorDocumentRow[])

      if (!tutor.email) {
        return NextResponse.json(
          { error: 'This tutor has no email address on file, so they cannot be notified.' },
          { status: 400 }
        )
      }

      const result = await sendEmail({
        to: tutor.email,
        subject: 'Your TutorConnect profile needs a few more details',
        text: composeEmail([
          `Hi ${tutor.name || 'Tutor'},`,
          '',
          'Thank you for applying to TutorConnect Gambia. We cannot list your profile publicly yet.',
          ...(blockers.length > 0
            ? ['', 'Still needed:', ...blockers.map((blocker) => `- ${blocker}`)]
            : []),
          ...(reason ? ['', reason] : []),
          '',
          'Sign in to your dashboard to update these, and we will review your profile again.',
          `Questions: ${TUTOR_REVIEW_CONTACT_EMAIL}`,
        ]),
      })

      await writeAdminAuditLog({
        admin,
        action: 'tutor.changes_requested',
        targetType: 'tutor_profile',
        targetId: tutorId,
        metadata: { blockers, note: reason, email_sent: result.sent },
      })

      return NextResponse.json({ ok: true, blockers, email_sent: result.sent })
    }

    if (action === 'approve') {
      const tutorResult = await supabase
        .from('tutor_profiles')
        .select('id,name,email,phone,location,subjects,hourly_rate,bio,profile_photo_url,is_approved,verification_status,is_test_account,created_at')
        .eq('id', tutorId)
        .single()
      const tutor = tutorResult.data as TutorRow | null
      const tutorError = tutorResult.error

      if (tutorError) throw tutorError

      if (!tutor) {
        return NextResponse.json(
          { error: 'Tutor not found.' },
          { status: 404 }
        )
      }

      const { data: documents, error: documentsError } = await supabase
        .from('tutor_documents')
        .select('tutor_id,document_type,status,uploaded_at')
        .eq('tutor_id', tutorId)
        .order('uploaded_at', { ascending: false })

      if (documentsError) throw documentsError

      const tutorDocuments = (documents ?? []) as TutorDocumentRow[]

      if (!isReadyForBasicApproval(tutor, tutorDocuments)) {
        return NextResponse.json(
          {
            error: `This tutor cannot be listed publicly yet. Still missing: ${describeApprovalBlockers(
              tutor,
              tutorDocuments
            ).join(', ')}.`,
          },
          { status: 400 }
        )
      }

      const latestStatusByType = getLatestDocumentStatusByType(tutorDocuments)
      const approvedDocumentTypes = Array.from(latestStatusByType.entries())
        .filter(([, status]) => status === 'approved')
        .map(([documentType]) => documentType)
      const reviewPath = getTutorReviewPathFromApprovedDocumentTypes(approvedDocumentTypes)
      const approvalOutcome =
        tutor.profile_photo_url && reviewPath ? reviewPath : 'basic'

      const { error: approveError } = await supabase
        .from('tutor_profiles')
        .update({
          is_approved: true,
          verification_status: approvalOutcome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tutorId)

      if (approveError) throw approveError

      await writeAdminAuditLog({
        admin,
        action: 'tutor.approved',
        targetType: 'tutor_profile',
        targetId: tutorId,
        metadata: { approval_outcome: approvalOutcome },
      })

      if (tutor.email) {
        await sendEmail({
          to: tutor.email,
          subject: 'Your TutorConnect tutor profile is approved',
          text: composeEmail([
            `Hi ${tutor.name || 'Tutor'},`,
            '',
            `Your tutor profile has been approved as ${approvalOutcome.replace('_', ' ')}.`,
            'Families can now find your profile and send booking requests.',
          ]),
        })
      }

      return NextResponse.json({
        ok: true,
        approval_outcome: approvalOutcome,
      })
    }

    const { error } = await supabase
      .from('tutor_profiles')
      .update({
        is_active: false,
        is_approved: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tutorId)

    if (error) throw error

    await writeAdminAuditLog({
      admin,
      action: 'tutor.rejected',
      targetType: 'tutor_profile',
      targetId: tutorId,
      metadata: { reason },
    })

    const { data: rejectedTutor } = await supabase
      .from('tutor_profiles')
      .select('name,email')
      .eq('id', tutorId)
      .maybeSingle<{ name: string | null; email: string | null }>()

    if (rejectedTutor?.email) {
      await sendEmail({
        to: rejectedTutor.email,
        subject: 'TutorConnect profile review update',
        text: composeEmail([
          `Hi ${rejectedTutor.name || 'Tutor'},`,
          '',
          'We are not able to approve your tutor profile at this time.',
          '',
          `Reason: ${reason}`,
          '',
          'You can update your profile from your dashboard and reply to this email if you would like us to look again.',
          `Questions: ${TUTOR_REVIEW_CONTACT_EMAIL}`,
        ]),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin tutor update failed', error)
    return NextResponse.json({ error: 'Could not update tutor approval.' }, { status: 500 })
  }
}
