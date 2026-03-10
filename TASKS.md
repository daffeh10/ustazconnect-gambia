# TutorConnect Gambia — Phase 1 & 2 Task List

Work through these tasks ONE AT A TIME.
After each task, stop and tell me what you did and what to test.
Do not move to the next task until I confirm the current one works.

---

## PHASE 1 — Fix & Rebrand

---

### TASK 1.1 — Create lib/constants.ts

Create the file `lib/constants.ts` with all subjects and locations.
Do not modify any other file yet.

The file must export:
- SUBJECT_CATEGORIES — array of { category, subjects[] }
- ALL_SUBJECTS — flat array of every subject
- LOCATION_REGIONS — array of { region, locations[] }
- ALL_LOCATIONS — flat array of every location

Subjects to include, grouped:

Religious Education: Quran Reading, Tajweed, Hifz (Memorisation), Arabic Language, Islamic Studies

Mathematics: Basic Mathematics, General Mathematics, Additional Mathematics, Further Mathematics, Statistics

Sciences: Physics, Chemistry, Biology, Agricultural Science, Computer Science

Languages: English Language, English Literature, French, Arabic

Humanities: Economics, Geography, History, Government, Civic Education, Social Studies

Business: Accounting, Commerce, Business Studies

Exam Preparation: WASSCE Prep, NAQEB Prep, University Entrance

Locations to include, grouped by region:

Greater Banjul Area: Banjul, Serrekunda, Bakau, Fajara, Kololi, Kotu, Bijilo, Brufut,
Sukuta, Brusubi, Kerr Serign, Tallinding, Bundung, Latrikunda, Pipeline, Tabokoto, Kanifing

West Coast Region: Brikama, Gunjur, Sanyang, Kartong, Tanji, Batokunku, Ghana Town, Lamin

North Bank Region: Barra, Essau, Kerewan, Farafenni

Lower River Region: Mansakonko, Soma, Pakalinding

Central River Region: Janjanbureh, Kuntaur, Bansang

Upper River Region: Basse Santa Su, Fatoto

After creating the file, tell me to check it in VS Code before continuing.

---

### TASK 1.2 — Update find-ustaz/page.tsx to use grouped dropdowns

Update `app/find-ustaz/page.tsx` to:
1. Import LOCATION_REGIONS and SUBJECT_CATEGORIES from @/lib/constants
2. Remove the hardcoded LOCATIONS and SUBJECTS arrays at the top of the file
3. Replace the location <select> with a grouped version using <optgroup> for each region
4. Replace the subject <select> with a grouped version using <optgroup> for each category
5. Keep all existing filter logic exactly as it is (do not touch the filter code)
6. Keep all existing card rendering exactly as it is

The grouped select pattern to use:
<select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} ...>
  <option value="">All Locations</option>
  {LOCATION_REGIONS.map((region) => (
    <optgroup key={region.region} label={region.region}>
      {region.locations.map((loc) => (
        <option key={loc} value={loc}>{loc}</option>
      ))}
    </optgroup>
  ))}
</select>

Do the same pattern for subjects using SUBJECT_CATEGORIES.

After the change, tell me to:
1. Run: killall -9 node && rm -rf .next && npm run dev
2. Go to http://localhost:3000/find-ustaz
3. Open the Location dropdown — I should see sections like "Greater Banjul Area" with locations listed under it
4. Open the Subject dropdown — I should see sections like "Mathematics" with subjects under it

---

### TASK 1.3 — Update LocationSearch component to use grouped locations

Update `app/components/LocationSearch.tsx` to:
1. Import LOCATION_REGIONS from @/lib/constants
2. Remove the hardcoded LOCATIONS array inside the file
3. Replace the flat <option> list with grouped <optgroup> sections (same pattern as Task 1.2)

After the change, tell me to:
1. Go to http://localhost:3000
2. Open the location dropdown in the hero section — it should show grouped regions
3. Pick any location, click the button — I should land on /find-ustaz with that location pre-selected and filtered

---

### TASK 1.4 — Rebrand text across the site

Do a careful find-and-replace in these specific files only.
Show me the list of changes you plan to make BEFORE making them, and wait for my approval.

Files to update:
- app/page.tsx
- app/find-ustaz/page.tsx
- app/components/Header.tsx (if it exists)
- app/components/Footer.tsx (if it exists — check first)
- app/layout.tsx

