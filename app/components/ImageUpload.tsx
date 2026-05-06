'use client'

import { ChangeEvent, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from './Avatar'

interface ImageUploadProps {
  currentName?: string
  currentPhotoUrl?: string
  onUpload: (url: string) => void
}

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read the selected image.'))
      img.src = imageUrl
    })

    const maxDimension = 400
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const targetWidth = Math.max(1, Math.round(image.width * scale))
    const targetHeight = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not prepare image compression.')
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    let quality = 0.82
    let blob: Blob | null = null

    while (quality >= 0.4) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality)
      })

      if (blob && blob.size <= 500 * 1024) {
        break
      }

      quality -= 0.08
    }

    if (!blob) {
      throw new Error('Could not compress the selected image.')
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'avatar'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export default function ImageUpload({ currentName = 'Tutor', currentPhotoUrl, onUpload }: ImageUploadProps) {
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

    if (file.size > 8 * 1024 * 1024) {
      alert('Image must be 8MB or smaller before compression.')
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

      const compressedFile = await compressImage(file)
      const extension = compressedFile.name.split('.').pop() || 'jpg'
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, {
          upsert: true,
          contentType: compressedFile.type,
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
        <Avatar name={currentName} photoUrl={currentPhotoUrl} size="lg" className="border border-gray-300" />

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
