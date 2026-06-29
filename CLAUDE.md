# TutorConnect Gambia — Agent Instructions

> This file is auto-loaded by Claude Code every session.
> **It is identical to `AGENTS.md`** (which Abdul uses with Codex). If you change
> one, change the other — they must stay in sync.
> Keep it short and TRUE. Roadmap/feature work lives in `TASKS.md`, not here.
> Last updated: 2026-06-29.

---

## 1. What this is

- **Product:** TutorConnect Gambia — a tutoring marketplace connecting Gambian
  families with qualified in-person tutors (all subjects), and — next — Gambian
  Quran tutors with the **diaspora** for online lessons (the future main revenue).
- **Live:** https://tutorconnectgambia.com  · **Repo:** github.com/daffeh10/ustazconnect-gambia
- **Owner / sole developer:** Abdul. Co-founders on the ground in The Gambia will
  become admins (see TASKS). Support email: `tutorconnectgambia@gmail.com`.
- **Stage:** past prototype. Real bookings + payments work. Focus now is trust,
  conversion, supply, and the diaspora Quran product.

## 2. Tech stack (actual)

| Tool | Version | Notes |
|------|---------|-------|
| Next.js | 16.x (App Router) | **Middleware lives in `proxy.ts`** — Next 16 renamed `middleware.ts`→`proxy.ts`, export is `proxy()`. There is no `middleware.ts`. |
| TypeScript | ^5 | No `any`. |
| Tailwind CSS | ^4 | No inline styles, no arbitrary values (`w-[347px]`). |
| Supabase | js ^2, ssr ^0.8 | Auth + Postgres + Storage. RLS is ON for every table. |
| Waychit | REST `api.waychit.com/v1` | Payments. **Not** ModemPay (that was a previous plan). |
| recharts | ^3 | Admin analytics. |
| Resend | (planned, free tier) | Transactional email — see TASKS T0.2. |
| Vercel | Hobby | Auto-deploys on push to `main`. |

## 3. Current product truth

- **Payments = Waychit, settled in GMD.** Checkout: `app/api/payments/create-checkout`
  → Waychit hosted page → webhook `app/api/payments/webhook` (HMAC-verified) →
  `lib/payment-fulfillment.ts` activates the booking + creates lessons. Confirm
  fallback: `app/api/payments/confirm`. Waychit also accepts **international
  cards** (Visa/Mastercard/Apple Pay) from the diaspora, **charged in GMD** — so
  the diaspora product needs no separate processor.
- **Auth = email + password** (Supabase). Browsing is open; account creation is
  deferred until the user acts (booking/review) via `AuthModal`. Password reset is
  a two-step flow (`/reset-password-email` → real reset) to survive email-scanner
  prefetch.
- **Routes:** `/find-tutor`, `/tutor/[id]`, `/book/[tutorId]`, `/payment/*`,
  `/dashboard` (tutor), `/family/dashboard`, `/admin/*`, legal pages.
  Old `/find-ustaz`, `/ustaz/[id]`, `/register-ustaz` are **permanent redirects**
  in `next.config.ts` — do not recreate those folders.
- **Verification labels:** `Basic` → `Profile Reviewed` → `Qualification Verified`.
  Public tutor names show **first name + last initial** (`Fatou J.`); full name is
  admin-only. `Basic` tutors have a 90-day public grace period
  (`lib/tutor-review.ts` `isTutorPubliclyVisible`).

## 4. Revenue model

- **Family service fee: 3%** added on top of the lesson cost.
- **Tutor commission: flat 5%** deducted at payout (tutor keeps 95%).
- **Trial session: D150** transport-only, **no commission** (see TASKS P2).
- Escrow: family pays upfront → held → released to tutor after lessons are
  confirmed (auto-confirm after 24h if no dispute).
- **Payout timing:** regular tutor payouts settle **monthly** — a lesson is payable
  only after its calendar month has ended (`lib/payouts.ts`). The **trial** session
  is the exception: D150 paid within 48h of completion + family confirmation (P2).
- **All money math is server-side**, via `lib/pricing.ts` (charges) and
  `lib/payouts.ts` (payouts). See the gotcha below.

## 5. Gotchas — the things agents get wrong here (read before editing)

1. **NEVER compute or trust money on the client.** Booking rows are inserted from
   the browser, so amounts can be tampered with. The server **recomputes** every
   charge from the tutor's authoritative rate (see `app/api/payments/create-checkout`).
   All fee logic must live server-side. (This is being centralized — TASKS T0.1.)