Replacements to make:
- "UstazConnect" → "TutorConnect Gambia"
- "Find an Ustaz" → "Find a Tutor"
- "Find Ustaz" → "Find Tutor"  (only in navigation links, not in URLs)
- "Become an Ustaz" → "Become a Tutor"
- "Register as an Ustaz" → "Register as a Tutor"
- "Ustaz Login" → "Tutor Login"
- "Browse our verified Quran teachers" → "Browse our verified tutors"
- "Loading ustazs..." → "Loading tutors..."
- "ustaz" / "ustazs" → "tutor" / "tutors"  (only in displayed text, NOT in variable names or URLs)

Do NOT change:
- Any URL paths (/find-ustaz, /register-ustaz) — these stay the same for now
- Any variable names (ustaz, ustazs, setUstazs etc.)
- The Supabase table name (ustaz_profiles)
- Any import paths

Update app/layout.tsx metadata to:
title: 'TutorConnect Gambia | Find Qualified Tutors Near You'
description: 'The Gambia\'s #1 tutoring marketplace. Find verified tutors for Maths, Science, English, Quran, and more — in your neighbourhood.'

After showing me the planned changes and I approve, make them.
Then tell me to check the site visually at http://localhost:3000.

---

### TASK 1.5 — Update the homepage hero section text

Update the hero headline and description in `app/page.tsx` to:

Headline:
"Find a Trusted Tutor
in The Gambia"
(keep the two-line format with the second line in emerald-600)

Description:
"TutorConnect Gambia connects students with qualified tutors for in-home lessons
across The Gambia — covering every subject from Quran to Maths, Physics, English,
Economics, and more."

Do not change anything else on the page.

---

## END OF PHASE 1

Once all Phase 1 tasks are confirmed working, tell me and I will give the go-ahead for Phase 2.

---

## PHASE 2 — Authentication & Profiles

IMPORTANT: Do not start any Phase 2 task until I explicitly say "start Phase 2".

---

### TASK 2.1 — Install Supabase SSR package

STOP — ask me before running this.
Tell me to run this in the terminal and wait for my confirmation:

npm install @supabase/ssr

After I confirm it's installed, proceed to Task 2.2.

---

### TASK 2.2 — Create Supabase client files

Create two new files:

FILE 1: lib/supabase/client.ts
Used in browser pages (files with 'use client' at top).

'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

FILE 2: lib/supabase/server.ts
Used in server components and API routes.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

Do not touch lib/supabase.ts — leave it exactly as is.
The existing code still uses it and we do not want to break anything.

---

### TASK 2.3 — Show me the database SQL to run

Do NOT run any SQL yourself.
Write out the following SQL and tell me to go to Supabase → SQL Editor → New Query and run it myself.

SQL to show me:

