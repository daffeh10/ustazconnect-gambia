# TutorConnect Gambia — TASKS_phases345.md
# Claude Code instruction file for Phases 3, 4 & 5
#
# ═══════════════════════════════════════════════════════════════
# HOW TO USE THIS FILE — READ FIRST
# ═══════════════════════════════════════════════════════════════
#
# EVERY SESSION — start Claude Code with this exact message:
#
#   "Read CLAUDE.md and TASKS_phases345.md.
#    Find all tasks marked [DONE] in the headings.
#    Tell me the next incomplete task and what it will do.
#    Do NOT write any code yet. Wait for my approval."
#
# GOLDEN RULES:
#   ✗ One task at a time — never do two at once
#   ✗ Never skip the TEST STEPS — always check it yourself
#   ✗ Never let Claude Code run SQL — you paste it in Supabase
#   ✗ Never let Claude Code run git — you do that yourself
#   ✗ Never approve deleting a file without asking why first
#   ✓ Task → test → confirm → next task
#
# AFTER EACH TASK IS CONFIRMED:
#   1. Add [DONE] to the task heading in this file
#   2. Run: git add . && git commit -m "Task X.X: short description" && git push
#
# ═══════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════
# PHASE 3 — TRUST & VERIFICATION
# Purpose: Make families feel safe enough to book a tutor.
# Complete ALL Phase 3 tasks before starting Phase 4.
# ═══════════════════════════════════════════════════════════════


## TASK 3.1 — VerificationBadge component

### WHAT THIS DOES
Creates a small coloured badge showing a tutor's trust level.
Adds it to every tutor card in search results and to each tutor's profile page.

### FILES TO CREATE
- app/components/VerificationBadge.tsx

### FILES TO UPDATE
- app/find-ustaz/page.tsx    (add badge to each tutor card — READ FILE FIRST)
- app/ustaz/[id]/page.tsx    (add badge below tutor name — READ FILE FIRST)

### COMPONENT SPEC
```typescript
// Props: { status: string }
// 'basic'    → bg-gray-100 text-gray-600   → text "Basic"
// 'verified' → bg-emerald-100 text-emerald-700 → text "✓ Verified"
// 'premium'  → bg-amber-100 text-amber-700    → text "⭐ Premium"
// All use: px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1
// If status is undefined/null/empty: treat as 'basic'
```

### TEST STEPS
1. npm run dev → go to http://localhost:3000/find-ustaz
2. Every tutor card shows a gray "Basic" badge below the tutor's name
3. In Supabase → Table Editor → tutor_profiles → set one tutor's
   verification_status to 'verified'
4. Refresh → that tutor shows a green "✓ Verified" badge
5. Click that tutor's profile → badge appears on the profile page too


---


## TASK 3.2 — Document upload system

### STOP — TELL ME TO DO THESE MANUALLY BEFORE ANY CODE

MANUAL STEP A — Create private Supabase Storage bucket:
  Supabase → Storage → New Bucket
  Name: documents    (exactly this, lowercase)
  Public bucket: NO  (must be unchecked — this protects sensitive ID files)
  Click Create

MANUAL STEP B — Run this SQL in Supabase → SQL Editor → New Query:

