-- Waychit payment hardening.
-- Run this once in Supabase SQL Editor before relying on payment webhook retries at scale.

-- If duplicate lessons already exist for the same booking/lesson number, keep the oldest row.
WITH duplicate_lessons AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id, lesson_number
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS row_number
  FROM public.lessons
  WHERE booking_id IS NOT NULL
    AND lesson_number IS NOT NULL
)
DELETE FROM public.lessons
WHERE id IN (
  SELECT id
  FROM duplicate_lessons
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS lessons_booking_lesson_number_key
ON public.lessons (booking_id, lesson_number);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_key
ON public.payments (provider_payment_id)
WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_waychit_client_reference_key
ON public.payments (intent_secret)
WHERE payment_method = 'waychit'
  AND intent_secret IS NOT NULL;
