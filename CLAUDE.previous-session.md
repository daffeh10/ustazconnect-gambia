# TutorConnect Gambia — Project Instructions for AI Coding Agents

> This file is auto-read by Claude Code at session start and can be referenced
> by Codex. It contains EVERYTHING an AI agent needs to work on this project.
> Do NOT delete or rename this file.

---

## 1. PROJECT IDENTITY

**Name:** TutorConnect Gambia
**What it is:** The Gambia's tutoring marketplace — connects families with
qualified in-person (and soon online) tutors across ALL subjects.
**Developer:** Abdul (sole developer). MacBook, VS Code, Claude Code + Codex.
**Repo:** github.com/daffeh10/ustazconnect-gambia
**Live:** https://ustazconnect-gambia2026-xskw.vercel.app
**Target domain:** tutorconnectgambia.com (to be purchased)

---

## 2. TECH STACK

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16+ | App Router framework |
| TypeScript | ^5 | Type-safe code |
| Tailwind CSS | ^4 | Styling |
| Supabase | @supabase/supabase-js ^2, @supabase/ssr ^0.8 | Database + Auth + Storage |
| recharts | ^3 | Admin analytics charts |
| React | 19.x | UI library |
| ModemPay | `modem-pay` npm package | Payment processing (DEFAULT) |
| Vercel | Hobby plan | Hosting (auto-deploy on git push) |

---

## 3. PAYMENT SYSTEM

### ModemPay is the DEFAULT and ONLY payment provider at launch.
ModemPay handles ALL payment methods through a single checkout page:
AfriMoney, QMoney, Wave, bank transfers, and cards.

- **SDK:** `modem-pay` (npm package)
- **Dashboard:** https://merchant.modempay.com
- **Docs:** https://docs.modempay.com
- **API key format:** `sk_test_...` (secret), `pk_test_...` (public)
- **Sandbox:** YES — use `sk_test_` keys during development
- **Currency:** GMD (Gambian Dalasi)
- **Webhook events:** `charge.succeeded`, `charge.failed`, `charge.cancelled`
- **Local webhook testing CLI:** `npm install -g modem-pay-cli`
  then: `modempay listen --forward-url=http://localhost:3000/api/payments/webhook`

### Collecting payments from families:
```typescript
import ModemPay from "modem-pay";
const modempay = new ModemPay(process.env.MODEMPAY_SECRET_KEY!);

const intent = await modempay.paymentIntents.create({
  amount: totalAmount,       // in GMD (lesson cost + 3% service fee)
  currency: "GMD",
  metadata: {
    booking_id: bookingId,
    family_id: familyId,
    tutor_id: tutorId,
  }
});
// Redirect user to: intent.data.payment_link
// ModemPay's hosted page lets user choose AfriMoney, QMoney, Wave, or card
```

### Paying out tutors:
```typescript
const payout = await modempay.transfers.initiate({
  amount: tutorEarnings,          // lesson total minus 10% commission
  currency: "GMD",
  network: "afrimoney",           // or "qmoney"
  account_number: "7XXXXXX",      // tutor's phone number
  beneficiary_name: "Tutor Name",
  narration: "TutorConnect payout",
  metadata: { payout_id: payoutId }
}, crypto.randomUUID());          // idempotency key (prevents duplicates)
```

### Wave direct API — FUTURE (Phase 7)
Will be added as an additional option when Abdul's business is registered
in The Gambia and Wave business account is approved. Until then, families
who use Wave can still pay through ModemPay's checkout (ModemPay supports Wave).

### Environment variables:
```
MODEMPAY_SECRET_KEY=sk_test_xxxxx    # Secret key from ModemPay dashboard
MODEMPAY_PUBLIC_KEY=pk_test_xxxxx    # Public key from ModemPay dashboard
MODEMPAY_WEBHOOK_SECRET=             # Webhook signing secret from dashboard
```

---

## 4. REVENUE MODEL

### Family service fee: 3% on every booking
- Families pay: tutor's lesson cost + 3% platform service fee
- This is SEPARATE from any mobile money transaction fee charged by the provider
- Example: Tutor charges GMD 2,400/month → family pays GMD 2,400 + GMD 72 fee = GMD 2,472
- Display clearly on the booking review step: "Service fee (3%): GMD 72"

### Tutor commission: 10% → 5% (tiered)
| Level | Commission | Tutor Keeps | Trigger |
|-------|-----------|-------------|---------|
| Standard | 10% | 90% | Default for all new tutors |
| Excellent | 5% | 95% | 50+ hours taught AND 4.0+ average rating |

