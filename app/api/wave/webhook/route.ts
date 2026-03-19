import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const signature = request.headers.get('x-wave-signature')
  const webhookSecret = process.env.WAVE_WEBHOOK_SECRET || ''

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret is missing.' }, { status: 500 })
  }

  if (webhookSecret !== 'placeholder' && signature !== webhookSecret) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  return NextResponse.json({ received: true })
}
