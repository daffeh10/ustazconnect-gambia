'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StarRating from '@/app/components/StarRating'
import Link from 'next/link'

interface LeaveReviewFormProps {
  tutorId: string
  tutorName: string
  onSubmitted: () => void
}

export default function LeaveReviewForm({ tutorId, tutorName, onSubmitted }: LeaveReviewFormProps) {
  const supabase = createClient()

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isFamilyUser, setIsFamilyUser] = useState(false)
  const [familyId, setFamilyId] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isMounted = true

    async function checkUser() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!isMounted || !user) {
          setIsLoggedIn(false)
          setIsFamilyUser(false)
          setFamilyId('')
          return
        }
        setIsLoggedIn(true)

        const role =
          typeof user.user_metadata?.role === 'string'
            ? user.user_metadata.role.toLowerCase().trim()
            : ''

        let canReview = role === 'family'

        if (!canReview) {
          const { data: familyProfile, error: familyError } = await supabase
            .from('family_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (!familyError && familyProfile) {
            canReview = true
          }
        }

        if (!canReview) {
          setIsFamilyUser(false)
          setFamilyId('')
          return
        }

        const metadataName =
          typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
        const fallbackName = user.email?.split('@')[0] || 'Family'

        setIsFamilyUser(true)
        setFamilyId(user.id)
        setFamilyName(metadataName || fallbackName)
      } catch (err) {
        console.error(err)
        if (isMounted) {
          setIsLoggedIn(false)
          setIsFamilyUser(false)
          setFamilyId('')
        }
      } finally {
        if (isMounted) setIsCheckingAuth(false)
      }
    }

    checkUser()

    return () => {
      isMounted = false
    }
  }, [supabase])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!familyId) {
      setError('Please sign in before leaving a review.')
      return
    }

    if (rating === 0) {
      setError('Please select a star rating before submitting.')
      return
    }

    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      const { error: insertError } = await supabase.from('reviews').insert([
        {
          tutor_id: tutorId,
          family_id: familyId,
          family_name: familyName || 'Family',
          rating,
          comment: comment.trim() || null,
          would_recommend: wouldRecommend,
        },
      ])

      if (insertError) throw insertError

      setRating(0)
      setComment('')
      setWouldRecommend(true)
      setSuccess('Thanks! Your review was submitted.')
      onSubmitted()
    } catch (err) {
      console.error(err)
      setError('Could not submit your review. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCheckingAuth) {
    return null
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-700">
          Sign in as a Family/Student account to leave a review.
        </p>
        <Link href="/login" className="inline-block mt-2 text-sm text-emerald-700 font-medium hover:underline">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (!isFamilyUser) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-700">Only Family/Student accounts can submit reviews.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-gray-900">Leave a Review</h3>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your rating
          </label>
          <StarRating rating={rating} interactive onRate={setRating} />
        </div>

        <div>
          <label htmlFor="review-comment" className="block text-sm font-medium text-gray-700 mb-1">
            Comment (optional)
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder={`Share your learning experience with ${tutorName}.`}
          />
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">
            Recommend {tutorName}?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWouldRecommend(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                wouldRecommend
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWouldRecommend(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !wouldRecommend
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              No
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  )
}
