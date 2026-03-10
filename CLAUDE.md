# TutorConnect Gambia — Claude Code Instructions

## Who I Am
I am building TutorConnect Gambia — The Gambia's tutoring marketplace connecting
students with qualified in-person tutors for ALL subjects (not just Quran).
I am the sole developer. I use a MacBook with VS Code.

## Project Location
/Users/abdouliedaffeh/Documents/quran_project/ustazconnect-gambia

## Live Site
https://ustazconnect-gambia2026-xskw.vercel.app

## Tech Stack
- Next.js 15+ with App Router
- TypeScript
- Supabase (PostgreSQL + Auth + Storage)
- Tailwind CSS
- Deployed on Vercel (auto-deploys on git push)

## Current Supabase Table Name
The main tutor table is currently called `ustaz_profiles` in Supabase.
Do NOT rename it in code yet — keep using `ustaz_profiles` until I say otherwise.

---

## Rules You Must Always Follow

### Before doing ANYTHING, ask me first if it involves:
- Deleting any file or folder
- Running any Supabase SQL or database migrations
- Changing environment variables in .env.local
- Renaming route folders (these change live URLs)
- Installing new npm packages
- Any git commit or git push

### Safe to do without asking:
- Editing existing .tsx / .ts files
- Creating new component files inside app/components/
- Creating new files inside lib/
- Reading/viewing any file

### Never do these:
- `rm -rf` anything
- Drop or truncate database tables
- Expose API keys in code
- Push to git without my explicit instruction

---

## Design System (use these exactly, no exceptions)

### Colours
- Primary action:     bg-emerald-600   hover:bg-emerald-700
- Primary light bg:   bg-emerald-50    text-emerald-700
- Page background:    bg-gray-50
- Card background:    bg-white
- Border:             border-gray-200  or  border-gray-300
- Body text:          text-gray-600
- Heading text:       text-gray-900
- Muted text:         text-gray-500
- Error:              bg-red-50  border-red-200  text-red-700
- Success:            bg-emerald-50  border-emerald-200  text-emerald-700

### Buttons
Primary:   bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors
Secondary: bg-white text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors

### Cards
bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow

### Inputs
w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500

### Typography
- Page title:    text-3xl md:text-4xl font-bold text-gray-900
- Section title: text-2xl font-bold text-gray-900
- Card title:    text-lg font-semibold text-gray-900
- Body:          text-base text-gray-600
- Small:         text-sm text-gray-500

---

## Coding Rules

1. Every async function must be wrapped in try/catch
2. Show loading states while data fetches (spinner or skeleton)
3. Show clear error messages if something fails
4. Use TypeScript types — no `any` unless absolutely unavoidable
5. Mobile-first: design for 375px width, then md: and lg: breakpoints
6. Never use Lorem ipsum — use real placeholder content
7. Add short comments explaining non-obvious logic
8. After every change, tell me exactly what to test and how

---

## Current Status (as of starting this session)

### Already working:
- Homepage with hero section and LocationSearch component
- Location filter on /find-ustaz page (FIXED — now uses .toLowerCase().trim())
- Tutor registration form at /register-ustaz
- Tutor directory at /find-ustaz
- Tutor profile pages at /ustaz/[id]
- Basic tutor dashboard at /dashboard

### What still needs doing:
See TASKS.md for the full Phase 1 and Phase 2 task list.