CREATE TABLE IF NOT EXISTS tutor_documents (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id         UUID REFERENCES tutor_profiles(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL,
  document_name    TEXT NOT NULL,
  document_url     TEXT NOT NULL,
  status           TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT now(),
  reviewed_at      TIMESTAMPTZ
);
ALTER TABLE tutor_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tutors manage own documents" ON tutor_documents
  FOR ALL USING (
    tutor_id IN (SELECT id FROM tutor_profiles WHERE user_id = auth.uid())
  );

Wait for my confirmation of both steps before writing any code.

### FILES TO CREATE
- app/components/DocumentUpload.tsx

### FILES TO UPDATE
- app/dashboard/page.tsx    (add "Verification Documents" section — READ FILE FIRST)

### DocumentUpload SPEC
```typescript
// Props: { tutorId: string, documentType: 'national_id'|'certificate'|'cv', label: string }
// On mount: fetch existing document of this type from tutor_documents for this tutorId
// Show current status badge: Pending=amber, Approved=green, Rejected=red + rejection_reason
// Upload button: accepts image/* and application/pdf, max 5MB
//   If file > 5MB: alert("File must be under 5MB. Please choose a smaller file.")
// Upload path in Supabase Storage: {tutorId}/{documentType}/{Date.now()}-{filename}
// Bucket: 'documents'
// After upload: INSERT row into tutor_documents, refresh the status display
```

### DASHBOARD ADDITIONS
Add below the ImageUpload component, above the Save button:
  Heading: "Verification Documents" (text-lg font-semibold text-gray-900)
  Subtext: "Upload your ID and certificates to earn a Verified badge. We review within 24 hours."
  Three DocumentUpload components:
    documentType="national_id"  label="National ID or Passport (required)"
    documentType="certificate"  label="Teaching Certificate or Degree (required)"
    documentType="cv"           label="CV / Resume (optional)"

### TEST STEPS
1. Log in as tutor → dashboard → scroll to "Verification Documents"
2. Click upload for National ID → pick a small image or PDF
3. Yellow "Pending" badge appears next to the document name
4. Supabase → Storage → documents bucket → file is there
5. Supabase → Table Editor → tutor_documents → new row exists


---


## TASK 3.3 — Reviews and ratings system

### STOP — TELL ME TO RUN THIS SQL FIRST

CREATE TABLE IF NOT EXISTS reviews (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id         UUID REFERENCES tutor_profiles(id) ON DELETE CASCADE,
  family_id        UUID REFERENCES auth.users(id),
  family_name      TEXT NOT NULL,
  rating           INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment          TEXT,
  would_recommend  BOOLEAN DEFAULT true,
  tutor_response   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Families post reviews" ON reviews FOR INSERT
  WITH CHECK (auth.uid() = family_id);
CREATE POLICY "Tutors respond" ON reviews FOR UPDATE
  USING (tutor_id IN (SELECT id FROM tutor_profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION update_tutor_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE tutor_profiles SET average_rating = (
    SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE tutor_id = NEW.tutor_id
  ) WHERE id = NEW.tutor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_review_insert AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_tutor_rating();

Wait for confirmation before writing code.

### FILES TO CREATE
- app/components/StarRating.tsx
- app/components/ReviewCard.tsx
- app/components/LeaveReviewForm.tsx

### FILES TO UPDATE
- app/ustaz/[id]/page.tsx    (add reviews section below bio — READ FILE FIRST)

### StarRating SPEC
```typescript
// Props: { rating: number, interactive?: boolean, onRate?: (n: number) => void, size?: 'sm'|'md' }
// 5 stars: filled=text-amber-400, empty=text-gray-300
// sm=text-lg, md=text-xl (default)
// If interactive: hover highlights + click calls onRate
// If not interactive: display only
```

### ReviewCard SPEC
```typescript
// Shows: stars (display-only) + family_name + date as "March 2025"
// Comment text
// If would_recommend: small green text "✓ Recommends this tutor"
// If tutor_response: gray indented box "Tutor's reply: {text}"
// Style: bg-white border border-gray-100 rounded-xl p-5
```

### LeaveReviewForm SPEC
```typescript
// Props: { tutorId: string, tutorName: string, onSubmitted: () => void }
// Only show if user is logged in (check supabase.auth.getUser())
// Fields: StarRating (interactive), comment textarea (optional),
//         "Recommend {tutorName}?" Yes/No toggle
// On submit: INSERT into reviews, call onSubmitted()
// Show error if 0 stars selected on submit
```

### TUTOR PROFILE ADDITIONS (below bio)
1. "Reviews" heading + StarRating (display) + "(X reviews)" count
2. Recommendation %: "Y% would recommend" (yes_count / total * 100, rounded)
3. Map reviews → ReviewCard for each
4. If user is logged-in family: show LeaveReviewForm below the reviews list

### TEST STEPS
1. Go to tutor profile while logged in as family
2. Leave a review: 4 stars, comment, Yes recommend → Submit
3. Review appears on the page immediately
4. Go to /find-ustaz → tutor card shows 4.0 stars
5. Supabase → tutor_profiles → average_rating = 4.0


---


## TASK 3.4 — Report system

### STOP — TELL ME TO RUN THIS SQL FIRST

CREATE TABLE IF NOT EXISTS reports (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id      UUID REFERENCES auth.users(id),
  reporter_type    TEXT NOT NULL,
  reported_user_id UUID NOT NULL,
  reason           TEXT NOT NULL,
  details          TEXT,
  status           TEXT DEFAULT 'pending',
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users submit reports" ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

### FILES TO CREATE
- app/components/ReportModal.tsx

### FILES TO UPDATE
- app/ustaz/[id]/page.tsx    (add Report link at bottom, only if logged in)

### ReportModal SPEC
```typescript
// Trigger: small gray text link at very bottom of profile: "Report a problem"
// Only visible if user is logged in
// Click → modal overlay (fixed inset-0 bg-black/50 z-50)
// Modal: bg-white rounded-xl p-6 max-w-md mx-auto mt-32
//   Heading: "Report {tutorName}"
//   Reason select (required):
//     "" → "Select a reason..."
//     "Did not show up for the lesson"
//     "Inappropriate behaviour"
//     "Qualifications not as described"
//     "Safety concern"
//     "Other"
//   Details textarea: optional, "Describe what happened (optional)"
//   Buttons: "Submit Report" (emerald) + "Cancel" (gray outline)
//   On submit: INSERT into reports, close modal,
//              show toast (fixed bottom-4 right-4):
//              "Report submitted. We will review within 24 hours."
```

### TEST STEPS
1. Go to tutor profile while logged in → scroll to very bottom
2. "Report a problem" link visible
3. Click → modal opens with dropdown + textarea
4. Select a reason → Submit
5. Toast appears, modal closes
6. Supabase → reports table → row with status = 'pending'


---


## TASK 3.5 — Legal pages

### FILES TO CREATE
- app/(legal)/terms/page.tsx
- app/(legal)/privacy/page.tsx
- app/(legal)/refund-policy/page.tsx
- app/(legal)/tutor-conduct/page.tsx

### SHARED LAYOUT FOR ALL FOUR PAGES
```typescript
// max-w-3xl mx-auto px-4 py-12
// Top of page: Link to / with text "← Back to Home" (text-sm text-emerald-600)
// h1 (text-3xl font-bold text-gray-900 mt-6 mb-1)
// "Last updated: March 2026" (text-sm text-gray-400 mb-8)
// Content: text-base text-gray-700 leading-relaxed
// Section headings: text-xl font-semibold text-gray-900 mt-8 mb-3
// Lists: regular bullet points
```

### CONTENT REQUIREMENTS (write real content — no "Lorem ipsum")
Plain English. Any adult in The Gambia should understand without a lawyer.

Terms of Service sections:
  What TutorConnect Gambia does (in-person tutoring marketplace)
  Rules for tutors (show up on time, be honest about qualifications, no direct payments)
  Rules for families (pay on time, treat tutors respectfully)
  Platform fees (10% commission from tutors, 5% service fee from families, drops with experience)
  How disputes are handled (contact us, we respond in 7 days)
  Suspension grounds (off-platform payments, abuse, repeated no-shows)
  Governing law: Republic of The Gambia

Privacy Policy sections:
  What data we collect (name, email, phone, location, payment reference)
  How we use it (matching, payments, WhatsApp notifications)
  We never sell your data to anyone
  How to delete your account (email info@tutorconnect.gm)

Refund Policy sections:
  Full refund if tutor cancels before any lesson
  First-lesson refund if family is unsatisfied (must request within 48 hours)
  No refund after 2+ lessons are completed

Tutor Code of Conduct sections:
  Punctuality (on time, 24h notice to cancel)
  Professionalism in family homes
  No direct payments — ever
  Student safety and appropriate conduct
  Consequences: warning → suspension → permanent ban

### FILES TO UPDATE (after creating the four pages)
- Footer component: add a "Legal" column with links to all four pages
- app/(auth)/register/page.tsx:
    Add required checkbox at bottom of form:
    "I agree to the Terms of Service and Privacy Policy"
    (make "Terms of Service" and "Privacy Policy" clickable links)
    Submit button disabled until checkbox is ticked

### TEST STEPS
1. Visit /terms, /privacy, /refund-policy, /tutor-conduct — all four load
2. Footer on homepage shows Legal column with all four links
3. Go to /register → checkbox visible → try submitting unchecked → blocked
4. Tick checkbox → button becomes active and clickable


---


## TASK 3.6 — Tutor onboarding checklist (BONUS)

### FILES TO CREATE
- app/components/OnboardingChecklist.tsx

### FILES TO UPDATE
- app/dashboard/page.tsx    (show checklist at top if profile is incomplete — READ FILE FIRST)

### COMPONENT SPEC
```typescript
// Props: { profile: TutorProfile }
// Evaluate 5 steps:
//   Step 1 "Complete your profile"   → name && phone && bio && location all non-empty
//   Step 2 "Add subjects & rate"     → subjects.length > 0 && hourly_rate > 0
//   Step 3 "Upload profile photo"    → profile_photo_url non-empty
//   Step 4 "Upload ID for Verified"  → link to documents section, never auto-ticked
//   Step 5 "Preview your profile"    → always a Link → /ustaz/{profile.id}
//
// Only show this component if completedCount < 4
// (Once 4+ steps done, the tutor is ready — hide the checklist)
//
// Layout:
//   bg-white rounded-xl border border-gray-200 p-6 mb-6
//   Heading: "Complete your profile to start getting bookings" (text-lg font-semibold)
//   Progress bar: full-width gray track, emerald fill at (completedCount/5)*100 + '%'
//   Each step: flex row gap-3
//     Done: green filled circle with white checkmark
//     Todo: gray empty circle
//     Step text: text-sm text-gray-700
//   Step 4: link to documents section (#documents anchor)
//   Step 5: Link to profile page (text-emerald-600 underline)
```

### TEST STEPS
1. Log in as tutor with empty profile → checklist appears at top of dashboard
2. Complete name, phone, bio, location → Save → Step 1 turns green
3. Add subjects and rate → Save → Step 2 turns green
4. Upload photo → Step 3 turns green
5. Once 4 steps are done → refresh → checklist disappears


---


# ═══════════════════════════════════════════════════════════════
# PHASE 4 — BOOKING & PAYMENTS
# Do not start until I explicitly say "start Phase 4"
# ═══════════════════════════════════════════════════════════════


## TASK 4.1 — Tutor availability

### STOP — TELL ME TO RUN THIS SQL FIRST

ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS available_days  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_hours TEXT   DEFAULT '';

### FILES TO UPDATE
- app/dashboard/page.tsx    (add Availability section — READ FILE FIRST)
- app/ustaz/[id]/page.tsx   (show availability — READ FILE FIRST)

### DASHBOARD AVAILABILITY SECTION
Add below subjects picker, above Save button.
```typescript
// Heading: "Your Availability" (text-base font-semibold text-gray-900)
// Days: const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
//   flex flex-wrap gap-2 mt-2
//   Selected: bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium text-sm
//   Not selected: bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200
//   onClick: toggle day in available_days array state
// Hours input: label "Available hours", placeholder "e.g. Weekdays 8am–12pm, evenings 6–9pm"
//   Standard input className from CLAUDE.md
// Include both in handleSave upsert call
```

### PROFILE PAGE — show availability
```typescript
// Below subjects section:
// Heading: "Availability" (text-sm font-medium text-gray-700 mb-2)
// Days: map available_days → bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs pills
// Hours: text-sm text-gray-600 mt-1
// If no data: text-sm text-gray-400 italic "Contact tutor to discuss availability"
```

### TEST STEPS
1. Log in as tutor → select Mon, Wed, Fri → type hours → Save
2. Go to /ustaz/{id} → green pills for Mon Wed Fri + hours text visible


---


## TASK 4.2 — Booking request flow

### STOP — TELL ME TO RUN THIS SQL FIRST

CREATE TABLE IF NOT EXISTS bookings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id         UUID REFERENCES tutor_profiles(id) ON DELETE CASCADE,
  family_id        UUID REFERENCES auth.users(id),
  family_name      TEXT NOT NULL,
  family_phone     TEXT,
  subjects         TEXT[] NOT NULL,
  hours_per_month  INTEGER NOT NULL,
  hourly_rate      INTEGER NOT NULL,
  monthly_total    INTEGER NOT NULL,
  service_fee      INTEGER NOT NULL,
  grand_total      INTEGER NOT NULL,
  special_requests TEXT,
  preferred_days   TEXT[] DEFAULT '{}',
  status           TEXT DEFAULT 'pending',
  start_date       DATE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Families manage own bookings" ON bookings
  FOR ALL USING (family_id = auth.uid());
CREATE POLICY "Tutors see their bookings" ON bookings FOR SELECT
  USING (tutor_id IN (SELECT id FROM tutor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tutors update booking status" ON bookings FOR UPDATE
  USING (tutor_id IN (SELECT id FROM tutor_profiles WHERE user_id = auth.uid()));

### FILES TO CREATE
- app/book/[tutorId]/page.tsx
- app/family/dashboard/page.tsx    (create if not exists)

### FILES TO UPDATE
- app/ustaz/[id]/page.tsx         (add "Book This Tutor" button — READ FILE FIRST)
- app/dashboard/page.tsx          (add Booking Requests section — READ FILE FIRST)

### BOOKING FORM SPEC (app/book/[tutorId]/page.tsx)
```typescript
// Fetch tutor profile on mount. If not found: show 404 message.
// If user not logged in: show "Please sign in to book" with /login link

// Tutor header: photo/initial + name + location (not editable)

// Form fields:
//   Subject: select from tutor.subjects (required)
//   Hours per month: select 4 | 8 | 12 | 16 (required)
//   Preferred days: checkboxes from tutor.available_days
//   Your name: text (pre-fill from auth user profile if available)
//   Your phone: text (pre-fill if available)
//   Special requests: textarea, optional

// Live cost breakdown (recalculates on hours or subject change):
//   monthly_total = hours * tutor.hourly_rate
//   service_fee   = Math.round(monthly_total * 0.05)
//   grand_total   = monthly_total + service_fee
//   Display in: bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm

// Submit: INSERT into bookings with all fields + status='pending'
// On success: show inline success screen (no page redirect):
//   "✅ Request sent to {tutorName}!"
//   "{tutorName} has 48 hours to respond. We'll notify you by WhatsApp."
//   Button "Browse more tutors" → /find-ustaz
```

### TUTOR DASHBOARD ADDITIONS
```typescript
// NEW "Booking Requests" section at very top (above profile form)
// Fetch bookings WHERE tutor_id = profile.id AND status = 'pending'
//
// Each request card:
//   family_name + phone
//   subjects, hours_per_month, grand_total formatted as "D2,100"
//   preferred_days as small gray pills
//   special_requests in italic gray (if present)
//   "Received X hours ago" (gray text-sm)
//   Accept button (emerald) + Decline button (red outline)
//
// Accept: UPDATE status='confirmed' → remove card → show toast
//   After updating, auto-create lesson rows (see Task 4.3 lesson creation)
//
// Decline: show inline textarea "Reason (optional)" + "Confirm Decline" button
//   UPDATE status='cancelled' → remove card → show toast

// NEW "Active Bookings" section below requests:
//   Fetch bookings WHERE status = 'active'
//   Each: family_name, subjects, hours_per_month, status badge (green "Active")
```

### TEST STEPS
1. As logged-in family, go to tutor profile → "Book This Tutor" button visible
2. Click → /book/{tutorId} loads with tutor name
3. Change hours → cost breakdown updates in real time
4. Submit → inline success message appears (no page navigation)
5. Log in as tutor → "Booking Requests" at top of dashboard with the new card
6. Click Accept → card disappears, toast shown
7. Supabase → bookings table → status = 'confirmed'


---


## TASK 4.3 — Lesson tracking

### STOP — TELL ME TO RUN THIS SQL FIRST

CREATE TABLE IF NOT EXISTS lessons (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id       UUID REFERENCES bookings(id) ON DELETE CASCADE,
  tutor_id         UUID REFERENCES tutor_profiles(id),
  family_id        UUID REFERENCES auth.users(id),
  lesson_number    INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 120,
  subject          TEXT,
  status           TEXT DEFAULT 'scheduled',
  tutor_notes      TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tutors manage own lessons" ON lessons FOR ALL
  USING (tutor_id IN (SELECT id FROM tutor_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Families view own lessons" ON lessons FOR SELECT
  USING (family_id = auth.uid());

### AUTO-CREATE LESSONS ON BOOKING ACCEPTANCE
When the Accept button is clicked in the dashboard:
```typescript
// After updating booking status to 'confirmed':
const numLessons = Math.floor(booking.hours_per_month / 2)  // 2-hour sessions
const lessonRows = Array.from({ length: numLessons }, (_, i) => ({
  booking_id: booking.id,
  tutor_id:   booking.tutor_id,
  family_id:  booking.family_id,
  lesson_number: i + 1,
  subject:    booking.subjects[0],
  status:     'scheduled',
}))
await supabase.from('lessons').insert(lessonRows)
```

### FILES TO CREATE
- app/components/LessonCard.tsx

### FILES TO UPDATE
- app/dashboard/page.tsx           (add "My Lessons" tab)
- app/family/dashboard/page.tsx    (add lesson timeline)

### LessonCard SPEC
```typescript
// Props: { lesson: Lesson, viewAs: 'tutor'|'family', totalLessons: number }
//
// TUTOR VIEW:
//   "Lesson {lesson_number} of {totalLessons}" + subject + status badge
//   If status='scheduled': show "Mark as Complete" button
//   Clicking expands inline: textarea (optional notes) + "Confirm Complete" button
//   On confirm: UPDATE status='completed', tutor_notes, completed_at=now()
//
// FAMILY VIEW: vertical timeline style
//   Completed: green circle dot + "Lesson {N} — {date}" + notes in gray box (if any)
//   Scheduled: gray circle dot + "Lesson {N} — upcoming"
//   After ALL lessons complete: emerald banner "🎉 All lessons done! Leave a review" + link
```

### TEST STEPS
1. Accept a booking → Supabase → lessons table → rows auto-created
2. Log in as tutor → "My Lessons" tab shows lesson cards
3. Click "Mark as Complete" on Lesson 1 → write a note → Confirm
4. Log in as family → lesson timeline shows Lesson 1 as green with the note text


---


## TASK 4.4 — Payment integration (Wave)

### BEFORE ANY CODE — TELL ME TO ADD THESE TO .env.local
WAVE_API_KEY=placeholder_replace_when_wave_approves_account
WAVE_WEBHOOK_SECRET=placeholder
NEXT_PUBLIC_SITE_URL=http://localhost:3000

AND RUN THIS SQL:

CREATE TABLE IF NOT EXISTS payments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id     UUID REFERENCES bookings(id),
  family_id      UUID REFERENCES auth.users(id),
  amount         INTEGER NOT NULL,
  service_fee    INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'wave',
  wave_reference TEXT,
  status         TEXT DEFAULT 'pending',
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Families see own payments" ON payments
  FOR ALL USING (family_id = auth.uid());

### FILES TO CREATE
- app/payment/[bookingId]/page.tsx
- app/payment/success/page.tsx
- app/payment/failed/page.tsx
- app/api/wave/create-payment/route.ts
- app/api/wave/webhook/route.ts

### PAYMENT PAGE SPEC
```typescript
// Fetch booking on mount. Show cost breakdown:
// Tutor / Subjects / Sessions count / Subtotal / Service fee / Total
// Style: bg-white border border-gray-200 rounded-xl p-6 max-w-md mx-auto
// "Pay with Wave" button: full-width emerald
// Below button: small gray text about security and money-back guarantee
// On click: POST /api/wave/create-payment with { bookingId }
// Redirect to returned URL
```

### CREATE-PAYMENT API ROUTE
```typescript
// POST: receives { bookingId }
// Uses SUPABASE_SERVICE_ROLE_KEY (not anon key) to fetch booking server-side
// INSERTs payment row with status='pending'
// SIMULATION (if WAVE_API_KEY starts with 'placeholder'):
//   return { url: '/payment/success?ref=SIMULATED&bookingId=' + bookingId }
// REAL (when Wave credentials exist):
//   Call Wave checkout API, return their URL
// NEVER log or expose WAVE_API_KEY
```

### SUCCESS PAGE
```typescript
// Reads bookingId + ref from URL query
// Updates: bookings status='active', payments status='completed', wave_reference from URL
// Shows: green checkmark, "Payment confirmed!", "Your tutor has been notified."
// Button: "Go to my dashboard" → /family/dashboard
```

### FILES TO UPDATE
- app/family/dashboard/page.tsx (add "Pay Now" button on confirmed bookings)

### TEST STEPS
1. Accept a booking as tutor
2. As family → family dashboard → "Pay Now" button on confirmed booking
3. Click Pay Now → /payment/{id} with correct amounts
4. Click "Pay with Wave" → /payment/success
5. Supabase → payments: status='completed' | bookings: status='active'


---


## TASK 4.5 — Tutor earnings dashboard

### STOP — TELL ME TO RUN THIS SQL FIRST

CREATE TABLE IF NOT EXISTS payouts (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id            UUID REFERENCES tutor_profiles(id),
  amount              INTEGER NOT NULL,
  commission_deducted INTEGER NOT NULL,
  wave_reference      TEXT,
  status              TEXT DEFAULT 'pending',
  period_start        DATE,
  period_end          DATE,
  lessons_count       INTEGER DEFAULT 0,
  requested_at        TIMESTAMPTZ DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tutors manage own payouts" ON payouts FOR ALL
  USING (tutor_id IN (SELECT id FROM tutor_profiles WHERE user_id = auth.uid()));

### FILES TO UPDATE
- app/dashboard/page.tsx    (restructure into 3 tabs: Profile | My Lessons | Earnings)

### EARNINGS TAB SPEC
```typescript
// 4 summary cards (grid-cols-2 md:grid-cols-4):
//   Lessons This Month / Pending Payout (D) / Commission Paid (D) / Total Earned (D)

// Completed lessons table:
//   Columns: Date | Family | Subject | Hours | Earned | Status
//   "Earned" = lesson_hours * hourly_rate * (1 - commission_rate/100)
//   Status: "Pending" (amber pill) or "Paid out" (green pill)

// Payout history table:
//   Columns: Date | Amount | Wave Reference | Status

// "Request Payout" button:
//   Disabled (opacity-50 cursor-not-allowed) when pending_earnings = 0
//   Active when pending_earnings > 0
//   On click: confirmation modal with amount
//   On confirm: INSERT into payouts, show toast "Request sent. Admin processes within 24 hours."
```

### TEST STEPS
1. Complete a lesson + simulate payment (from Tasks 4.3 and 4.4)
2. Log in as tutor → click "Earnings" tab
3. Cards show: Lessons This Month=1, Pending Payout=correct amount
4. Click Request Payout → modal → Confirm
5. Supabase → payouts table → new row with status='pending'


---


## TASK 4.6 — Budget filter + Recently Viewed

### FILES TO UPDATE
- app/find-ustaz/page.tsx
- app/ustaz/[id]/page.tsx    (save to localStorage on profile view)

### BUDGET FILTER
```typescript
// State: const [maxRate, setMaxRate] = useState(500)
// Add below Subject filter:
//   Label: "Max hourly rate"
//   <input type="range" min={50} max={500} step={50}
//          value={maxRate} onChange={e => setMaxRate(Number(e.target.value))}
//          className="w-full accent-emerald-600" />
//   Display: maxRate >= 500 ? "Any rate" : `Up to D${maxRate}`
// Add to filteredTutors:
//   const rateMatch = maxRate >= 500 || (tutor.hourly_rate || 0) <= maxRate
```

### RECENTLY VIEWED
```typescript
// In app/ustaz/[id]/page.tsx on mount:
//   Read, prepend current id, deduplicate, keep 5, save to localStorage key 'rv_tutors'

// In app/find-ustaz/page.tsx on mount:
//   Read 'rv_tutors' from localStorage
//   Fetch those tutor profiles from Supabase WHERE id IN (...) AND is_approved=true
//   Store in recentTutors state

// Render (only if recentTutors.length > 0), above the filters:
//   "Recently viewed" heading (text-sm font-medium text-gray-600)
//   flex gap-3 overflow-x-auto pb-2
//   Each card (w-48 shrink-0 bg-white border border-gray-200 rounded-xl p-3):
//     photo/initial + name + location + rate + Link to profile
```

### TEST STEPS
1. /find-ustaz → budget slider appears → set to D200 → only ≤200 tutors show
2. View 2-3 tutor profiles → return to /find-ustaz
3. "Recently viewed" row appears at top with those cards


---


# ═══════════════════════════════════════════════════════════════
# PHASE 5 — ADMIN, NOTIFICATIONS & GROWTH
# Do not start until I explicitly say "start Phase 5"
# ═══════════════════════════════════════════════════════════════


## TASK 5.1 — Admin dashboard

### STOP — TELL ME TO DO THESE STEPS FIRST

Step A — Run this SQL:
CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only" ON admin_users FOR ALL USING (auth.uid() = user_id);

Step B — Create admin account in Supabase:
  Authentication → Users → Invite User → enter my email → confirm from inbox

Step C — Insert admin row (replace user_id with the UUID from Authentication → Users):
INSERT INTO admin_users (user_id, name, email)
VALUES ('replace-with-your-user-id', 'Admin', 'your@email.com');

Wait for confirmation of all 3 steps.

### FILES TO CREATE
- app/admin/layout.tsx
- app/admin/page.tsx
- app/admin/tutors/page.tsx
- app/admin/documents/page.tsx
- app/admin/reports/page.tsx
- app/admin/payouts/page.tsx

### UPDATE middleware.ts
Protect /admin/* — require row in admin_users table.
Non-admin accessing /admin/* → redirect to / (homepage).

### ADMIN LAYOUT
```typescript
// Left sidebar: bg-gray-900 w-56 min-h-screen fixed
//   Logo: "TutorConnect" emerald text, "Admin" gray text below
//   Nav: Overview | Tutors | Documents | Reports | Payouts | Analytics
//   Each link: text-gray-400 hover:text-white py-2 px-4 rounded
//   Active: bg-gray-800 text-white
//   Bottom: admin name (text-gray-400) + Sign Out button
// Main: ml-56 p-8 bg-gray-50 min-h-screen
```

### OVERVIEW PAGE
```typescript
// 6 stat cards (grid-cols-2 lg:grid-cols-3 gap-4):
//   Total Tutors / Pending Approval / Total Families /
//   Active Bookings / Revenue This Month (D) / Lessons This Month
// Recent Bookings table (last 10): Family | Tutor | Status | Amount | Date
```

### TUTORS PAGE
```typescript
// Fetch tutor_profiles WHERE is_approved=false ORDER BY created_at ASC
// Card per tutor: name, email, phone, location, subjects, rate, bio (120 chars)
// "Applied X days ago"
// Approve: UPDATE is_approved=true → card removed → toast
// Reject: inline reason input → UPDATE is_active=false → card removed
```

### DOCUMENTS PAGE
```typescript
// Fetch tutor_documents WHERE status='pending' JOIN tutor name+email
// View: supabase.storage.from('documents').createSignedUrl(path, 60) → open in new tab
// Approve: UPDATE status='approved'
// Reject: reason input → UPDATE status='rejected', rejection_reason
```

### REPORTS PAGE
```typescript
// Fetch reports ORDER BY created_at DESC
// Each: reporter_type, reason, details, status badge, date
// Update: select new status + admin_notes textarea → save
```

### PAYOUTS PAGE
```typescript
// Fetch payouts WHERE status='pending' JOIN tutor name+phone
// Each: name, phone, amount (D), lessons_count, requested_at
// "Mark as Paid": modal → Wave reference input → UPDATE status='completed', wave_reference, completed_at
```

### TEST STEPS
1. Incognito → /admin → redirected to homepage (not an error, not a blank page)
2. Log in as admin → /admin → metric cards with real numbers
3. /admin/tutors → approve one → Supabase is_approved=true
4. /admin/documents → view signed URL opens file → approve → status='approved'
5. /admin/reports → submitted reports appear
6. /admin/payouts → payout request appears → mark paid → status='completed'


---


## TASK 5.2 — Analytics charts

### STOP — TELL ME TO RUN
npm install recharts

### FILES TO CREATE
- app/admin/analytics/page.tsx

### SPEC
```typescript
'use client'
// 6 charts using Recharts, all in responsive containers
// Grid: grid-cols-1 md:grid-cols-2 gap-6
// Each chart: bg-white rounded-xl border border-gray-200 p-6, height 300

// 1. New Tutors Per Week — BarChart, fill="#059669"
// 2. New Families Per Week — BarChart, fill="#0284c7"
// 3. Lessons Completed Per Week — LineChart, stroke="#059669"
// 4. Revenue Per Week (D) — LineChart, stroke="#d97706"
// 5. Top 5 Subjects — Horizontal BarChart
// 6. Top 5 Locations — Horizontal BarChart

// All data from Supabase queries on mount
// Show skeleton cards (animate-pulse bg-gray-200 rounded-xl h-72) while loading
// If query fails: "Could not load data" text (text-sm text-gray-400)
```

### TEST STEPS
1. Go to /admin/analytics → 6 chart cards render
2. DevTools (Cmd+Option+J) → no red errors in Console
3. Charts show correct data (or zeros) — both are fine


---


## TASK 5.3 — WhatsApp notifications (Twilio)

### STOP — TELL ME TO:
1. Sign up at twilio.com → Messaging → Try it out → Send a WhatsApp message
2. Follow Sandbox activation (scan QR code or text the join phrase to the sandbox number)
3. Add to .env.local:
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

### FILES TO CREATE
- app/api/notify/whatsapp/route.ts
- lib/notify.ts

### API ROUTE
```typescript
// POST: { to: "+220XXXXXXX", message: "text" }
// Calls Twilio REST API with Basic auth (btoa(SID + ':' + TOKEN))
// Never throw on failure — log and return 200
```

### lib/notify.ts
```typescript
export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  try {
    if (!phone) return
    await fetch('/api/notify/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message }),
    })
  } catch (err) {
    console.error('[notify] failed:', err)
    // Intentionally swallow — notifications must NEVER break booking flows
  }
}
```

### WHERE TO CALL sendWhatsApp (add to existing booking/payment/lesson code)
```typescript
// 1. Booking Accept (in dashboard):
await sendWhatsApp(booking.family_phone,
  `Hi ${booking.family_name}, ${tutorName} accepted your tutoring request for ${booking.subjects[0]}! Log in to pay: ${siteUrl}/payment/${booking.id}`)

// 2. Payment success page:
await sendWhatsApp(tutorPhone,
  `Hi ${tutorName}, payment confirmed from ${booking.family_name} for ${booking.subjects[0]}. ${booking.hours_per_month} hours this month. Log in: ${siteUrl}/dashboard`)

// 3. Lesson marked complete:
await sendWhatsApp(familyPhone,
  `Hi, ${tutorName} completed today's ${lesson.subject} lesson. View notes: ${siteUrl}/family/dashboard`)

// 4. Admin marks payout paid:
await sendWhatsApp(tutorPhone,
  `Hi ${tutorName}, your earnings of D${payout.amount} have been sent via Wave. Reference: ${payout.wave_reference}. Thank you!`)
```

### TEST STEPS
1. Accept a booking using a real phone number for the family
2. Family's WhatsApp receives a message within 60 seconds
3. console.twilio.com → Monitor → Logs → Messaging → shows "delivered"


---


## TASK 5.4 — SEO optimisation

### FILES TO UPDATE OR CREATE
- app/ustaz/[id]/page.tsx      (add generateMetadata function)
- app/find-ustaz/page.tsx      (add static metadata export)
- app/sitemap.ts               (new file)
- public/robots.txt            (new file)

### generateMetadata FOR TUTOR PROFILES
```typescript
export async function generateMetadata({ params }: { params: { id: string } }) {
  // Fetch tutor using server-side Supabase client (not browser client)
  // Return:
  return {
    title: `${tutor.name} — ${tutor.location} Tutor | TutorConnect Gambia`,
    description: `${tutor.name} teaches ${subjects} in ${tutor.location}. D${tutor.hourly_rate}/hour. In-home lessons.`,
    openGraph: {
      title: `${tutor.name} | TutorConnect Gambia`,
      description: tutor.bio || `Qualified tutor in ${tutor.location}, The Gambia`,
    }
  }
}
```

### SITEMAP (app/sitemap.ts)
```typescript
import { MetadataRoute } from 'next'
// Fetch all approved tutor IDs server-side
// Return: homepage, /find-ustaz, /register, /login + one entry per tutor
// Tutor pages: changeFrequency:'weekly', priority:0.8
```

### robots.txt
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard
Disallow: /family/
Disallow: /payment/
Sitemap: https://tutorconnect.gm/sitemap.xml
```

### TEST STEPS
1. Tutor profile page → browser tab shows "[Name] — [Location] Tutor | TutorConnect Gambia"
2. After Vercel deploy: visit your-site.vercel.app/sitemap.xml → tutor URLs listed
3. your-site.vercel.app/robots.txt → file loads
4. pagespeed.web.dev → 85+ mobile score


---


## TASK 5.5 — Referral system (BONUS)

### STOP — TELL ME TO RUN THIS SQL

ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS referral_code    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by      TEXT,
  ADD COLUMN IF NOT EXISTS referral_credits INTEGER DEFAULT 0;

UPDATE tutor_profiles
  SET referral_code = UPPER(SUBSTRING(MD5(id::text), 1, 6))
  WHERE referral_code IS NULL;

### FILES TO UPDATE
- app/(auth)/register/page.tsx   (read ?ref= param, store referred_by)
- app/dashboard/page.tsx         (add Referral section to Profile tab)

### REGISTER PAGE
```typescript
// Read searchParams.get('ref') → store in state referralCode
// Include in tutor_profiles insert: referred_by: referralCode || null
// Generate referral_code on insert: Math.random().toString(36).substring(2,8).toUpperCase()
```

### DASHBOARD REFERRAL CARD
```typescript
// Collapsible card at bottom of Profile tab
// Trigger: "🔗 Refer a Tutor — earn D100" header → click to expand
// Expanded:
//   Explanation text
//   Readonly input with: {NEXT_PUBLIC_SITE_URL}/register?ref={profile.referral_code}
//   "Copy Link" button → navigator.clipboard.writeText(link)
//   "✓ Copied!" for 2 seconds after clicking
//   "You have referred X tutors." (count from tutor_profiles WHERE referred_by = this code)
```

### TEST STEPS
1. Log in as tutor → bottom of Profile tab → referral card visible
2. Click to expand → referral link shows
3. Click Copy → "✓ Copied!" appears
4. Open link in incognito → /register loads with ?ref=YOURCODE in URL


---


## TASK 5.6 — Featured tutors on homepage (BONUS)

### FILES TO CREATE
- app/components/FeaturedTutors.tsx    (server component — no 'use client')

### FILES TO UPDATE
- app/page.tsx    (add FeaturedTutors between hero section and How It Works — READ FILE FIRST)

### FeaturedTutors SPEC
```typescript
// Server component — fetches data at build/request time, no client JS
// Query: tutor_profiles WHERE is_approved=true AND is_active=true
//        ORDER BY average_rating DESC LIMIT 4
// If 0 results: return null

// Layout wrapper: max-w-6xl mx-auto px-4 py-12
// Heading: "Top Tutors This Month" (text-2xl font-bold text-gray-900)
// Sub: "Highest-rated tutors across The Gambia" (text-gray-500 mt-1)
// Grid: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8

// Each card (bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition):
//   Photo circle (64px) or initial circle (bg-emerald-600 text-white text-xl font-bold)
//   Name: text-base font-semibold text-gray-900 mt-3
//   Location: text-sm text-gray-500
//   StarRating: display-only, size='sm'
//   Subjects: up to 2 pills (bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded)
//   Link: "View Profile" text-sm text-emerald-600 hover:underline mt-2 inline-block
```

### TEST STEPS
1. Homepage → "Top Tutors This Month" visible between search hero and How It Works
2. Shows real tutor cards (if any approved tutors in DB)
3. "View Profile" links go to correct /ustaz/{id} pages


---


# ═══════════════════════════════════════════════════════════════
# FINAL DEPLOYMENT CHECKLIST
# Run through this BEFORE telling anyone the site is live.
# ═══════════════════════════════════════════════════════════════

## SECURITY
# Verify RLS is on every table (run in Supabase SQL Editor):
# SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
# Every row must show rowsecurity = true

# [ ] RLS enabled on all tables (see above query)
# [ ] No NEXT_PUBLIC_ prefix on: WAVE_API_KEY, SUPABASE_SERVICE_ROLE_KEY, TWILIO_AUTH_TOKEN
# [ ] /admin/* redirects non-admins (test in incognito)
# [ ] /dashboard redirects logged-out users (test in incognito)
# [ ] 'documents' Storage bucket is PRIVATE
# [ ] Wave webhook verifies signature before processing

## FUNCTIONALITY (test on LIVE Vercel URL, not localhost)
# [ ] Complete booking flow end-to-end on live site
# [ ] Real Wave payment (small test amount)
# [ ] Real WhatsApp notification received
# [ ] Admin functions work on live site
# [ ] Test on real mobile phone (not just Chrome DevTools)
# [ ] Test in Safari

## PERFORMANCE
# [ ] pagespeed.web.dev mobile score: 85+
# [ ] All images use next/image component
# [ ] sitemap.xml accessible on live domain
# [ ] robots.txt accessible

## FINAL DEPLOY
# git add .
# git commit -m "Phases 3-5 complete: trust, bookings, payments, admin, SEO"
# git push
