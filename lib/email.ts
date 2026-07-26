import { buildPublicUrl } from '@/lib/auth'

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  replyTo?: string
}

export interface SendEmailResult {
  sent: boolean
  skipped: boolean
  error?: string
}

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'TutorConnect Gambia <notifications@tutorconnectgambia.com>'
const DEFAULT_REPLY_TO = 'tutorconnectgambia@gmail.com'
const EMAIL_TIMEOUT_MS = 5_000

function getEmailFromAddress() {
  return process.env.RESEND_FROM_EMAIL || DEFAULT_FROM
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY || ''
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = getResendApiKey()
  const to = input.to.trim()

  if (!apiKey) {
    console.warn('RESEND_API_KEY is missing. Transactional email skipped.', {
      to,
      subject: input.subject,
    })
    return { sent: false, skipped: true }
  }

  if (!to) {
    return { sent: false, skipped: false, error: 'Missing recipient email.' }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS)
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to: [to],
        subject: input.subject,
        text: input.text,
        reply_to: input.replyTo || DEFAULT_REPLY_TO,
      }),
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      const detail = await response.text()
      console.error('Resend email failed', { status: response.status, detail })
      return { sent: false, skipped: false, error: 'Email provider rejected the message.' }
    }

    return { sent: true, skipped: false }
  } catch (error) {
    console.error('sendEmail failed', error)
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Email provider timed out.'
        : 'Email could not be sent.'
    return { sent: false, skipped: false, error: message }
  }
}

export function getBaseEmailFooter() {
  return [
    '',
    'TutorConnect Gambia',
    buildPublicUrl('/'),
    `Questions? Reply to ${DEFAULT_REPLY_TO}`,
  ].join('\n')
}

export function composeEmail(lines: string[]) {
  return [...lines, getBaseEmailFooter()].join('\n')
}
