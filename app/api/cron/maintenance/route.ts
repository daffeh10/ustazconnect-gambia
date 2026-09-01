import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import { queueTrialPayout } from '@/lib/trials'

interface ReminderLesson {
  id: string
  booking_id: string
  tutor_id: string
  family_id: string | null
  subject: string | null
  scheduled_at: string
  meeting_link: string | null
}

interface TrialLesson {
  id: string
  booking_id: string
  tutor_id: string
  family_id: string | null
  completed_at: string
}

interface PendingBooking {
  id: string
  tutor_id: string
  family_id: string | null
  family_name: string | null
  subjects: string[] | null
  grand_total: number | null
  created_at: string
}

// A family who books and hears nothing is a lead lost in silence, so nudge the
// tutor after a day and release the family back to search after five.
const PENDING_NUDGE_AFTER_HOURS = 24
const PENDING_EXPIRY_AFTER_HOURS = 120

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorconnectgambia.com').replace(/\/$/, '')
}

function describeBooking(booking: PendingBooking, { includeFamilyName }: { includeFamilyName: boolean }) {
  const subjects = (booking.subjects ?? []).filter(Boolean).join(', ')
  return [
    includeFamilyName ? `Family: ${booking.family_name || 'A family'}` : '',
    subjects ? `Subject: ${subjects}` : '',
    typeof booking.grand_total === 'number' && Number.isFinite(booking.grand_total)
      ? `Amount: GMD ${booking.grand_total.toLocaleString()}`
      : '',
  ].filter(Boolean)
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  return Boolean(
    cronSecret &&
    request.headers.get('authorization') === `Bearer ${cronSecret}`
  )
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const reminderHorizon = new Date(now.getTime() + 25 * 60 * 60 * 1000)
    const autoConfirmCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    const nudgeCutoff = new Date(now.getTime() - PENDING_NUDGE_AFTER_HOURS * 60 * 60 * 1000)
    const expiryCutoff = new Date(now.getTime() - PENDING_EXPIRY_AFTER_HOURS * 60 * 60 * 1000)
    const pendingSelect =
      'id,tutor_id,family_id,family_name,subjects,grand_total,created_at'

    const [remindersResult, trialLessonsResult, staleBookingsResult, expiredBookingsResult] = await Promise.all([
      supabase
        .from('lessons')
        .select('id,booking_id,tutor_id,family_id,subject,scheduled_at,meeting_link')
        .eq('status', 'scheduled')
        .is('reminder_sent_at', null)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', reminderHorizon.toISOString()),
      supabase
        .from('lessons')
        .select('id,booking_id,tutor_id,family_id,completed_at')
        .eq('booking_type', 'trial')
        .eq('status', 'completed')
        .is('family_confirmed_at', null)
        .is('no_show_reported_at', null)
        .lte('completed_at', autoConfirmCutoff.toISOString()),
      supabase
        .from('bookings')
        .select(pendingSelect)
        .eq('status', 'pending')
        .is('tutor_nudge_sent_at', null)
        .lte('created_at', nudgeCutoff.toISOString())
        .gt('created_at', expiryCutoff.toISOString()),
      supabase
        .from('bookings')
        .select(pendingSelect)
        .eq('status', 'pending')
        .lte('created_at', expiryCutoff.toISOString()),
    ])

    if (remindersResult.error) throw remindersResult.error
    if (trialLessonsResult.error) throw trialLessonsResult.error

    // Chasing pending bookings is best-effort: it must never stop the lesson
    // reminders or the trial payouts below, which move money.
    const pendingChaseError = staleBookingsResult.error || expiredBookingsResult.error
    if (pendingChaseError) {
      console.error('pending booking chase skipped', pendingChaseError)
    }

    let remindersSent = 0
    for (const lesson of (remindersResult.data ?? []) as ReminderLesson[]) {
      const [{ data: tutor }, familyResult] = await Promise.all([
        supabase
          .from('tutor_profiles')
          .select('name,email')
          .eq('id', lesson.tutor_id)
          .maybeSingle<{ name: string | null; email: string | null }>(),
        lesson.family_id
          ? supabase.auth.admin.getUserById(lesson.family_id)
          : Promise.resolve({ data: { user: null }, error: null }),
      ])

      const scheduledText = new Date(lesson.scheduled_at).toLocaleString('en-GB', {
        timeZone: 'UTC',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      const commonLines = [
        `Subject: ${lesson.subject || 'Tutoring lesson'}`,
        `Time: ${scheduledText} UTC`,
        lesson.meeting_link ? `Meeting link: ${lesson.meeting_link}` : '',
      ].filter(Boolean)
      const results = await Promise.all([
        tutor?.email
          ? sendEmail({
              to: tutor.email,
              subject: 'TutorConnect lesson reminder',
              text: composeEmail([
                `Hi ${tutor.name || 'Tutor'},`,
                '',
                'You have a lesson scheduled within the next 24 hours.',
                ...commonLines,
              ]),
            })
          : Promise.resolve({ sent: false, skipped: true }),
        familyResult.data.user?.email
          ? sendEmail({
              to: familyResult.data.user.email,
              subject: 'TutorConnect lesson reminder',
              text: composeEmail([
                'Hi,',
                '',
                'You have a lesson scheduled within the next 24 hours.',
                ...commonLines,
              ]),
            })
          : Promise.resolve({ sent: false, skipped: true }),
      ])

      if (results.some((result) => result.sent)) {
        const { error: updateError } = await supabase
          .from('lessons')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', lesson.id)
          .is('reminder_sent_at', null)

        if (updateError) throw updateError
        remindersSent += 1
      }
    }

    let trialsAutoConfirmed = 0
    for (const lesson of (trialLessonsResult.data ?? []) as TrialLesson[]) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id,tutor_id,family_id,status,booking_type,trial_confirmed_at,no_show_reported_at')
        .eq('id', lesson.booking_id)
        .eq('status', 'active')
        .eq('booking_type', 'trial')
        .is('trial_confirmed_at', null)
        .is('no_show_reported_at', null)
        .maybeSingle<{
          id: string
          tutor_id: string
          family_id: string | null
          status: string | null
          booking_type: string | null
          trial_confirmed_at: string | null
          no_show_reported_at: string | null
        }>()

      if (bookingError) throw bookingError
      if (!booking) continue

      const confirmedAt = now.toISOString()
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ trial_confirmed_at: confirmedAt, updated_at: confirmedAt })
        .eq('id', booking.id)
        .is('trial_confirmed_at', null)
        .is('no_show_reported_at', null)
        .select('id')
        .maybeSingle<{ id: string }>()

      if (updateError) throw updateError
      if (!updated) continue

      const { error: lessonUpdateError } = await supabase
        .from('lessons')
        .update({ family_confirmed_at: confirmedAt, payout_due_at: confirmedAt })
        .eq('id', lesson.id)
        .is('family_confirmed_at', null)
        .is('no_show_reported_at', null)

      if (lessonUpdateError) throw lessonUpdateError
      const payoutCreated = await queueTrialPayout({
        supabase,
        bookingId: booking.id,
        tutorId: booking.tutor_id,
        confirmedAt,
      })

      if (payoutCreated) {
        const [{ data: tutor }, familyResult] = await Promise.all([
          supabase
            .from('tutor_profiles')
            .select('name,email')
            .eq('id', booking.tutor_id)
            .maybeSingle<{ name: string | null; email: string | null }>(),
          booking.family_id
            ? supabase.auth.admin.getUserById(booking.family_id)
            : Promise.resolve({ data: { user: null }, error: null }),
        ])

        await Promise.all([
          tutor?.email
            ? sendEmail({
                to: tutor.email,
                subject: 'Trial session auto-confirmed',
                text: composeEmail([
                  `Hi ${tutor.name || 'Tutor'},`,
                  '',
                  'The 48-hour confirmation window has ended. Your GMD 150 trial payout is now queued for fast-track processing.',
                ]),
              })
            : Promise.resolve({ sent: false, skipped: true }),
          familyResult.data.user?.email
            ? sendEmail({
                to: familyResult.data.user.email,
                subject: 'TutorConnect trial auto-confirmed',
                text: composeEmail([
                  'Hi,',
                  '',
                  'Your completed trial session was automatically confirmed after 48 hours with no dispute or no-show report.',
                ]),
              })
            : Promise.resolve({ sent: false, skipped: true }),
        ])
      }
      trialsAutoConfirmed += 1
    }

    // Nudge tutors who have left a booking request unanswered for a day.
    let pendingNudgesSent = 0
    for (const booking of (staleBookingsResult.data ?? []) as PendingBooking[]) {
      const { data: tutor } = await supabase
        .from('tutor_profiles')
        .select('name,email')
        .eq('id', booking.tutor_id)
        .maybeSingle<{ name: string | null; email: string | null }>()

      if (!tutor?.email) continue

      const hoursWaiting = Math.floor(
        (now.getTime() - new Date(booking.created_at).getTime()) / (60 * 60 * 1000)
      )
      const result = await sendEmail({
        to: tutor.email,
        subject: 'A family is still waiting for your reply',
        text: composeEmail([
          `Hi ${tutor.name || 'Tutor'},`,
          '',
          `You have a booking request that has been waiting ${hoursWaiting} hours for an answer.`,
          ...describeBooking(booking, { includeFamilyName: true }),
          '',
          `Accept or decline it here: ${getSiteUrl()}/dashboard`,
          `Requests with no reply are cancelled automatically after ${PENDING_EXPIRY_AFTER_HOURS / 24} days.`,
        ]),
      })

      if (!result.sent) continue

      const { error: nudgeError } = await supabase
        .from('bookings')
        .update({ tutor_nudge_sent_at: now.toISOString() })
        .eq('id', booking.id)
        .is('tutor_nudge_sent_at', null)

      if (nudgeError) throw nudgeError
      pendingNudgesSent += 1
    }

    // Release families whose request was never answered, and point them back to search.
    let pendingBookingsExpired = 0
    for (const booking of (expiredBookingsResult.data ?? []) as PendingBooking[]) {
      const expiredAt = now.toISOString()
      const { data: expired, error: expireError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: expiredAt })
        .eq('id', booking.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle<{ id: string }>()

      if (expireError) throw expireError
      if (!expired) continue

      const [{ data: tutor }, familyResult] = await Promise.all([
        supabase
          .from('tutor_profiles')
          .select('name,email')
          .eq('id', booking.tutor_id)
          .maybeSingle<{ name: string | null; email: string | null }>(),
        booking.family_id
          ? supabase.auth.admin.getUserById(booking.family_id)
          : Promise.resolve({ data: { user: null }, error: null }),
      ])

      await Promise.all([
        familyResult.data.user?.email
          ? sendEmail({
              to: familyResult.data.user.email,
              subject: 'Your booking request has been cancelled',
              text: composeEmail([
                `Hi ${booking.family_name || 'there'},`,
                '',
                'The tutor did not respond to your booking request, so we have cancelled it and you have not been charged.',
                ...describeBooking(booking, { includeFamilyName: false }),
                '',
                `Other tutors are available now: ${getSiteUrl()}/find-tutor`,
              ]),
            })
          : Promise.resolve({ sent: false, skipped: true }),
        tutor?.email
          ? sendEmail({
              to: tutor.email,
              subject: 'A booking request expired',
              text: composeEmail([
                `Hi ${tutor.name || 'Tutor'},`,
                '',
                `A booking request expired after ${PENDING_EXPIRY_AFTER_HOURS / 24} days with no reply and has been cancelled.`,
                ...describeBooking(booking, { includeFamilyName: true }),
                '',
                'Replying quickly keeps you higher in family shortlists.',
              ]),
            })
          : Promise.resolve({ sent: false, skipped: true }),
      ])

      pendingBookingsExpired += 1
    }

    return NextResponse.json({
      ok: true,
      remindersSent,
      trialsAutoConfirmed,
      pendingNudgesSent,
      pendingBookingsExpired,
    })
  } catch (error) {
    console.error('scheduled maintenance failed', error)
    return NextResponse.json({ error: 'Scheduled maintenance failed.' }, { status: 500 })
  }
}