-- TUTOR PROFILES TABLE
CREATE TABLE IF NOT EXISTS tutor_profiles (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  phone               TEXT,
  location            TEXT,
  subjects            TEXT[] DEFAULT '{}',
  experience_years    INTEGER DEFAULT 0,
  hourly_rate         INTEGER DEFAULT 0,
  bio                 TEXT,
  education           TEXT,
  profile_photo_url   TEXT,
  verification_status TEXT DEFAULT 'basic',
  is_active           BOOLEAN DEFAULT true,
  is_approved         BOOLEAN DEFAULT false,
  average_rating      DECIMAL DEFAULT 0,
  total_lessons       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- FAMILY PROFILES TABLE
CREATE TABLE IF NOT EXISTS family_profiles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_name  TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  phone        TEXT,
  location     TEXT,
  budget_min   INTEGER DEFAULT 0,
  budget_max   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ROW LEVEL SECURITY
ALTER TABLE tutor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors manage own profile"
  ON tutor_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public read approved tutors"
  ON tutor_profiles FOR SELECT
  USING (is_active = true AND is_approved = true);

CREATE POLICY "Families manage own profile"
  ON family_profiles FOR ALL USING (auth.uid() = user_id);

Wait for me to confirm I've run the SQL before continuing.

---

### TASK 2.4 — Create the Register page

Create the file: app/(auth)/register/page.tsx

This page must:
1. Show a role picker first (Tutor or Family cards to click)
2. After role is chosen, show a registration form (name, email, password)
3. On submit, call supabase.auth.signUp()
4. After signUp, insert a row into tutor_profiles or family_profiles depending on role
5. Show a "Check your email" success screen after submit
6. Have a link to /login at the bottom

Use createClient from @/lib/supabase/client
Use the design system from CLAUDE.md
Form validation: all fields required, password minimum 8 characters
Show a clear red error message if signup fails
Disable the submit button while loading
Show "Creating account..." text on the button while loading

---

### TASK 2.5 — Create the Login page

Create the file: app/(auth)/login/page.tsx

This page must:
1. Show email and password fields
2. On submit, call supabase.auth.signInWithPassword()
3. On success, redirect to /dashboard using router.push('/dashboard') then router.refresh()
4. Show a user-friendly error message on failure (not the raw Supabase error)
5. Have a "Forgot password?" link to /forgot-password
6. Have a link to /register at the bottom

Use createClient from @/lib/supabase/client
Use the design system from CLAUDE.md
Disable the button while loading

---

### TASK 2.6 — Create the Forgot Password page

Create the file: app/(auth)/forgot-password/page.tsx

This page must:
1. Show a single email input and a "Send Reset Link" button
2. Call supabase.auth.resetPasswordForEmail() with redirectTo set to window.location.origin + '/update-password'
3. After sending, show a success screen saying "Check your email"
4. Disable button while loading and when email field is empty

Use createClient from @/lib/supabase/client
Use the design system from CLAUDE.md

---

### TASK 2.7 — Create middleware.ts to protect the dashboard

Create the file: middleware.ts in the ROOT of the project (same level as package.json).

This file must:
1. Check if the visitor is logged in using supabase.auth.getUser()
2. If NOT logged in and trying to visit /dashboard, /family, /book, or /messages — redirect to /login
3. Pass all other requests through unchanged

Use createServerClient from @supabase/ssr (not from lib/supabase/server)
Read the exact middleware pattern from the Supabase SSR docs pattern.

After creating it, tell me to:
1. Open an incognito window (Cmd+Shift+N)
2. Go to http://localhost:3000/dashboard
3. I should be redirected to /login automatically

---

### TASK 2.8 — Create the ImageUpload component

Create the file: app/components/ImageUpload.tsx

This component must:
- Accept props: currentPhotoUrl (optional string) and onUpload (callback function)
- Show the current photo in a circle, or a camera emoji placeholder if no photo
- Have a "Choose Photo" button that opens the file picker
- Accept only image files (image/*)
- Block files over 2MB with an alert
- Upload to Supabase Storage bucket called 'avatars'
- Generate a unique filename using Date.now()
- Call onUpload(url) with the public URL after a successful upload
- Show "Uploading..." text and disable the button while uploading

Use createClient from @/lib/supabase/client
Use the design system from CLAUDE.md

NOTE: Before this task works fully, I need to create the 'avatars' bucket in Supabase Storage manually.
Remind me to do this: Supabase → Storage → New Bucket → name: avatars → tick Public → Create.

---

### TASK 2.9 — Build the Tutor Dashboard page

Update or replace: app/dashboard/page.tsx

This page must:
1. On load, get the current logged-in user with supabase.auth.getUser()
2. Fetch their row from tutor_profiles where user_id = user.id
3. Populate all form fields with the fetched data
4. Let the tutor edit: name, phone, location (dropdown from ALL_LOCATIONS), hourly rate, bio, subjects (tag picker), profile photo
5. Save button calls supabase.from('tutor_profiles').upsert() with updated data
6. Show "✓ Profile saved successfully!" for 3 seconds after saving
7. Have a Sign Out button that calls supabase.auth.signOut() then redirects to /

Subjects picker: render ALL_SUBJECTS as clickable pill buttons.
Selected = bg-emerald-600 text-white. Unselected = bg-gray-100 text-gray-600.
Clicking a subject toggles it on/off.

Show a full-page spinner while the profile is loading.

Use createClient from @/lib/supabase/client
Import ALL_SUBJECTS and ALL_LOCATIONS from @/lib/constants
Import ImageUpload from @/app/components/ImageUpload
Use the design system from CLAUDE.md

---

### TASK 2.10 — Add Sign In / Join links to the Header

Look at app/components/Header.tsx.
Show me its current content first and wait for me to review.
Then add "Sign In" (link to /login) and "Join Free" (button to /register) to the navigation.
Do not remove any existing links.

---

## END OF PHASE 2

When all tasks are done, tell me:
1. Everything that was created or changed (list of files)
2. The full test checklist to verify everything works
3. The git commands to save and deploy

---

## HOW TO USE THIS FILE

When I open Claude Code and type "read TASKS.md and tell me where we are",
you will read this file and tell me which tasks are done and which are next.

Each session, start by asking me: "Which task do you want to work on?"
Never assume — always ask before starting work.
