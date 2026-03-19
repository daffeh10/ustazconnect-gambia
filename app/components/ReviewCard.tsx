import StarRating from '@/app/components/StarRating'

interface ReviewCardProps {
  familyName: string
  rating: number
  comment: string | null
  wouldRecommend: boolean
  tutorResponse: string | null
  createdAt: string
}

function formatMonthYear(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function ReviewCard({
  familyName,
  rating,
  comment,
  wouldRecommend,
  tutorResponse,
  createdAt,
}: ReviewCardProps) {
  return (
    <article className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <StarRating rating={rating} size="sm" />
          <p className="text-sm text-gray-500">{familyName}</p>
        </div>
        <p className="text-sm text-gray-500">{formatMonthYear(createdAt)}</p>
      </div>

      {comment && <p className="text-gray-700 mt-3 whitespace-pre-wrap">{comment}</p>}

      {wouldRecommend && (
        <p className="text-sm text-emerald-700 mt-3">✓ Recommends this tutor</p>
      )}

      {tutorResponse && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-sm text-gray-600">Tutor&apos;s reply: {tutorResponse}</p>
        </div>
      )}
    </article>
  )
}
