-- Apply manually before deploying the payment recovery changes.
-- No existing payment, lesson or booking is deleted or marked paid here.
BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_kind text NOT NULL DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_error text;

-- Lets the daily maintenance job send the "please complete payment" email once.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamptz;

-- Close the seven June/July test checkouts that were left pending. Waychit was
-- re-queried on 2026-09-28: every one reports status "expired" with no success
-- evidence, at the exact amount and in GMD. Abdul confirmed these bookings were
-- tests. Nothing is deleted or marked paid; bookings and lessons are untouched.
-- Each row is re-checked here and the whole migration aborts if one has changed
-- or gained payment evidence. Re-running this block is a no-op.
DO $$
DECLARE
  expected record;
  payment_record public.payments%ROWTYPE;
  audit_note constant text := '2026-09-28 audit: Waychit request expired with no success evidence; amount and GMD matched. Test checkout closed; payment history retained.';
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('13a62098-e169-4561-bfab-04781b27cc4a'::uuid, 'bfd13bec-76f9-4f79-9256-2987dcf7f5bf'::uuid, '01KYPPXQDM6Z58SJHZ42ERHQNB', 618),
      ('8053bdf2-ca3d-4073-b110-cf4c4add9ad1'::uuid, 'bfd13bec-76f9-4f79-9256-2987dcf7f5bf'::uuid, '01KYPPQNM03NCJN9J64BNTHDSA', 618),
      ('345e8257-4aa5-4836-a51c-5b79d1dfe4b6'::uuid, '6f3bb4bf-479c-4aba-96ae-c22547ab682f'::uuid, '01KW82W8KB86Q245NQD78PZS10', 1030),
      ('d28b5ac7-7f2d-400d-affb-7ef77b49fc72'::uuid, '6f3bb4bf-479c-4aba-96ae-c22547ab682f'::uuid, '01KVFMTTCMXE5VX941CK203MGB', 1030),
      ('b8e22da8-e545-4756-ae64-398b48313288'::uuid, '6f3bb4bf-479c-4aba-96ae-c22547ab682f'::uuid, '01KVFK00SZ1SJATZ2NZHG621TD', 1030),
      ('3c497fd2-b6ba-462b-ae23-029b21c4c911'::uuid, '0d831d3f-6b38-4f2b-9088-c5d6364d6e6a'::uuid, '01KW6NDTW9197W0G95C9T7DWWS', 1854),
      ('d36fd71d-f6ba-4c20-b47f-b2a7cecfa56d'::uuid, '0d831d3f-6b38-4f2b-9088-c5d6364d6e6a'::uuid, '01KW6Q6TAP9AY2KWTZ1CC6DV80', 1854)
    ) AS checked(id, booking_id, provider_id, total)
  LOOP
    SELECT * INTO payment_record FROM public.payments WHERE id = expected.id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audited payment % is missing; nothing applied', expected.id;
    END IF;
    IF payment_record.booking_id IS DISTINCT FROM expected.booking_id
      OR payment_record.provider_payment_id IS DISTINCT FROM expected.provider_id
      OR payment_record.total IS DISTINCT FROM expected.total
      OR payment_record.payment_method IS DISTINCT FROM 'waychit'
      OR payment_record.paid_at IS NOT NULL
      OR NULLIF(btrim(payment_record.wave_reference), '') IS NOT NULL
    THEN
      RAISE EXCEPTION 'Audited payment % changed or now has payment evidence; nothing applied', expected.id;
    END IF;

    IF payment_record.status = 'pending' THEN
      UPDATE public.payments SET
        status = 'cancelled',
        provider_status = 'expired',
        last_checked_at = TIMESTAMPTZ '2026-09-28 12:00:00+00',
        verification_error = audit_note
      WHERE id = expected.id;
    ELSIF payment_record.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Audited payment % has unexpected status %; nothing applied', expected.id, payment_record.status;
    END IF;
  END LOOP;
END $$;

-- Stop for manual reconciliation if old concurrent attempts exist. Do not
-- silently discard a request that may still be payable at Waychit.
DO $$
BEGIN
  IF EXISTS (
    SELECT booking_id FROM public.payments
    WHERE payment_method = 'waychit' AND status = 'pending'
    GROUP BY booking_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Reconcile duplicate pending Waychit attempts before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_waychit_booking
  ON public.payments (booking_id)
  WHERE payment_method = 'waychit' AND status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_key
  ON public.payments (provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_waychit_client_reference_key
  ON public.payments (intent_secret)
  WHERE payment_method = 'waychit' AND intent_secret IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lessons_booking_lesson_number_key
  ON public.lessons (booking_id, lesson_number);

-- Payment evidence must only be written by trusted server routes. Restrictive
-- policies also protect installations with older permissive write policies.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_server_insert_only ON public.payments;
CREATE POLICY payments_server_insert_only ON public.payments AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS payments_server_update_only ON public.payments;
CREATE POLICY payments_server_update_only ON public.payments AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS payments_server_delete_only ON public.payments;
CREATE POLICY payments_server_delete_only ON public.payments AS RESTRICTIVE
  FOR DELETE TO anon, authenticated USING (false);

-- Booking creation/respond routes already use the service role. Prevent direct
-- client writes from forging an active booking or changing its payout amounts.
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookings_server_insert_only ON public.bookings;
CREATE POLICY bookings_server_insert_only ON public.bookings AS RESTRICTIVE
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS bookings_server_update_only ON public.bookings;
CREATE POLICY bookings_server_update_only ON public.bookings AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS bookings_server_delete_only ON public.bookings;
CREATE POLICY bookings_server_delete_only ON public.bookings AS RESTRICTIVE
  FOR DELETE TO anon, authenticated USING (false);

COMMIT;
