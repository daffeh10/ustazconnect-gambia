'use client'

import Image from 'next/image'
import { ChangeEvent, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageUploadProps {
  currentPhotoUrl?: string
  onUpload: (url: string) => void
}

export default function ImageUpload({ currentPhotoUrl, onUpload }: ImageUploadProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.')
      event.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be 2MB or smaller.')
      event.target.value = ''
      return
    }

    setIsUploading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('You must be signed in to upload a photo.')

      const extension = file.name.split('.').pop() || 'jpg'
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      onUpload(data.publicUrl)
    } catch (err) {
      console.error(err)
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes('row-level security')) {
          setError('Upload blocked by storage permissions. Please add the avatars bucket upload policy in Supabase.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Upload failed. Please try again.')
      }
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full border border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
          {currentPhotoUrl ? (
            <Image
              src={currentPhotoUrl}
              alt="Profile photo"
              width={112}
              height={112}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl" aria-label="Camera placeholder" role="img">
              📷
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : 'Choose Photo'}
        </button>

        {error && (
          <p className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
