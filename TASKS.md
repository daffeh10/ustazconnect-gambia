# TutorConnect Gambia — Roadmap

Working task list. Read `CLAUDE.md` (or `AGENTS.md` for Codex) first.
Pick **one task**, audit → plan → implement → verify → ship. One concern per commit.
Last updated: 2026-06-29.

**Status labels:** `[NEXT]` highest priority · `[OPEN]` worthwhile soon ·
`[LATER]` valid but not now · `[MANUAL]` operational/business · `[DONE]`.

---

## 0. Already built — do NOT rebuild (audited 2026-06-29)

These exist and work; preserve them:
- Open browsing, tutor directory (`/find-tutor`), tutor profiles (`/tutor/[id]`),
  searchable location + subject inputs (`SearchableLocationInput`/`SearchableSubjectInput`).
- Deferred account creation at booking; family + tutor dashboards; admin panel
  (overview, tutors, documents, reports, payouts, analytics).
- Real Waychit payment + webhook + escrow activation + auto lesson creation.
- Tutor verification tiers (`Basic`/`Profile Reviewed`/`Qualification Verified`),
  90-day Basic grace, public name privacy (`Fatou J.`), trust-column DB trigger.
- **Reviews require a completed lesson** (verified-booking-only) — done.
- ID/document upload (`tutor_documents`, incl. `national_id`), tutor code-of-conduct
  page, report flow (`reports`), refund/dispute **policy text**.
- Basic admin analytics (signups, subjects, locations, revenue, completed lessons).
- Payouts table + admin payouts page. Sitemap, robots, Search Console, custom domain.
- Security fixes (2026-06-29): server-side amount recomputation; RLS trust-column
  trigger; `inquiries` public-read removed. See `supabase/rls_policies.sql`.

---

## Priority order

`T0.1 → T0.2 → T0.3` (foundations) → `P6 safety floor` → `P1 booking model` →
`P2 trial` → `P3 emails wired` → `P5 diaspora` → moat gaps (ongoing).

---

## Tier 0 — Foundations (unblock everything else)

### T0.1 — Server-side pricing/fee engine `[NEXT]`
**Why:** money is currently computed in the browser (security risk, already patched
in checkout) and fee rules are scattered. Centralize so fees can change per segment
(local / diaspora / trial) without touching client code.
**Do:** a single server module (e.g. `lib/pricing.ts`) that computes monthly total,
3% family fee, 5% commission, and trial (D150, 0% commission) from authoritative
tutor rates/packages. All payment routes call it. Client shows estimates only.
**Acceptance:** no monetary value is trusted from the client anywhere; checkout,
confirm, and (future) trial/diaspora all use one module; build + lint pass.

### T0.2 — Email + notification infrastructure `[NEXT]`
**Why:** no transactional emails exist today; needed by P2/P3/P5.
**Do:** integrate **Resend free tier** (3,000/mo, $0) via `lib/email.ts` with plain,
human, branded templates (reply-to `tutorconnectgambia@gmail.com`). Add **WhatsApp
click-to-chat links** (free, no API) as the channel for *local* users, who mostly
don't use email. Respect PDPP (transactional only; no marketing without consent).
**Acceptance:** a test email sends and lands in inbox (not spam); a reusable
`sendEmail()` helper exists; WhatsApp link helper exists; no new recurring cost.
**Note:** needs `RESEND_API_KEY` env var (ask Abdul before editing `.env.local`).

### T0.3 — Admin roles + owner-only admin management + audit log `[NEXT]`
**Why:** co-founders on the ground need to approve tutors; only Abdul should
grant/revoke admin; multi-admin needs accountability.
**Do:** roles on `admin_users` (`owner`, `admin`, `quran_verifier`), `is_active`,
`created_by`. Owner-only `/admin/admins` page + API to add/disable admins and set
roles (Abdul seeded as `owner`). Add an **admin audit log** (who approved/rejected
which tutor; who changed admin access). Gate everything by role in the route +
service-role writes.
**Acceptance:** Abdul can add/revoke a co-founder admin; a non-owner admin cannot;
co-founder can approve tutors; every approval/rejection + admin change is logged.

---

## P1 — Booking & pricing structure `[OPEN]`
**Why:** "hours per month" doesn't match how Gambians buy tutoring; Quran tutors
charge flat monthly.
**Do:** offer BOTH:
- **Hourly option** (keep existing).
- **Flat-monthly packages** the tutor defines — each package specifies
  **frequency (1×/week up to daily) and hours per visit**, at a flat monthly price.
  Minimum once a week; up to every day.
- **Group / sibling pricing** (multiple children sharing one tutor).
- Gambian-context extras: term-aligned WASSCE/NAQEB intensives; Ramadan handling
  for Quran.
All totals computed by the T0.1 engine; hours shown for clarity, not as the price basis.
**Acceptance:** a tutor can publish hourly + ≥1 flat-monthly package (with frequency
+ hours/visit); a family can book either; group pricing works; amounts are correct
and server-computed. Validate the model with 2–3 real tutors before wide rollout.

