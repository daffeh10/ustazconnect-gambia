import { NextResponse } from 'next/server'
import { composeEmail, sendEmail } from '@/lib/email'
import { computeBookingCharge, computePackageBookingCharge, computeTrialBookingCharge } from '@/lib/pricing'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface TutorRow {
  id: string
  name: string | null
  email: string | null
  hourly_rate: number | null
  offers_online?: boolean | null
}

interface TutorPackageRow {
  id: string
  title: string
  frequency_per_week: number
  hours_per_visit: number
  monthly_price: number
  additional_child_amount: number | null
  is_active: boolean | null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function getPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tutorId = getString(body?.tutorId)
    const selectedSubject = getString(body?.subject)
    const familyName = getString(body?.familyName)
    const familyPhone = getString(body?.familyPhone)
    const specialRequests = getString(body?.specialRequests)
    const preferredDays = getStringArray(body?.preferredDays)
    const bookingType = getString(body?.bookingType) === 'trial' ? 'trial' : 'monthly'
    const pricingModel = getString(body?.pricingModel) === 'package' ? 'package' : 'hourly'
    const lessonFormat = getString(body?.lessonFormat) === 'online' ? 'online' : 'in_person'
    const timezone = getString(body?.timezone)
    const packageId = getString(body?.packageId)
    const hoursPerMonth = getPositiveInteger(body?.hoursPerMonth, 8)
    const childrenCount = getPositiveInteger(body?.childrenCount, 1)

    if (!tutorId || !selectedSubject || !familyName) {
      return NextResponse.json({ error: 'Missing booking details.' }, { status: 400 })
    }

    const authSupabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser()

