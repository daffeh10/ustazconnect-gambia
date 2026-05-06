import { redirect } from 'next/navigation'

export default async function UstazProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/tutor/${id}`)
}
