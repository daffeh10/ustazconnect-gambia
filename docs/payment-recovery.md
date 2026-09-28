# Payment recovery and admin visibility

Prepared 28 September 2026. Local changes only; no production data changed.

## What changed

- `confirmed` remains the database value for tutor acceptance. Its displayed label is now “Accepted — awaiting payment.” Paid bookings become `active` only after payment evidence and lesson creation succeed.
- `/admin/payments` lists bookings with search and pagination, recorded receipts, every checkout attempt, Waychit request and transaction IDs, payment/check timestamps, and unresolved errors. Expected commission and tutor share use server calculations; unpaid estimates are explicitly identified. Duplicate successful payments are flagged and are not automatically refunded.
- The overview separates gross family payments, family service fees collected, and commission deducted on completed tutor payouts. Analytics labels gross family payments correctly. Financial queries paginate to avoid Supabase's row limit silently reducing totals.
- Family payment confirmation retrieves provider status when needed. Admins can check an attempt without signing in as the family. The existing daily maintenance job checks up to six pending attempts and three paid bookings awaiting activation, in bounded batches. The job still requires its existing `CRON_SECRET` and Vercel schedule.
- Checkout reserves a database row before provider creation. One pending Waychit attempt per booking is enforced by a database index. Existing active checkout links are reused after a provider check. Unknown results block creation of another request.
- Webhooks require a fresh valid HMAC and exact attempt identity, GMD currency and amount. There is no fallback to the latest payment for a booking. Successful payment status cannot be overwritten by a later failure. Lesson creation uses the unique booking/lesson-number index, with no unsafe fallback.
- Family receipts are available through “View payment receipt.” A failed return URL or network error is never treated as authoritative payment failure.

## Required release step

Abdul must apply `supabase/payment_recovery_manual.sql` in Supabase before deployment. It adds diagnostic columns, unique indexes and restrictive write policies for payments/bookings. Existing owner-scoped SELECT policies are retained. No payment, booking or lesson rows are deleted or marked paid.

The migration is transactional and deliberately stops if there are duplicate pending attempts or index conflicts. Resolve those against actual provider records first. Do not blindly mark a pending attempt failed to make the index pass. Do not run the older `task_waychit_payment_hardening.sql` as a substitute: it includes deletion of duplicate lesson rows.

### Duplicate pending attempts (resolved inside the migration)

Abdul's first run stopped at the duplicate-pending guard because the separate reconcile script had not been applied first. The cleanup is now folded into `payment_recovery_manual.sql` itself, so it is **one script, run once**. Waychit was re-queried on 28 September: all seven old June/July attempts (including `b8e22da8-…`, previously left for review) report `expired` with no success evidence, at the exact amount in GMD. Abdul confirmed those bookings were tests. The migration closes them as `cancelled`, keeps all history, and aborts if any of them has changed or gained payment evidence. `supabase/reconcile_expired_waychit_20260928_manual.sql` is superseded and no longer needs to be run.

### Payment reminder

The migration adds `bookings.payment_reminder_sent_at`. The daily maintenance cron emails the family once, with a direct `/payment/{bookingId}` link, when a booking has been `confirmed` (accepted) for 24h+ without payment. Only acceptances from the last 14 days qualify, so old test bookings are never emailed. Requires `RESEND_API_KEY` in Vercel; if email is skipped, the booking is retried on the next run.

No SQL has been executed or validated against the live database during implementation. Database-enforced races and RLS must be checked after the migration in an approved test environment. Commit, push and deployment require Abdul's approval under AGENTS.md.

## Provider contract and unresolved cases

Source: https://waychit.com/developers (retrieval examples and webhook examples, checked 28 September 2026).

Requests are retrieved through `GET /v1/payment-requests/{id}`; recorded card sessions use `GET /v1/payment-sessions/card/{id}`. Success requires explicit `paymentStatus: succeeded`, matching amount/currency and attempt ID. A lifecycle value such as `closed` alone is not success. The published retrieval example shows an active request; a real successful retrieval payload still needs validation during an approved payment test. If success details are omitted, the application flags review instead of guessing. A signed success webhook with matching evidence can still complete it.

If provider creation times out before an ID is saved, the reserved row remains visible and blocked. A later signed webhook can match its exact client reference. If no webhook arrives, check the merchant dashboard using the attempt reference in the database; recover its provider ID only after verifying the exact request and amount. If no request exists, or a request is definitively cancelled/expired, an authorized database correction can release that reservation. There is intentionally no “mark paid” or “force retry” button that bypasses provider evidence.

A payment for a cancelled booking stays recorded as money received and needs admin review; recovery does not reactivate the booking. “Payments received” is not the merchant's available balance or settlement balance. Processor fees, bank settlement, refunds and chargeback automation are not implemented here.

## Verification

Run from the repository with `/usr/local/bin` in PATH:

```sh
node --test tests/payments.test.cjs
npm run build
npm run lint
```

The regression tests use fake Supabase/provider responses, never live keys or charges. They cover missed webhooks, mismatched evidence, signature tampering and replay, duplicated/out-of-order callbacks, lesson-creation failure and recovery, cancelled bookings, foreign-family access, admin authorization, concurrent checkout reservation, checkout timeout, checkout reuse, older successful attempts, paid-booking retries, fee allocation and pagination.

Browser verification used the actual admin layout, payment page and receipt components in an isolated Chrome preview with fake accounts/API data. Checked 360px and 1440px widths, unpaid/paid/review details, recovery-button feedback, empty/error search states, missing-payment response and recovered receipt. Screenshots are in `/tmp/tutorconnect-payment-browser/`. This was component/interaction verification, not a real authenticated Supabase/Waychit transaction.

After authorized migration and deployment:

1. Open Admin → Bookings & payments. Search the September 23 booking ID `a9e139c1-c236-46c8-86c6-6c0ef4f05c75`. It should show acceptance, GMD 824 requested, GMD 0 received and no payment history until checkout is started.
2. Use an approved test booking to complete checkout. Verify GMD amount, one paid attempt, provider/transaction reference, receipt, active booking and one set of lessons.
3. In a test environment, omit the webhook and use “Check payment status” / “Check Waychit.” Confirm provider lookup recovers success or explicitly requests review if the provider omits success evidence.
4. Repeat the signed webhook and race two checkout requests in the test environment. Verify the actual database indexes prevent duplicate pending checkout rows and lessons.
5. Verify authenticated family/tutor clients cannot insert/update/delete payment or booking rows directly, can still read their own records, and non-admins cannot use `/api/admin/payments`.
6. Verify the existing maintenance cron runs with `CRON_SECRET`, and inspect its `paymentRecovery` counts and stored verification errors.

The named `/code-review`, `/security-review`, `/verify`, and `/simplify` skills were not available in this workspace/session. Equivalent code/security review, regression tests and browser checks were performed locally; no deployment was attempted.