    if (userError) throw userError
    if (!user) {
      return NextResponse.json({ error: 'Please sign in before booking.' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: tutor, error: tutorError } = await supabase
      .from('tutor_profiles')
      .select('id,name,email,hourly_rate,offers_online')
      .eq('id', tutorId)
      .eq('is_approved', true)
      .maybeSingle<TutorRow>()

    if (tutorError) throw tutorError
    if (!tutor) {
      return NextResponse.json({ error: 'Tutor not found or not available.' }, { status: 404 })
    }

    if (lessonFormat === 'online' && tutor.offers_online === false) {
      return NextResponse.json({ error: 'This tutor is not accepting online lessons.' }, { status: 400 })
    }

    if (bookingType === 'trial') {
      const { data: existingTrial, error: trialError } = await supabase
        .from('bookings')
        .select('id')
        .eq('family_id', user.id)
        .eq('tutor_id', tutorId)
        .eq('booking_type', 'trial')
        .limit(1)
        .maybeSingle<{ id: string }>()

      if (
        trialError &&
        !trialError.message.toLowerCase().includes('booking_type') &&
        !trialError.message.toLowerCase().includes('column')
      ) {
        throw trialError
      }
      if (existingTrial) {
        return NextResponse.json(
          { error: 'You have already booked a trial with this tutor.' },
          { status: 400 }
        )
      }
    }

    let packageRow: TutorPackageRow | null = null
    if (bookingType === 'monthly' && pricingModel === 'package') {
      if (!packageId) {
        return NextResponse.json({ error: 'Please choose a monthly package.' }, { status: 400 })
      }

      const { data, error: packageError } = await supabase
        .from('tutor_packages')
        .select('id,title,frequency_per_week,hours_per_visit,monthly_price,additional_child_amount,is_active')
        .eq('id', packageId)
        .eq('tutor_id', tutorId)
        .maybeSingle<TutorPackageRow>()

      if (packageError) throw packageError
      if (!data || data.is_active === false) {
        return NextResponse.json({ error: 'This package is no longer available.' }, { status: 400 })
      }
      packageRow = data
    }

    if (bookingType === 'monthly' && pricingModel === 'hourly') {
      if (typeof tutor.hourly_rate !== 'number' || tutor.hourly_rate <= 0) {
        return NextResponse.json({ error: 'This tutor cannot be booked right now.' }, { status: 400 })
      }
      if (hoursPerMonth > 400) {
        return NextResponse.json({ error: 'Please choose fewer monthly hours.' }, { status: 400 })
      }
    }

    const charge =
      bookingType === 'trial'
        ? computeTrialBookingCharge()
        : packageRow
          ? computePackageBookingCharge({
              monthlyPrice: packageRow.monthly_price,
              additionalChildAmount: packageRow.additional_child_amount,
              childrenCount,
            })
          : computeBookingCharge({
              hourlyRate: tutor.hourly_rate || 0,
              hoursPerMonth,
              childrenCount,
            })

    const bookingPayload = {
      tutor_id: tutor.id,
      family_id: user.id,
      family_name: familyName,
      family_phone: familyPhone || null,
      subjects: [selectedSubject],
      hours_per_month: packageRow
        ? Math.round(packageRow.frequency_per_week * packageRow.hours_per_visit * 4)
        : bookingType === 'trial'
          ? 1
          : hoursPerMonth,
      hourly_rate: bookingType === 'trial' ? charge.monthlyTotal : tutor.hourly_rate || 0,
      monthly_total: charge.monthlyTotal,
      service_fee: charge.serviceFee,
      grand_total: charge.grandTotal,
      special_requests: specialRequests || null,
      preferred_days: preferredDays,
      status: 'pending',
      booking_type: bookingType,
      pricing_model: bookingType === 'trial' ? 'trial' : pricingModel,
      package_id: packageRow?.id || null,
      package_title: packageRow?.title || null,
      frequency_per_week: packageRow?.frequency_per_week || null,
      hours_per_visit: packageRow?.hours_per_visit || null,
      children_count: childrenCount,
      lesson_format: lessonFormat,
      timezone: timezone || null,
    }

    let insert = await supabase.from('bookings').insert(bookingPayload).select('id').single<{ id: string }>()

    if (
      insert.error &&
      (
        insert.error.message.toLowerCase().includes('booking_type') ||
        insert.error.message.toLowerCase().includes('pricing_model') ||
        insert.error.message.toLowerCase().includes('package_id') ||
        insert.error.message.toLowerCase().includes('children_count') ||
        insert.error.message.toLowerCase().includes('lesson_format') ||
        insert.error.message.toLowerCase().includes('column')
      )
    ) {
      if (bookingType !== 'monthly' || pricingModel !== 'hourly') {
        return NextResponse.json(
          { error: 'This booking option needs the new Supabase SQL to be applied first.' },
          { status: 409 }
        )
      }

      const legacyPayload = {
        tutor_id: bookingPayload.tutor_id,
        family_id: bookingPayload.family_id,
        family_name: bookingPayload.family_name,
        family_phone: bookingPayload.family_phone,
        subjects: bookingPayload.subjects,
        hours_per_month: bookingPayload.hours_per_month,
        hourly_rate: bookingPayload.hourly_rate,
        monthly_total: bookingPayload.monthly_total,
        service_fee: bookingPayload.service_fee,
        grand_total: bookingPayload.grand_total,
        special_requests: bookingPayload.special_requests,
        preferred_days: bookingPayload.preferred_days,
        status: bookingPayload.status,
      }
      insert = await supabase.from('bookings').insert(legacyPayload).select('id').single<{ id: string }>()
    }

    if (insert.error) throw insert.error

    if (tutor.email) {
      await sendEmail({
        to: tutor.email,
        subject: 'New booking request on TutorConnect Gambia',
        text: composeEmail([
          `Hi ${tutor.name || 'Tutor'},`,
          '',
          `${familyName} sent you a ${bookingType === 'trial' ? 'trial' : 'monthly'} booking request for ${selectedSubject}.`,
          `Amount: GMD ${charge.grandTotal.toLocaleString()}`,
          'Please sign in to your tutor dashboard to accept or decline it.',
        ]),
      })
    }

    return NextResponse.json({ ok: true, bookingId: insert.data.id })
  } catch (error) {
    console.error('booking create failed', error)
    return NextResponse.json({ error: 'Could not create this booking request.' }, { status: 500 })
  }
}