2. **RLS is the only real security boundary.** Client-side `is_approved`/owner
   filters are cosmetic — anyone can query with the public anon key. Enforce access
   in Postgres RLS, not in React.
3. **Trust columns are protected by a DB trigger.** `tutor_profiles.is_approved`
   and `verification_status` can only be set by the **service-role key** (admin
   server). A trigger forces them to safe values for everyone else. Do **not** try
   to set them from client code — set them in `/api/admin/*` routes (service role).
   See `supabase/rls_policies.sql`.
4. **Middleware is `proxy.ts`**, not `middleware.ts` (Next 16). Route protection
   for `/dashboard`, `/family/*`, `/admin/*` lives there.
5. **Payments are Waychit, not ModemPay.** Ignore any older ModemPay references.

## 6. Database

RLS is enabled on all tables; policies are owner-scoped. Key tables:
`tutor_profiles`, `family_profiles`, `admin_users` (has `role`), `bookings`,
`lessons`, `payments`, `payouts`, `reviews`, `reports`, `tutor_documents`,
`inquiries` (legacy). Storage: `avatars` (public), `documents` (private).
**The committed source of truth for RLS hardening is `supabase/rls_policies.sql`.**
Subjects and locations live in `lib/constants.ts` — use them, don't hardcode lists.

## 7. Design system (match existing components)

Emerald primary (`bg-emerald-600`/`hover:bg-emerald-700`), gray-50 bg, white cards
(`rounded-xl shadow-sm border border-gray-100`), inputs with
`focus:ring-2 focus:ring-emerald-500`. Currency is always `GMD 2,400`
(`amount.toLocaleString()`), never `D2400`. **Mobile-first from 360px**, 48px touch
targets, system fonts, skeletons not spinners. When in doubt, copy the patterns in
existing components rather than inventing new ones.

## 8. Hard rules

**ALWAYS ask Abdul before:** any `git commit`/`push`, any deploy, running Supabase
SQL/migrations, editing `.env.local`, changing the payment provider/keys, editing
`proxy.ts` or `next.config.ts`, installing npm packages, renaming route folders,
deleting any file.

**NEVER:** `rm -rf`; drop/truncate tables; expose keys in code; use `any`; use
Lorem ipsum or AI-boilerplate copy; use inline styles or arbitrary Tailwind values;
skip try/catch on async; skip loading/error/empty states; compute money client-side.

**Every file must have:** typed props/state/responses; try/catch on every async;
loading + error + empty states; mobile-first layout; comments only for non-obvious
logic.

## 9. Workflow (the playbook loop)

**Explore → Plan → Execute → Verify → Ship.** For anything touching more than one
file: read first, plan in plain English, then implement. Never let a change be
"done" until something other than your eyes confirms it:

- **Verify gate:** `npm run build` AND `npm run lint` must pass, then **test the
  real behavior** (open the page, run the flow, check at phone width).
- Use **`/code-review`** on diffs, **`/security-review`** before any deploy
  (payments + children's data — non-negotiable), **`/verify`** or **`/run`** to
  prove behavior in the browser, **`/simplify`** to clean up after a change.
- The installed economics skills (`data-audit`, `econ-*`, etc.) are for a different
  project — **not relevant here**, don't use them.
- **Self-improvement:** when you get something wrong about this codebase, add a
  one-line rule to `tasks/lessons.md`; promote recurring ones into §5 above.

## 10. Commands

```bash
# dev server
/bin/zsh -lc 'PATH=/usr/local/bin:$PATH /usr/local/bin/node node_modules/next/dist/bin/next dev --webpack'
# build / lint (the verify gate)
/bin/zsh -lc 'PATH=/usr/local/bin:$PATH npm run build'
/bin/zsh -lc 'PATH=/usr/local/bin:$PATH npm run lint'
# stop dev
pkill -f "next dev --webpack"   # fallback: lsof -ti :3000 | xargs kill -9
git status --short
```

## 11. After every change, tell Abdul

1. What file(s) changed and why. 2. Exact test steps. 3. Mobile vs desktop
differences. 4. Any SQL to run in Supabase (never run it yourself). 5. What you
intentionally did **not** include.

---

**Posture:** move fast, but stay strict. AI increases leverage; Abdul owns the
priorities, the trust trade-offs, and what counts as "good enough."
