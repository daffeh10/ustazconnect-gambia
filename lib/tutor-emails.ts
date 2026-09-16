import { composeEmail } from '@/lib/email'
import { TUTOR_REVIEW_CONTACT_EMAIL } from '@/lib/tutor-review'

export type TutorEmailAction = 'approve' | 'reject' | 'request_changes' | 'vouch'

export interface TutorEmailInput {
  tutorName: string | null
  /** The admin's own message. Included verbatim in every email that carries one. */
  note?: string
  /** Missing items, for request_changes. */
  blockers?: string[]
  /** Verification label, for approve and vouch. */
  verificationStatus?: string
}

export interface BuiltTutorEmail {
  subject: string
  text: string
}

/**
 * Single source of truth for every email the admin sends a tutor.
 *
 * Both the preview endpoint and the send path call this, so what an admin reads
 * in the preview is byte-for-byte what the tutor receives. Composing in two
 * places is how an admin ends up sending stock text they thought they had
 * replaced.
 */
export function buildTutorEmail(
  action: TutorEmailAction,
  input: TutorEmailInput
): BuiltTutorEmail {
  const greeting = `Hi ${input.tutorName?.trim() || 'Tutor'},`
  const note = input.note?.trim() || ''
  const label = (input.verificationStatus || 'basic').replace('_', ' ')

  if (action === 'request_changes') {
    const blockers = input.blockers ?? []
    return {
      subject: 'Your TutorConnect profile needs a few more details',
      text: composeEmail([
        greeting,
        '',
        'Thank you for applying to TutorConnect Gambia. We cannot list your profile publicly yet.',
        ...(blockers.length > 0
          ? ['', 'Still needed:', ...blockers.map((blocker) => `- ${blocker}`)]
          : []),
        ...(note ? ['', note] : []),
        '',
        'Sign in to your dashboard to update these, and we will review your profile again.',
        `Questions: ${TUTOR_REVIEW_CONTACT_EMAIL}`,
      ]),
    }
  }

  if (action === 'reject') {
    return {
      subject: 'TutorConnect profile review update',
      text: composeEmail([
        greeting,
        '',
        'We are not able to approve your tutor profile at this time.',
        '',
        `Reason: ${note}`,
        '',
        'You can update your profile from your dashboard and reply to this email if you would like us to look again.',
        `Questions: ${TUTOR_REVIEW_CONTACT_EMAIL}`,
      ]),
    }
  }

  if (action === 'vouch') {
    return {
      subject: 'Your TutorConnect tutor profile is approved',
      text: composeEmail([
        greeting,
        '',
        `Your tutor profile has been approved as ${label}.`,
        'Families can now find your profile and send booking requests.',
        ...(note ? ['', note] : []),
        '',
        'Adding a profile photo and your certificates keeps this label in place as we introduce document checks.',
      ]),
    }
  }

  return {
    subject: 'Your TutorConnect tutor profile is approved',
    text: composeEmail([
      greeting,
      '',
      `Your tutor profile has been approved as ${label}.`,
      'Families can now find your profile and send booking requests.',
      ...(note ? ['', note] : []),
    ]),
  }
}
