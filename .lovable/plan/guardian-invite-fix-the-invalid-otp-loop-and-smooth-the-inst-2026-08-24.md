# Guardian invite: fix the "Invalid OTP" loop and smooth the install journey

## What the records show

Looking at the OTP event history for the guardian numbers involved:

- Several `verify_fail` entries land **10-25 seconds after a fresh resend**. That is the signature of the guardian typing the code from the *first* WhatsApp message while the server only ever accepts the *most recent* code. Every resend silently kills the earlier code.
- Codes expire after **5 minutes**. WhatsApp-then-SMS fallback can take longer than that, so a code that finally arrives is often already dead.
- Some attempts were against a mistyped number, which is already prevented on the invite screen (the number is now locked from the server lookup).

So "OTP arrives but is invalid" is real and explainable: too-short validity plus only-the-latest-code-wins plus an auto-send that fires again whenever the screen is re-entered.

## Fix 1 — Stop the invalid-code loop

- Accept **any unexpired, unused code** for that number, not just the newest one. A resend no longer invalidates the code already sitting in the guardian's WhatsApp.
- Extend code validity from 5 to **10 minutes**, matching realistic WhatsApp/SMS fallback delays.
- Do not auto-send a new code when the verification screen is re-entered within the validity window; reuse the live code and show the remaining time instead.
- Count failed attempts per code (max 5) and show a precise reason: wrong code, expired code, or too many attempts — instead of one generic "Invalid OTP".
- Keep the existing safeguard that a code can only go to the number the ward actually invited.

## Fix 2 — Make the WhatsApp button land in a real browser

The "Accept and Install" button currently opens inside WhatsApp's built-in browser on many phones. That browser cannot install a PWA and handles sessions poorly, which is a second source of dead ends.

- Detect the in-app browser (WhatsApp / Instagram / Facebook webviews) on the install and registration pages.
- Show a clear, single-tap prompt: "Open in Chrome" (Android, via an intent link that switches browsers automatically) or "Tap ⋯ then Open in Safari" (iOS), so the guardian continues in a browser that can install the app.
- Carry the invitation token across that switch so nothing is lost.

## Fix 3 — Fewer taps on the guardian screen

- Name and phone are already pulled from the invitation. Once both load successfully, **advance straight to the verification screen and request the code automatically**, so the guardian sees the code entry rather than a form they cannot edit.
- Show a visible "Sending your code to +91 ….." state with a retry option, and auto-submit as soon as six digits are entered — no separate Verify tap.

## About auto-reading the code and auto-closing the browser

Honest constraints, so the flow is designed around what phones actually allow:

- **Auto-reading the code**: Android Chrome can auto-fill a code from an **SMS** only if the SMS text ends with a special line naming our domain. WhatsApp messages can never be auto-read by a website. So this works only on the SMS fallback and only after the MSG91/DLT SMS template is re-registered with that line. iOS Safari cannot do it at all for websites, though iOS offers the code from the keyboard suggestion bar. Plan: add the field hints that make the keyboard suggestion appear everywhere, and enable true auto-fill on Android once the SMS template carries the required line.
- **Installing the app automatically**: browsers require the person to tap Install; it cannot be triggered silently. The install prompt will be surfaced immediately after verification succeeds.
- **Closing the browser automatically**: no website can close a browser tab it did not open. Instead, after install the flow will hand off to the installed app and show a short "You can close this tab" confirmation.

## Technical scope

- `supabase/functions/send-otp/index.ts` — multi-code verification window, 10-minute expiry, per-code attempt counter, distinct error codes, reuse of a live code instead of re-sending.
- `src/components/OtpVerification.tsx` — no duplicate auto-send, live countdown, auto-submit on 6 digits, `autocomplete="one-time-code"`, optional WebOTP listener on Android, precise error messages.
- `src/pages/Register.tsx` — auto-advance to verification once the invitation loads.
- `src/pages/Install.tsx` plus a new in-app-browser helper — browser hand-off prompt and token preservation.
- No new database tables; the existing `otp_events` fields are reused.