- Commission is deducted automatically when processing payouts
- Example: Family pays GMD 2,472 total. Service fee (GMD 72) goes to platform.
  Lesson amount (GMD 2,400): platform takes 10% (GMD 240), tutor gets GMD 2,160.
- Total platform revenue per booking: GMD 72 (service fee) + GMD 240 (commission) = GMD 312

### Cost breakdown shown to families:
```
Tutor rate:         GMD 300/hr
Hours per month:    × 8
Subtotal:           GMD 2,400
Service fee (3%):   GMD 72
─────────────────────────────
You pay:            GMD 2,472
```

### Escrow flow:
1. Family pays full amount upfront → held in TutorConnect's ModemPay wallet
2. Tutor marks each lesson "completed"
3. Family confirms (auto-confirmed after 24 hours if no dispute)
4. Lesson's payment released to tutor's earnings balance
5. Tutor requests payout → admin processes via ModemPay transfers API
6. Commission deducted, remainder sent to tutor's mobile money account

---

## 5. AUTHENTICATION

### Phone-first, email-secondary
- **Primary:** Phone number with OTP (most Gambians have phones, many don't use email)
- **Secondary:** Email + password (for users who prefer it)
- **OTP provider:** Twilio (configured in Supabase Auth → Phone)
- **Phone format:** +220 followed by 7 digits (e.g., +220 7123456)

### Progressive registration (CRITICAL UX pattern)
Users browse freely. Auth is triggered ONLY at action points:

| Action | Requires Login? |
|--------|----------------|
| Browse homepage, search tutors | No |
| View tutor profiles, read reviews | No |
| Filter by subject, location, price | No |
| Book a lesson | Yes — open AuthModal |
| Leave a review | Yes — open AuthModal |
| Report a tutor | Yes — open AuthModal |
| Access dashboard | Yes — middleware redirect |

### AuthModal behavior:
- Phone tab shown FIRST (default selected)
- Email tab as secondary option
- After successful first-time auth → auto-create `family_profiles` row
- After auth → return user to exactly where they were trying to go

---

## 6. DATABASE

### Table migration status:
The table `ustaz_profiles` is being renamed to `tutor_profiles`.
Check TASKS.md — if Task 1.2 is marked [DONE], use `tutor_profiles`.
If not yet done, use `ustaz_profiles`.

### All tables (Supabase public schema, RLS enabled):
| Table | Purpose |
|-------|---------|
| `tutor_profiles` (or `ustaz_profiles`) | Tutor data: name, phone, subjects, rate, verification |
| `family_profiles` | Parent/family accounts |
| `admin_users` | Admin accounts with role |
| `bookings` | Lesson package bookings |
| `lessons` | Individual lesson records |
| `payments` | Payment records (ModemPay) |
| `payouts` | Tutor payout requests |
| `reviews` | Star ratings + comments |
| `reports` | User-submitted reports |
| `tutor_documents` | Uploaded ID, certificates, CV |
| `inquiries` | Legacy inquiry records |

### Storage buckets:
- `avatars` — PUBLIC — tutor profile photos
- `documents` — PRIVATE — ID cards, certificates, CVs

---

## 7. SUBJECT CATEGORIES

These MUST be used in `lib/constants.ts`. Include ALL of these:

```
Religious Education:
  Quran Reading, Tajweed, Hifz (Memorization), Arabic Language, Islamic Studies

Mathematics:
  Basic Mathematics, General Mathematics, Additional Mathematics,
  Further Mathematics, Statistics

Sciences:
  Physics, Chemistry, Biology, Agricultural Science, Computer Science

Languages:
  English Language, English Literature, French, Arabic

Humanities:
  Economics, Geography, History, Government, Civic Education, Social Studies

Business:
  Accounting, Commerce, Business Studies

Exam Preparation (National):
  WASSCE Prep, NAQEB Prep, University Entrance

Exam Preparation (International):
  Cambridge IGCSE Prep, Cambridge Checkpoint Prep, SAT Prep, IELTS Prep
```

The "Exam Preparation (International)" category is for international schools
in The Gambia that follow the Cambridge curriculum.

---

## 8. ONLINE LESSONS (BASIC PLACEHOLDER)

Online tutoring is a FUTURE feature. At launch, include these placeholders:

1. **Tutor profile field:** `offers_online: boolean` (default false)
   - Tutors toggle this ON in their profile settings
   - Tutor card shows small badge: "Also available online" (blue-100 text-blue-700)

2. **Filter on /find-tutor:** Toggle switch: "Online available"
   - Filters to tutors where `offers_online = true`

3. **Homepage banner:** Small section below hero:
   "Coming Soon: Online Lessons — Learn from anywhere in The Gambia"
   (styled subtle, not dominant — emerald-50 background, small text)

4. **Booking flow:** When tutor offers online AND family selects it:
   - Show "Lesson format" choice: "In-person" or "Online"
   - If online selected, show note: "Your tutor will contact you with the
     meeting link before the lesson" (no video platform integrated yet)
   - Save `lesson_format: 'in_person' | 'online'` in bookings table

No video platform integration at launch. Tutors use their own
WhatsApp/Zoom/Google Meet and share links directly.

---

## 9. LOCATION REGIONS

```
Greater Banjul Area:
  Banjul, Serrekunda, Bakau, Fajara, Kololi, Kotu, Bijilo, Brufut,
  Sukuta, Brusubi, Kerr Serign, Tallinding, Bundung, Latrikunda,
  Pipeline, Tabokoto, Kanifing

West Coast Region:
  Brikama, Gunjur, Sanyang, Kartong, Tanji, Batokunku, Ghana Town, Lamin

North Bank Region:
  Barra, Essau, Kerewan, Farafenni

Lower River Region:
  Mansakonko, Soma, Pakalinding

Central River Region:
  Janjanbureh, Kuntaur, Bansang

Upper River Region:
  Basse Santa Su, Fatoto
```

---

## 10. DESIGN SYSTEM (MANDATORY)

### Colours
```
Primary:        bg-emerald-600   hover:bg-emerald-700
Primary light:  bg-emerald-50    text-emerald-700
Background:     bg-gray-50
Cards:          bg-white
Borders:        border-gray-200 or border-gray-300
Body text:      text-gray-600
Headings:       text-gray-900
Muted:          text-gray-500
Error:          bg-red-50 border-red-200 text-red-700
Success:        bg-emerald-50 border-emerald-200 text-emerald-700
Warning:        bg-amber-50 border-amber-200 text-amber-700
Online badge:   bg-blue-100 text-blue-700
```

### Buttons
```
Primary:   bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors
Secondary: bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors
Danger:    bg-red-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-red-700 transition-colors
```

### Cards, inputs, typography, spacing, badges
```
Cards:     bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow
Inputs:    w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
Page title:    text-3xl md:text-4xl font-bold text-gray-900
Section title: text-2xl font-bold text-gray-900
Card title:    text-lg font-semibold text-gray-900
Body:          text-base text-gray-600
Small:         text-sm text-gray-500
Spacing:       py-16 or py-24 for sections, p-6 for cards, gap-4 or gap-8
Badges:
  Verified:  bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium
  Basic:     bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium
  Premium:   bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium
  Online:    bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium
```

### Currency formatting (use everywhere):
```typescript
function formatGMD(amount: number): string {
  return `GMD ${amount.toLocaleString()}`;
}
// Output: "GMD 2,400" — never "D2400" or "2400 GMD"
```

---

## 11. MOBILE-FIRST PATTERNS

- **Baseline:** 360px (cheap Android phones: Tecno, Infinix)
- **Tablet:** 768px (md: breakpoint)
- **Desktop:** 1024px (lg: breakpoint)
- **Touch targets:** minimum 48×48px
- **Single column** on mobile, multi-column on desktop only
- **Bottom nav bar** on mobile (hidden on lg:): Search, Bookings, Messages, Profile
- **System fonts only** — no web fonts (saves 50-100KB)
- **Page size target:** under 500KB (ideally 200KB)
- **Skeleton screens** while loading (not spinners)
- **No map search** — use text dropdowns for location selection

---

## 12. LEGAL COMPLIANCE (PDPP Act 2025)

The Gambia's Personal Data Protection and Privacy Act is in effect NOW
with no grace period. Maximum penalty: GMD 1,000,000 or 5% of gross income.

### In code:
- Consent checkbox on ALL registration forms (required)
- Save `consent_given_at` timestamp in database
- Privacy Policy page references the PDPP Act 2025
- Users can access, correct, and delete their data
- Account deletion option in settings
- Never store data without consent

---

## 13. URL STRUCTURE (TARGET STATE)

### Route migration: `/find-ustaz` → `/find-tutor`, `/ustaz/[id]` → `/tutor/[id]`
Old routes kept as permanent redirects in next.config.ts.

```
/                        Homepage (search-first, no gate)
/find-tutor              Tutor directory with filters
/tutor/[id]              Tutor profile + reviews
/book/[tutorId]          Booking flow (auth required)
/payment/[bookingId]     Payment page (ModemPay)
/payment/success         Confirmation
/payment/failed          Error + retry

/login                   Phone OTP (default tab) + Email
/register                Choice: Tutor or Family
/register/tutor          Tutor signup
/register/family         Family signup

/dashboard               Tutor dashboard
/family/dashboard        Family dashboard

/admin/*                 Admin panel (login, tutors, documents, reports, payouts, analytics)

/terms                   Terms of Service
/privacy                 Privacy Policy
/refund-policy           Refund Policy
/tutor-conduct           Tutor Code of Conduct
```

---

## 14. ENVIRONMENT VARIABLES

```
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://luoanlixeldvtfpeofkt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
NEXT_PUBLIC_SITE_URL=https://ustazconnect-gambia2026-xskw.vercel.app

# ModemPay (required for payments)
MODEMPAY_SECRET_KEY=sk_test_xxxxx
MODEMPAY_PUBLIC_KEY=pk_test_xxxxx
MODEMPAY_WEBHOOK_SECRET=xxxxx

# Twilio (required for phone OTP)
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_MESSAGING_SERVICE_SID=xxxxx

# Future
# WAVE_API_KEY=          (when business registered)
# WAVE_WEBHOOK_SECRET=
```

---

## 15. RULES FOR AI AGENTS (Claude Code AND Codex)

### ALWAYS ask Abdul first before:
- Deleting any file or folder
- Running Supabase SQL or database migrations
- Changing .env.local
- Renaming route folders
- Installing npm packages
- Any git commit or git push
- Modifying middleware.ts or next.config.ts

### Safe to do without asking:
- Editing existing .tsx / .ts files
- Creating new component files in app/components/
- Creating new files in lib/, hooks/, types/
- Reading/viewing any file
- Running npm run dev or npm run build

### NEVER do:
- `rm -rf` anything
- Drop or truncate tables
- Expose API keys in code
- Push to git without instruction
- Use `any` type in TypeScript
- Use Lorem ipsum
- Use inline styles instead of Tailwind
- Use arbitrary Tailwind values (e.g., `w-[347px]`)
- Skip try/catch on async functions
- Skip loading/error states

### Every file must have:
1. TypeScript types for props, state, API responses
2. try/catch on every async function
3. Loading state (skeleton or spinner)
4. Error state with user-friendly message
5. Mobile-first design (360px → md: → lg:)
6. Comments explaining non-obvious logic

### After every change, tell Abdul:
1. What file(s) changed and why
2. Exact test steps
3. Mobile vs desktop differences
4. Any SQL to run in Supabase

---

## 16. CURRENT SITE STATUS (as of March 2026)

### Working and should be PRESERVED:
- Homepage with hero, LocationSearch, "How It Works", tutor/family CTAs
- Branding: already says "TutorConnect Gambia" everywhere
- All Gambian locations in dropdown (grouped by region)
- Tutor registration form (email/password + consent checkbox)
- Family registration form
- Tutor directory at /find-ustaz with location + subject filters
- Tutor profile pages at /ustaz/[id] with reviews + report modal
- Tutor dashboard (profile, bookings, lessons, earnings tabs)
- Family dashboard (bookings, lessons, payments)
- Booking flow at /book/[tutorId] with cost breakdown
- Admin panel (overview, tutors, documents, reports, payouts, analytics)
- Review system (leave review, star rating, tutor response)
- Verification badges (Basic/Verified/Premium)
- Legal pages (terms, privacy, refund, tutor conduct)
- Auth pages (login, register/tutor, register/family)
- Sitemap + robots.txt
- Payment simulation (placeholder)

### Known issues to fix (in TASKS.md):
- Routes use /find-ustaz and /ustaz/[id] — need migration to /find-tutor
- Database table still named `ustaz_profiles` — needs rename to `tutor_profiles`
- New tutors auto-approved (is_approved defaults true) — should be false
- No middleware.ts — no route protection
- /register path returns 404 (missing page.tsx)
- Legacy /register-ustaz page is orphaned
- No phone auth (currently email-only)
- Payment is simulation only (needs ModemPay)
- No Cambridge IGCSE/Checkpoints in subjects
- No online lesson option
- Revenue model needs updating (old: 15/10/5, new: 10/5 + 3% family fee)
- GitHub repo description says "Quran teachers" — needs update
- Copyright says 2025 — should be 2026
- middleware.legacy.ts exists but inactive — needs cleanup
- lib/supabase.ts is old legacy client

### What to build next:
Open TASKS.md → find first task not marked [DONE] → tell agent to do it.
