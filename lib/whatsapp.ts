export function normalizeWhatsappDigits(phone: string | null | undefined) {
  return (phone || '').replace(/\D/g, '')
}

export function buildWhatsappLink(phone: string | null | undefined, message: string) {
  const digits = normalizeWhatsappDigits(phone)
  if (!digits) return null

  const normalizedDigits = digits.startsWith('220') ? digits : `220${digits}`
  return `https://wa.me/${normalizedDigits}?text=${encodeURIComponent(message)}`
}

export function buildTutorConnectWhatsappMessage(subject: string, detail: string) {
  return `TutorConnect Gambia: ${subject}. ${detail}`
}
