'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export default function LessonCard({ lesson, viewAs, totalLessons, onUpdated }: LessonCardProps) {
  const [supabase] = useState(() => createClient())
  const [isExpanded, setIsExpanded] = useState(false)
  const [notes, setNotes] = useState(lesson.tutor_notes || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { error: updateError } = await supabase
        .from('lessons')
        .update({
          status: 'completed',
          tutor_notes: notes.trim() || null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', lesson.id)

      if (updateError) throw updateError

      setIsExpanded(false)
      onUpdated?.()
    } catch (err) {
      console.error(err)
      setError('Could not update this lesson. Please try again.')
    } finally {
      setIsSubmitting(false)
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
        <div className="mt-4">
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
