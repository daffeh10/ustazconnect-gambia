# TutorConnect Auth Email Runbook

Use this checklist for password resets, signup confirmations, and admin invitations.
Application notifications sent by `lib/email.ts` are separate from Supabase Auth
emails. A working `RESEND_API_KEY` in Vercel does not configure Supabase Auth.

## 1. Connect Supabase Auth to Resend

In Resend, create a dedicated API key for Supabase Auth. Do not commit or share it.

In Supabase, open **Authentication > Email > SMTP Settings**, enable custom SMTP,
and enter:

- Sender name: `TutorConnect Gambia`
- Sender email: `notifications@tutorconnectgambia.com`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the dedicated Resend API key

Save the settings. Supabase's default mailer is not suitable for production and
will not deliver to ordinary users who are outside the Supabase project team.

## 2. Set the production Auth URLs

In **Authentication > URL Configuration**, set:

- Site URL: `https://tutorconnectgambia.com`
- Redirect URL: `https://tutorconnectgambia.com/auth/callback`
- Redirect URL: `https://tutorconnectgambia.com/auth/callback?next=/login`
- Redirect URL: `https://tutorconnectgambia.com/auth/callback?next=/update-password`
- Redirect URL: `https://tutorconnectgambia.com/update-password`

Do not use a temporary `vercel.app` URL for production Auth emails. Add
`http://localhost:3000/**` only when local email-flow testing is genuinely needed.

## 3. Use scanner-safe email templates

In **Authentication > Email Templates > Reset password**, use a short subject such
as `Reset your TutorConnect Gambia password` and this body:

```html
<h2>Reset your password</h2>
<p>We received a request to reset your TutorConnect Gambia password.</p>
<p>
  <a href="{{ .SiteURL }}/reset-password-email?token_hash={{ .TokenHash }}&type=recovery">
    Continue to reset password
  </a>
</p>
<p>If you did not request this, you can ignore this email.</p>
```

In **Authentication > Email Templates > Invite user**, use a short subject such as
`Your TutorConnect Gambia admin invitation` and this body:

```html
<h2>You have been invited</h2>
<p>You have been invited to help manage TutorConnect Gambia.</p>
<p>
  <a href="{{ .SiteURL }}/invite-email?token_hash={{ .TokenHash }}&type=invite">
    Accept invitation
  </a>
</p>
<p>Use the newest invitation only. This link expires and can only be used once.</p>
```

These links carry Supabase's hashed single-use token to a TutorConnect page. The
token is verified only after the user clicks the second button. This prevents
automated email scanners from consuming it and works when the email is opened in
a different browser or device from the one that requested it. The landing pages
continue to accept the older `confirmation_url` format so emails already sent
before this template update remain usable until they expire.

## 4. Delivery and abuse settings

- In Resend, disable click and open tracking for Auth messages.
- In Supabase **Authentication > Rate Limits**, keep password-reset cooldown at
  least 60 seconds and use a practical hourly email limit for current traffic.
- Keep Auth email separate from marketing email.
- Never send several reset emails in quick succession. Every new email invalidates
  the previous reset link.

## 5. Test after every email configuration change

1. Open the production site, not a Vercel preview.
2. Sign in as the owner and open `/admin/admins`.
3. Run **Test application email**. This verifies Vercel-to-Resend delivery.
4. Run **Test password-reset email**. This verifies Supabase Auth-to-Resend delivery.
5. Confirm the Auth test appears as `Delivered` in Resend.
6. Open the newest email, continue through the TutorConnect landing page, and set a
   temporary test password.
7. Invite a new test admin address and complete password creation.
8. Add an existing TutorConnect user as admin and confirm the separate access email.

## 6. Diagnose failures

- Supabase rejected the request: inspect **Supabase > Logs > Auth**.
- Supabase accepted it but no message appears in Resend: recheck SMTP credentials.
- Resend shows `Bounced` or `Suppressed`: inspect the recipient and suppression
  reason before retrying.
- Resend shows `Delivered` but the inbox is empty: check spam and the recipient's
  mailbox rules. Do not repeatedly send new reset links while investigating.
