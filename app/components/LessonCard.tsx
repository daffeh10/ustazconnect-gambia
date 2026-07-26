'use client'

import { FormEvent, useState } from 'react'

export interface Lesson {
  id: string
  booking_id: string
  tutor_id: string
  family_id: string
  lesson_number: number
  duration_minutes: number | null
  subject: string | null
  status: string | null
  tutor_notes: string | null
  completed_at: string | null
  scheduled_at?: string | null
  meeting_link?: string | null
  created_at: string
}

interface LessonCardProps {
  lesson: Lesson
  viewAs: 'tutor' | 'family'
  totalLessons: number
  onUpdated?: () => void
}

function formatLessonDate(dateString: string | null) {
  if (!dateString) return 'upcoming'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'upcoming'

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function toLocalDateTimeValue(dateString: string | null | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export default function LessonCard({ lesson, viewAs, totalLessons, onUpdated }: LessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [notes, setNotes] = useState(lesson.tutor_notes || '')
  const [scheduledAt, setScheduledAt] = useState(toLocalDateTimeValue(lesson.scheduled_at))
  const [meetingLink, setMeetingLink] = useState(lesson.meeting_link || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/lessons/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, notes }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not complete this lesson.')
      }

      setIsExpanded(false)
      onUpdated?.()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update this lesson.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsScheduling(true)

    try {
      const response = await fetch('/api/lessons/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : '',
          meetingLink,
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
        scheduledAt?: string
        meetingLink?: string | null
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Could not schedule this lesson.')
      }

      setMessage('Lesson schedule saved.')
      onUpdated?.()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not schedule this lesson.')
    } finally {
      setIsScheduling(false)
    }
  }

  if (viewAs === 'family') {
    const isCompleted = lesson.status === 'completed'

    return (
      <div className="flex gap-4">
        <div className="pt-1">
          <div
            className={`w-4 h-4 rounded-full ${
              isCompleted ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        </div>
        <div className="flex-1 pb-5 border-b border-gray-100 last:border-b-0">
          <p className="text-sm font-semibold text-gray-900">
            Lesson {lesson.lesson_number} {isCompleted ? `— ${formatLessonDate(lesson.completed_at)}` : '— upcoming'}
          </p>
          {lesson.subject && <p className="text-sm text-gray-600 mt-1">{lesson.subject}</p>}
          {lesson.scheduled_at && (
            <p className="mt-1 text-sm text-gray-600">
              Scheduled for {new Date(lesson.scheduled_at).toLocaleString('en-GB')}
            </p>
          )}
          {lesson.meeting_link && (
            <a
              href={lesson.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-sm font-medium text-emerald-700 underline"
            >
              Open meeting link
            </a>
          )}
          {lesson.tutor_notes && (
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
              {lesson.tutor_notes}
            </div>
          )}
        </div>
      </div>
    )
  }

  const isCompleted = lesson.status === 'completed'

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Lesson {lesson.lesson_number} of {totalLessons}
          </h3>
          {lesson.subject && <p className="text-sm text-gray-600 mt-1">{lesson.subject}</p>}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isCompleted ? 'Completed' : 'Scheduled'}
        </span>
      </div>

      {isCompleted ? (
        <div className="mt-4">
          <p className="text-sm text-gray-500">Completed on {formatLessonDate(lesson.completed_at)}</p>
          {lesson.tutor_notes && (
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
              {lesson.tutor_notes}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <form onSubmit={handleSchedule} className="grid gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-2">
            <div>
              <label htmlFor={`scheduled-at-${lesson.id}`} className="mb-1 block text-sm font-medium text-gray-700">
                Lesson date and time
              </label>
              <input
                id={`scheduled-at-${lesson.id}`}
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label htmlFor={`meeting-link-${lesson.id}`} className="mb-1 block text-sm font-medium text-gray-700">
                Meeting link
              </label>
              <input
                id={`meeting-link-${lesson.id}`}
                type="url"
                value={meetingLink}
                onChange={(event) => setMeetingLink(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isScheduling}
                className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                {isScheduling ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </form>

          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && !isExpanded && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!isExpanded ? (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Mark as Complete
            </button>
          ) : (
            <form onSubmit={handleComplete} className="space-y-3">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Add lesson notes (optional)"
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Complete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false)
                    setNotes(lesson.tutor_notes || '')
                    setError('')
                  }}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
