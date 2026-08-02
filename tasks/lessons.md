# Lessons — corrections worth remembering

When an agent gets something wrong about this codebase and Abdul corrects it, add a
one-line rule here. Periodically promote recurring ones into `CLAUDE.md` §5 (Gotchas).

Format: `- YYYY-MM-DD — <the rule>. (why: <what went wrong>)`

---

- 2026-06-29 — Never compute or trust money on the client; the server recomputes
  every charge from the tutor's authoritative rate. (why: booking rows are inserted
  from the browser and amounts were tamperable.)
- 2026-06-29 — Middleware is `proxy.ts` (Next 16 rename), not `middleware.ts`.
  (why: an earlier note claimed there was no route protection.)
- 2026-06-29 — Payments are Waychit, not ModemPay. (why: stale docs referenced an
  abandoned ModemPay plan.)
- 2026-06-29 — `tutor_profiles.is_approved` / `verification_status` are locked by a
  DB trigger to the service role; set them only in `/api/admin/*`. (why: the RLS
  UPDATE policy let tutors self-approve and self-award badges.)
- 2026-07-26 — Verify security patch versions against the official release and
  run lint after dependency overrides. (why: an assumed patch and incompatible
  transitive override were corrected before shipping.)
- 2026-08-02 — Treat Supabase Auth email as a separate delivery channel from
  application Resend email; production Auth needs custom SMTP and canonical
  callback URLs. (why: app emails worked while resets and invitations failed.)
