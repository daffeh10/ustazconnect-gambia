import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, hasAdminRole } from '@/lib/admin'
import { TUTOR_LISTING_REQUIRES_PHOTO_AND_DOCUMENT } from '@/lib/features'
import { MAX_TUTOR_HOURLY_RATE } from '@/lib/pricing'
import { buildTutorEmail, type TutorEmailAction } from '@/lib/tutor-emails'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import {
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
    tutor.hourly_rate > 0 &&
    tutor.hourly_rate <= MAX_TUTOR_HOURLY_RATE
  )
}

/**
 * The gate for listing a tutor publicly. Core profile details are always
 * required. The photo and review document are only required when
 * TUTOR_LISTING_REQUIRES_PHOTO_AND_DOCUMENT is on -- whatever this enforces has
 * to match what the tutor dashboard promises, or the copy becomes a lie.
 */
function isReadyForBasicApproval(tutor: TutorRow, documents: TutorDocumentRow[]) {
  if (!hasCoreProfileDetails(tutor)) return false
  if (!TUTOR_LISTING_REQUIRES_PHOTO_AND_DOCUMENT) return true

  return Boolean(tutor.profile_photo_url) && hasReviewDocumentOnFile(documents)
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
  } else if (tutor.hourly_rate > MAX_TUTOR_HOURLY_RATE) {
    // Listing above the cap would bill families that rate at checkout, which
    // recomputes from this column.
    missing.push(
      `an hourly rate of GMD ${MAX_TUTOR_HOURLY_RATE.toLocaleString()} or less (currently GMD ${tutor.hourly_rate.toLocaleString()})`
    )
  }
  if (TUTOR_LISTING_REQUIRES_PHOTO_AND_DOCUMENT) {
    if (!tutor.profile_photo_url) missing.push('a profile photo')
    if (!hasReviewDocumentOnFile(documents)) {
      missing.push('at least one review document that has not been rejected')
    }
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

    return NextResponse.json({
      tutors: enrichedTutors,
      canVouch: hasAdminRole(admin, ['owner']),
      // Surfaced so a missing key shows as a banner rather than being discovered
      // one silently unsent email at a time.
      emailConfigured: Boolean(process.env.RESEND_API_KEY),
    })
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

    const sendableActions: TutorEmailAction[] = ['approve', 'reject', 'request_changes', 'vouch']

    if (!tutorId || ![...sendableActions, 'preview'].includes(action)) {
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

    // Show the admin exactly what the tutor will receive, composed by the same
    // builder the send path uses, so a preview can never drift from reality.
    if (action === 'preview') {
      const previewAction = typeof body?.previewAction === 'string'
        ? body.previewAction.trim().toLowerCase()
        : ''

      if (!sendableActions.includes(previewAction as TutorEmailAction)) {
        return NextResponse.json({ error: 'Choose an action to preview.' }, { status: 400 })
      }

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

      const previewTutor = tutorResult.data as TutorRow | null
      if (!previewTutor) return NextResponse.json({ error: 'Tutor not found.' }, { status: 404 })

      const previewDocs = (documentsResult.data ?? []) as TutorDocumentRow[]
      const requestedLevel = typeof body?.verificationStatus === 'string'
        ? body.verificationStatus.trim().toLowerCase()
        : ''

      const email = buildTutorEmail(previewAction as TutorEmailAction, {
        tutorName: previewTutor.name,
        note: reason,
        blockers: describeApprovalBlockers(previewTutor, previewDocs),
        verificationStatus:
          previewAction === 'vouch'
            ? requestedLevel || 'qualification_verified'
            : previewTutor.profile_photo_url &&
                getTutorReviewPathFromApprovedDocumentTypes(
                  Array.from(getLatestDocumentStatusByType(previewDocs).entries())
                    .filter(([, status]) => status === 'approved')
                    .map(([documentType]) => documentType)
                )
              ? 'profile_reviewed'
              : 'basic',
      })

      return NextResponse.json({
        preview: {
          to: previewTutor.email || '(this tutor has no email address on file)',
          subject: email.subject,
          text: email.text,
          usesYourNote: previewAction !== 'reject' ? Boolean(reason) : true,
        },
      })
    }

    // Personal-authority override: approve a tutor and set their public trust
    // label from first-hand knowledge rather than uploaded documents. Restricted
    // to the owner, and the reason is mandatory because the audit log is the
    // only record of why a tutor carries a badge with no document behind it.
    if (action === 'vouch') {
      if (!hasAdminRole(admin, ['owner'])) {
        return NextResponse.json(
          { error: 'Only the account owner can approve a tutor on personal knowledge.' },
          { status: 403 }
        )
      }

      const requested = typeof body?.verificationStatus === 'string'
        ? body.verificationStatus.trim().toLowerCase()
        : ''
      const allowed = ['basic', 'profile_reviewed', 'qualification_verified']

      if (!allowed.includes(requested)) {
        return NextResponse.json({ error: 'Choose a valid verification level.' }, { status: 400 })
      }
      if (!reason) {
        return NextResponse.json(
          { error: 'Please record how you know this tutor qualifies. It is kept in the audit log.' },
          { status: 400 }
        )
      }

      const { data: tutor, error: tutorError } = await supabase
        .from('tutor_profiles')
        .select('id,name,email,phone,location,subjects,hourly_rate,bio,profile_photo_url,is_approved,verification_status,is_test_account,created_at')
        .eq('id', tutorId)
        .maybeSingle()

      if (tutorError) throw tutorError
      const vouchedTutor = tutor as TutorRow | null
      if (!vouchedTutor) return NextResponse.json({ error: 'Tutor not found.' }, { status: 404 })

      // Core details still apply -- a tutor with no rate or area cannot be booked.
      if (!hasCoreProfileDetails(vouchedTutor)) {
        return NextResponse.json(
          {
            error: `This tutor still needs: ${describeApprovalBlockers(vouchedTutor, []).join(', ')}.`,
          },
          { status: 400 }
        )
      }

      const { error: vouchError } = await supabase
        .from('tutor_profiles')
        .update({
          is_approved: true,
          verification_status: requested,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tutorId)

      if (vouchError) throw vouchError

      await writeAdminAuditLog({
        admin,
        action: 'tutor.vouched',
        targetType: 'tutor_profile',
        targetId: tutorId,
        metadata: {
          verification_status: requested,
          reason,
          had_profile_photo: Boolean(vouchedTutor.profile_photo_url),
        },
      })

      let vouchEmailSent = false
      if (vouchedTutor.email) {
        const vouchEmail = await sendEmail({
          to: vouchedTutor.email,
          ...buildTutorEmail('vouch', {
            tutorName: vouchedTutor.name,
            note: reason,
            verificationStatus: requested,
          }),
        })
        vouchEmailSent = vouchEmail.sent
      }

      return NextResponse.json({
        ok: true,
        verification_status: requested,
        email_sent: vouchEmailSent,
      })
    }

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
        ...buildTutorEmail('request_changes', {
          tutorName: tutor.name,
          note: reason,
          blockers,
        }),
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

      let approvalEmailSent = false
      if (tutor.email) {
        const approvalEmail = await sendEmail({
          to: tutor.email,
          ...buildTutorEmail('approve', {
            tutorName: tutor.name,
            note: reason,
            verificationStatus: approvalOutcome,
          }),
        })
        approvalEmailSent = approvalEmail.sent
      }

      return NextResponse.json({
        ok: true,
        approval_outcome: approvalOutcome,
        email_sent: approvalEmailSent,
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

    let rejectionEmailSent = false
    if (rejectedTutor?.email) {
      const rejectionEmail = await sendEmail({
        to: rejectedTutor.email,
        ...buildTutorEmail('reject', {
          tutorName: rejectedTutor.name,
          note: reason,
        }),
      })
      rejectionEmailSent = rejectionEmail.sent
    }

    return NextResponse.json({ ok: true, email_sent: rejectionEmailSent })
  } catch (error) {
    console.error('admin tutor update failed', error)
    return NextResponse.json({ error: 'Could not update tutor approval.' }, { status: 500 })
  }
}
