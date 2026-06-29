# TutorConnect Gambia — Remaining MVP Task List

This is the **current** task file for the live MVP.

It is intentionally different from `TASKS_old.md`.
`TASKS_old.md` is the historical build-out plan.
This file is the **next-step execution plan** for the product as it exists today.

Use this file for all future work unless there is a specific reason to consult the old one.

---

## 0. How To Use This File

This file follows the operating rules in [AGENTS.md](./AGENTS.md) and borrows the strongest workflow ideas from `claude-code-playbook.md`.

### Core workflow
1. Start by reading `AGENTS.md`
2. Read this file
3. Pick **one task only**
4. Ask the agent to:
   - audit first
   - plan second
   - implement third
5. Before accepting a change:
   - run build
   - run lint where appropriate
   - test the real behavior, not just the code
6. Commit only the intended files
7. Deploy only after verification

### Important operating rules
- Never ask the agent to build huge features in one shot
- Prefer small focused tasks with clear acceptance tests
- Keep the live product stable
- Do not ship speculative features just because they sound useful
- Favor trust, conversion, searchability, and operations over feature volume

### Task status labels
- `[NEXT]` = highest priority next
- `[OPEN]` = worthwhile, not immediate
- `[LATER]` = valid, but not MVP-critical right now
- `[MANUAL]` = primarily operational, business, or platform work
- `[DONE]` = already completed

---

## 1. Current Baseline

These are already working and should be preserved:

- Live site on `https://tutorconnectgambia.com`
- Custom domain connected correctly
- Google Search Console verified
- Sitemap submitted
- Public tutor browsing
- Tutor profile pages
- Delayed account creation during booking
- Tutor booking acceptance flow
- Real ModemPay payment flow
- Booking activation after successful payment
- Automatic lesson creation after payment
- Tutor dashboard
- Family dashboard
- Basic admin pages
- Password reset flow using two-step reset landing page
- Tutor registration tightened with required profile fields
- Tutor language selection includes Arabic while the site remains English

### Current business settings
- Family fee: `3%`
- Tutor commission: `5%`
- Temporary contact email on the site:
  - `tutorconnectgambia@gmail.com`

---

## 2. Priority Framework

For the next phase, tasks should be judged in this order:

1. **Search and discovery**
2. **Trust and conversion**
3. **Operational execution**
4. **Live QA / reliability**
5. **Professional polish**

Anything that does not clearly improve one of those should be challenged before being built.

---

## 3. Immediate Priorities

## Task 3.1 — Searchable Location Filter `[NEXT]`

### Why this matters
This was explicitly recommended in external review and is one of the strongest remaining product improvements.

Right now, location filtering exists, but it should be easier and faster to use.

### Goal
Make location selection on tutor discovery faster and more scalable without overcomplicating the UI.

### Requirements
- audit the current tutor discovery filter first
- improve the location filter so users can search rather than scroll long lists
- preserve mobile-first usability
- keep the experience simple and fast
- do not introduce a heavy map or complicated geolocation dependency

### Good solution characteristics
- text search or searchable dropdown/combobox
- easy on mobile
- still understandable for non-technical users
- keeps current Gambian location structure usable

### Acceptance checks
- user can quickly find a location without scrolling the full list
- works on desktop and mobile
- does not break existing tutor filtering
- build passes

---

## Task 3.2 — Searchable Subject Filter `[NEXT]`

### Why this matters
Also directly recommended in external review.

The subject list is already broad and useful, but it should be easier to search and pick quickly.

### Goal
Make subject selection/search faster in the tutor directory.

### Requirements
- audit current subject filter UI first
- improve subject finding with a searchable control or search-assisted picker
- preserve grouped categories if they still add clarity
- avoid making the filter visually noisy

### Good solution characteristics
- fast to scan
- easy to type into
- understandable on mobile
- still supports existing subject structure

### Acceptance checks
- users can type to narrow subjects
- grouped subject structure is not broken if retained
- filter results remain correct
- build passes

---

## Task 3.3 — Domain Email Upgrade Path `[OPEN]`

### Why this matters
The current Gmail works, but a domain-based email would improve trust.

### Current state
- site currently uses `tutorconnectgambia@gmail.com`
- domain `tutorconnectgambia.com` is already live

### Goal
Move toward a branded support email such as:
- `info@tutorconnectgambia.com`

### Recommended approach
- first use Cloudflare Email Routing or equivalent
- later upgrade to a full mailbox if needed

### Requirements
- choose the lowest-friction professional setup
- update site contact points only after the real address works
- verify inbound mail delivery before replacing the current address

### Acceptance checks
- branded email address exists and receives mail
- footer / legal / support references are updated consistently
- no broken contact info remains

---

## Updated Task 3.4 — Tutor Approval / Verification Audit `[OPEN]`

### Why this matters
Trust is the product in a tutoring marketplace.

Tutor signup should stay lightweight for conversion.
But public approval and listing should be stricter, clearer, and more credible before scale.

### Goal
Strengthen the post-signup review and approval flow so TutorConnect Gambia can:
- keep registration friction low
- protect family trust
- avoid publicly listing weak or unchecked tutor profiles
- support both formally qualified tutors and clearly competent tutors without formal certificates

