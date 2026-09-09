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
SMTP disabled. Default mail delivery is restricted to project organization
members. Public signup confirmation and recovery need a custom SMTP sender.
See https://supabase.com/docs/guides/auth/auth-smtp .

Configure Authentication → Emails → SMTP Settings with the sender email, name,
SMTP host, port, username and password from your mail service. Enter secrets only
in Supabase. Keep email confirmation enabled. Then test signup, confirm link,
sign-in, sign-out, reset link and a new password with an authorized test mailbox.
This full delivery test has NOT yet been performed.

Configured and verified Site URL: https://nurlybay.github.io/disease/
Allowed redirect URLs:
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