---

## P2 — Free first session / D150 trial `[OPEN]`
**Why:** lowers the family's trust barrier to try a tutor while protecting the
tutor's time/transport.
**Model:** first session is a **paid intro/assessment** (30–45 min), **D150
transport, no commission**, paid to us via Waychit and **held in escrow**. Tutor
attends → family confirms (or auto-confirms after 48h) → we release D150 to the
tutor. After it, the family decides whether to book monthly.
**Guardrails:** one trial per family–tutor pair; **tutor no-show → auto-refund the
family**; decide who absorbs the Waychit fee (recommend family pays D150 + fee so
tutor nets a clean D150).
**Acceptance:** a family can book + pay a trial; tutor sees it; confirm releases
D150; no-show refunds the family; commission is never charged on a trial; emails
fire (P3). Depends on T0.1 + T0.2.

---

## P3 — Email/WhatsApp updates `[OPEN]` (built on T0.2)
**Why:** today users only learn status by logging in.
**Do:** send on real state changes —
- **Registration status:** approved / not approved (+ reason / what's missing).
- **Booking lifecycle (both sides):** new request, accepted, declined, paid,
  upcoming-lesson reminder.
- **Trial + payment + payout** confirmations.
Email for diaspora/email users; WhatsApp link for local. Keep copy brief + human.
**Acceptance:** each event sends the right message to the right party; no duplicate
sends; unsubscribe/marketing rules respected; nothing blocks the core flow if email
fails.

---

## P6 — Verification: safety floor NOW `[OPEN]`
**Why:** adults enter homes with children — a non-negotiable trust + legal floor.
Maximal rigor is deferred for general tutors (would starve supply) but applied to
Quran/diaspora (P5).
**Do now:** require, before public approval — **national ID on file (private)**,
acceptance of a **safeguarding / code-of-conduct agreement**, completed core profile
+ photo + ≥1 competence evidence. Enforce the labels (the trigger makes them real).
**Defer (`[LATER]`):** progressively stricter general checks (references, credential
verification) once supply exists.
**Acceptance:** a tutor cannot be publicly approved without ID-on-file + safeguarding
acceptance + photo + evidence; labels reflect what was actually reviewed.

---

## P5 — Diaspora online Quran (future main revenue) `[OPEN]`
**Why:** highest-margin segment — diaspora pays with foreign cards; Gambian tutor
cost base. Confirmed feasible: **Waychit accepts international cards, settled in GMD**
(no separate processor needed).
**Tasks:**
- **P5.0 `[MANUAL]`** — confirm with Waychit support that international-card
  acceptance is enabled on the merchant account + get the intl-card fee schedule.
- **P5.1** — real **online lesson** flow + **timezone-aware scheduling** (tutors use
  their own WhatsApp/Zoom/Meet link at launch; no video integration).
- **P5.2** — **strict Quran verification track** (recitation video, Tajweed
  assessment, ijazah/sanad or recognized madrasa credential, scholar reference)
  reviewed by a **`quran_verifier`** admin (uses T0.3).
- **P5.3** — diaspora pricing with **"≈ $ / £ / €" display** (charge stays GMD) +
  diaspora landing page + SEO ("trusted Gambian Quran teachers online").
**Acceptance (per task):** a diaspora user can book + pay online with a foreign card;
Quran tutors can't be diaspora-listed without passing the strict track; pricing shows
foreign-currency estimates.

---

## Moat — real gaps only (the rest already exists) `[OPEN]/[LATER]`

- **Programmatic SEO** `[OPEN]` — auto-generated **subject × location** landing pages
  ("Quran tutor in Serrekunda", "WASSCE Maths tutor Brikama") + diaspora terms.
  Strongest long-term demand moat; hard for late entrants to out-rank.
- **PDPP account self-service** `[OPEN]` — account settings page with **data export +
  account deletion** (legal requirement, currently missing).
- **Referrals** `[LATER]` — tutor-refers-tutor and family-refers-family incentives
  (supply + demand liquidity).
- **In-app dispute/refund workflow** `[LATER]` — escrow dispute path beyond the
  current policy text.
- **Funnel + supply-gap analytics** `[LATER]` — profile-view→booking funnel and
  "demand with no tutors" view, on top of existing charts.
- **School / madrasa partnerships** `[MANUAL]` — MOUs to onboard trusted supply.
- **Payout ledger / reconciliation** `[LATER]` — formal ledger as volume grows.

---

## Not now (skip unless a real business reason appears)
Full Arabic site translation · heavy admin/analytics expansion · video-platform
integration · complex verification tiers beyond the two tracks · broad refactors ·
feature-heavy chat/messaging.

---

## Release rules
Before any push/deploy (ask Abdul first — see CLAUDE.md §8):
1. inspect the diff; only intended files. 2. `npm run build` + `npm run lint`.
3. run `/security-review` (payments/children's data). 4. test the real flow at phone
width. 5. state what changed, what still needs manual testing, what was excluded.