### Recommended MVP direction
Keep signup light.

Do **not** move full verification into the first registration step.

Instead:
- allow tutors to register first
- require minimum trust evidence before public approval/listing
- separate “account created” from “approved for public listing”

### Proposed approval model
Adopt a simple **two-track review model** for publicly listed tutors:

1. **Qualification Verified**
   - for tutors with formal qualifications
   - examples:
     - degree
     - certificate (prefer certificates)
     - transcript
     - madrasa / Arabic / Islamic teaching certificate
     - other recognized competence proof

2. **Profile Reviewed**
   - for tutors who may not yet have formal certification but are still credible to teach
   - examples:
     - currently studying in a relevant field
     - strong subject competence
     - relevant teaching experience
     - Quran / Tajweed / Hifz tutors with credible non-degree pathways
   - must still pass manual review before listing

### Important principle
Do **not** publicly list tutors with no review at all.

For this MVP, tutors should be:
- registered but not listed yet, or
- publicly approved and clearly labeled

### What should be required before public approval / listing
For MVP launch, require these before a tutor can be approved publicly:

- completed core profile
- profile photo uploaded
- at least one competence document or review evidence uploaded
- manual admin review completed

### What is not required yet
- national ID card is **not required at this stage**
- do not introduce heavy KYC yet unless a stronger trust/compliance need emerges

### Evidence rules for each review path

#### A. Qualification Verified
Accepted evidence can include:
- degree
- certificate
- transcript
- teaching credential
- madrasa / Islamic studies qualification
- other formal learning proof relevant to the subject

Result:
- tutor may be approved for listing
- tutor can receive a stronger public trust label such as:
  - `Qualification Verified`

#### B. Profile Reviewed
For tutors without formal certification, allow an exception path if they still appear credible.

Accepted evidence can include a combination of:
- CV / resume
- proof they are currently studying a relevant subject
- short written teaching background
- reference letter or recommendation
- evidence of prior tutoring, madrasa teaching, or subject competence

Result:
- tutor may still be approved for listing after manual review
- tutor should **not** be presented the same way as a formally qualified tutor
- use a lighter public label such as:
  - `Profile Reviewed`

### Public profile privacy rule
Public tutor names should display:
- full first name
- first letter of last name

Example:
- `Fatou J.`

Keep the full legal name internally for admin review.

### Profile photo rule
- profile photo should **not** block initial registration
- but it **should** block public approval/listing
- tutors without a photo should be clearly prompted in the dashboard to upload one before approval

### Dashboard status rule
Do not rely on review-status emails for this MVP.

Instead, tutors should see their current review and verification status directly inside their dashboard.

The dashboard should clearly communicate:
- whether the profile is under review
- whether the profile is live with the `Basic` label
- whether the tutor has reached `Profile Reviewed`
- whether the tutor has reached `Qualification Verified`
- what is still missing, if anything

Examples of missing items:
- profile photo not uploaded
- no review document uploaded
- review document uploaded but still pending admin review

### Registration completion message
Once a tutor completes registration, show a clear in-app confirmation message telling them:
- their registration was received
- their profile status can be tracked in their dashboard
- they may still need to upload a profile photo and review documents before stronger verification or public approval

Suggested message:
`Your registration is complete. You can now sign in to your dashboard to track your profile status, upload your photo and review documents, and see any next steps for approval.`

### Tutor dashboard tone requirements
All tutor review/status copy should be:
- brief
- clear
- operational
- human-sounding
- free from generic AI-style wording

### Recommended MVP behavior
- keep the dashboard as the main source of truth for tutor review status
- show missing items clearly inside the tutor dashboard
- avoid building email-based status workflows for now
- only add email automation later if there is a real operational need

### Acceptance checks
- tutors can clearly see their current review status in the dashboard
- tutors can clearly see what is missing for stronger verification
- registration completion tells tutors to check their dashboard for status and next steps
- no dependency on email automation for MVP launch

### Audit questions this task should answer
- what is already enforced today before tutor approval?
- are document uploads actually connected to approval decisions?
- is the trust badge logic aligned with what was truly reviewed?
- can admin approve tutors even if photo/documents are missing?
- should public labels distinguish formal qualification review from general profile review?
- are public names too revealing for the current trust/privacy balance?
- is the promised review timeline realistic?

### Likely implementation direction
Focus on minimal high-value fixes only:

1. gate public approval on:
   - profile photo present
   - at least one valid competence evidence path present
2. separate trust labels for:
   - `Qualification Verified`
   - `Profile Reviewed`
3. update public tutor name display to first name + last initial
4. add concise review-status emails
5. align dashboard/admin copy with the real review process and SLA

### Non-goals for this task
Do **not** expand into:
- full identity verification
- complicated verification tiers
- legal-document overengineering
- broad admin workflow redesign

### Acceptance checks
- clear understanding of what the current approval flow already enforces
- approval gaps are identified concretely
- minimum listing requirements are defined clearly
- non-certified but credible tutors have a valid review path
- public labels match actual review strength
- public name display is privacy-safer
- review email copy is defined and usable
- recommended changes remain MVP-sized and operationally realistic

