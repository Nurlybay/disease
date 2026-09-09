# Email accounts

Homepage supports email/password signup, sign-in, password recovery and local
sign-out using the bundled official @supabase/auth-js SDK. Google OAuth is not
required. RU/KK/EN forms share the existing patient-chat session storage key.
Registration does not grant instructor privileges or add cloud result storage.
Guest practice remains available.

This static client uses the SDK implicit email flow, allowing confirmation and
recovery links to be opened on another device. SDK consumes URL fragment tokens.
PASSWORD_RECOVERY opens a new-password form. Passwords are cleared after requests
and when closing the dialog. Never put SMTP credentials in site files.

## Deployment status and remaining setup

Verified 2026-09-09 in Supabase: email sign-in and confirmation enabled; custom
SMTP enabled through Resend, with verified domain medqadam.com and sender
MedQadam <noreply@medqadam.com>. SMTP host smtp.resend.com, port 465.
Delivery and the full signup/recovery round trip still require testing.
See https://supabase.com/docs/guides/auth/auth-smtp .

Configure Authentication → Emails → SMTP Settings with the sender email, name,
SMTP host, port, username and password from your mail service. Enter secrets only
in Supabase. Keep email confirmation enabled. Then test signup, confirm link,
sign-in, sign-out, reset link and a new password with an authorized test mailbox.
This full delivery test has NOT yet been performed.

Configured and verified Site URL: https://medqadam.com/
Allowed redirect URLs:
- https://medqadam.com/index.html?lang=ru
- https://medqadam.com/index.html?lang=kk
- https://medqadam.com/index.html?lang=en
- https://nurlybay.github.io/disease/index.html?lang=ru
- https://nurlybay.github.io/disease/index.html?lang=kk
- https://nurlybay.github.io/disease/index.html?lang=en

Local development needs its own allowlisted URLs for email callbacks.

## Build and checks

```
npm ci --prefix tools/auth-build
npm run build --prefix tools/auth-build
node tools/test-account.js
node tools/test-patient-chat-client.js
node tools/test-locales.js
node tools/test-english.js --voices
```

Mocks cover signup payload, locale callback, login errors, password recovery
state, password update, clearing passwords and sign-out. SDK MIT license is
included in site/vendor. Browser checks cover forms and localized homepage.

## Learning access and demo (2026-09-09)

The landing page is public. The full pericarditis-alimov consultation is the
single guest demo. Other cases and the media workshop require a confirmed,
non-anonymous Supabase account. The instructor page additionally requires
`app_metadata.role` to be `teacher` or `admin` (never user-editable metadata).
No instructor role is granted by registration. An administrator must assign it
after the instructor has a confirmed account.

`learning-content` verifies users through Supabase Auth and serves bundled
scenario, workshop and instructor JavaScript. Pages artifacts omit those files.
`patient-chat` denies guest AI requests outside the demo. The `cases` table RLS
no longer allows anonymous reading. The SQL migration was applied in the
Supabase SQL editor. User sessions refresh using the official Auth SDK.

This controls the deployed application, not source-code confidentiality:
the repository/history and previously distributed media/translations are public.
To make the learning materials proprietary, move the source repository and all
clinical media/translations to private storage and audit historical exposure.
Do not describe this release as DRM or protection against copying.

Build/deploy when editing protected case or workshop code:

```
python3 tools/build-learning-content.py
npx supabase functions deploy learning-content --project-ref sawcjxnblgepkqdsvlio --no-verify-jwt --use-api
npx supabase functions deploy patient-chat --project-ref sawcjxnblgepkqdsvlio --no-verify-jwt --use-api
npm run build --prefix tools/auth-build
python3 tools/build-public-site.py
node tools/test-learning-access.js
```

Deploy the functions before publishing the frontend. Commit the regenerated
content.json. Never add Supabase CLI credentials to the repository.
Live guest tests verified: demo 200, protected assets 401 without auth / 403 for
an anonymous user, non-demo AI 403, and no shared cases returned to guests.
Confirmed-account and instructor authorization are covered by mocked tests;
a full email signup/recovery round trip still needs SMTP setup.

## Custom domain (2026-09-09)

GitHub Pages custom domain: medqadam.com. Namecheap ALIAS @ and CNAME www
point to nurlybay.github.io. Resend DKIM, send, rsend and DMARC records remain.
The patient-chat function permits HTTPS origins medqadam.com and www.medqadam.com.
GitHub Actions publishing does not require a CNAME file.