### Basic tutor grace-period rule
For MVP, tutors with the `Basic` label may remain publicly visible for a limited grace period while they complete their profile and upload review materials.

Recommended rule:
- allow `Basic` tutors to remain public for up to `90 days`
- during that period, show clear dashboard reminders about what is still missing
- if required items are still missing after 90 days, remove the tutor from public listing
- do **not** delete the tutor account
- keep dashboard access available so the tutor can complete verification later and be reviewed again

### Why this approach is better
This balances:
- trust for families
- fairness to tutors
- operational simplicity

It avoids:
- leaving weak profiles public indefinitely
- harsh account deletion
- unnecessary admin complexity

### What counts as incomplete after the grace period
A `Basic` tutor should be considered incomplete if they still lack:
- a clear profile photo
- at least one valid review document
- any other minimum trust requirement needed for stronger review

### Recommended MVP behavior
- `Basic` is a temporary state, not a permanent trust label
- dashboard should clearly show what is missing
- tutors should understand that public visibility under `Basic` is limited
- after 90 days, incomplete `Basic` tutors should be hidden from public search until they comply

### Acceptance checks
- `Basic` tutors are treated as temporary, not permanent
- dashboard communicates missing items clearly
- incomplete tutors are removed from public listing after 90 days
- accounts are preserved even when public listing is removed

---

## Task 3.5 — Live QA Sweep on Real Domain `[OPEN]`

### Why this matters
The site is live.
Now reliability matters more than feature count.

### Goal
Run a disciplined manual QA pass on `https://tutorconnectgambia.com`

### Scope
- homepage
- find tutor
- tutor profile
- tutor signup
- family login/signup during booking
- forgot password
- booking
- payment
- lesson creation
- tutor dashboard
- family dashboard
- mobile views

### Requirements
- test real user flows, not just page loads
- capture bugs as concrete reproducible issues
- prioritize only bugs that affect trust, payments, or core conversion

### Acceptance checks
- checklist completed
- real blockers separated from minor polish
- fixes prioritized rationally

---

## 4. Operational / Business Tasks

## Task 4.1 — Tutor Onboarding Plan `[NEXT][MANUAL]`

### Why this matters
External review was clear:
technology is not the main bottleneck now.
execution and operations are.

### Goal
Create a practical tutor supply plan for real onboarding.

### Focus
- major schools
- Quranic tutors
- high-demand areas
- trusted early tutors with good profiles

### Desired output
- short outreach script
- tutor onboarding checklist
- target list of schools or local areas
- criteria for which tutors to onboard first

### Acceptance checks
- there is a real plan to get tutors on the ground
- not just a technical feature backlog

---

## Task 4.2 — Contact / Support Operating Routine `[OPEN][MANUAL]`

### Goal
Define how inquiries, tutor questions, and early support will actually be handled.

### Questions to answer
- which email is monitored daily?
- what is the expected response time?
- how are tutor approval questions handled?
- where are support issues tracked?

This does not need fancy tooling.
It just needs a working routine.

---

## 5. Product / Trust Polish

## Task 5.1 — Tutor Profile Quality Pass `[OPEN]`

### Goal
Improve the credibility of tutor listings without bloating the product.

### Examples
- better default empty states
- stronger helper text
- clearer explanation of languages, rates, and teaching areas
- reduce weak/incomplete profile presentation

### Rule
Do not redesign everything.
Only improve things that clearly affect trust or conversion.

---

## Task 5.2 — Search Console Monitoring `[OPEN][MANUAL]`

### Goal
Check whether Google is discovering the main pages correctly.

### Scope
- review Search Console after a few days
- inspect homepage
- inspect `find-tutor`
- inspect a few tutor profile pages
- resubmit or request indexing if needed

---

## 6. Explicit Non-Priorities

These should generally be skipped unless a real business reason appears:

- full Arabic site translation
- advanced analytics dashboards
- large admin feature expansion
- broad refactors
- feature-heavy messaging/chat systems
- big design rewrites
- speculative “nice to have” flows

---

## 7. Release Rules

Before each push/deploy:

1. inspect the diff
2. confirm only intended files are included
3. run build
4. run lint when appropriate
5. state:
   - what changed
   - what still needs manual testing
   - what was intentionally not included

---

## 8. Suggested Next Sequence

If no new urgent issue appears, the recommended order is:

1. **Task 3.1 — Searchable Location Filter**
2. **Task 3.2 — Searchable Subject Filter**
3. **Task 3.5 — Live QA Sweep**
4. **Task 4.1 — Tutor Onboarding Plan**
5. **Task 3.3 — Domain Email Upgrade Path**

This sequence matches the current MVP reality:
- the product works
- now it needs better discovery, trust, and operational execution

---

## 9. New Chat Prompt Template

Use this at the start of future chats:

```text
This is TutorConnect Gambia, a live tutoring marketplace MVP on https://tutorconnectgambia.com.
Please read AGENTS.md and TASKS.md first.
Focus only on the next MVP-critical task.
Start with an audit and plan before coding.
Today’s task is: [paste one task heading here].
```

