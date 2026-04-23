

## Plan — Tell the Guardian to install the app, at the right moments

Today a nominated Guardian gets the invite (email + WhatsApp/SMS), clicks **Accept & Create Account**, registers, and lands on "Go to Sign In" — at no point are they told the app can be installed on their phone. Below are the three touchpoints I'll add an install nudge to.

### 1. Guardian invitation email — `supabase/functions/_shared/transactional-email-templates/guardian-invitation.tsx`

Add a short "Get the app" section just below the existing "What does this mean?" info box, before the Accept button:

```
📱 Install the Check-iN app
After accepting, install Check-iN on your phone so you receive
SOS alerts and check-in updates instantly — even when the app
is closed.
   • iPhone: Open the link in Safari → Share → Add to Home Screen
   • Android: Open the link in Chrome → tap "Install app" when prompted
```

Style it like the existing `infoBox` (light background, navy left border) so it visually parallels the other info card. No new template props — pure copy.

### 2. WhatsApp / SMS invite (MSG91) — no code change, dashboard-only

The MSG91 invite template body currently doesn't mention installation. Since the SMS/WA template is approved by MSG91 and edited in their dashboard, I'll surface the suggested updated body text in the plan so you can paste it into the MSG91 template:

```
Hi {{guardian_name}}, {{user_name}}{{relation}} has nominated you
as their Guardian on Check-iN. Accept: {{accept_link}}
Reject: {{reject_link}}
After accepting, install the app from {{accept_link}} → Add to
Home Screen for instant SOS alerts.
```

No code change in this repo — just a one-line addition to the existing MSG91 template body, re-submitted for approval.

### 3. Post-registration success screen — `src/pages/Register.tsx`

In the existing `registrationComplete` block (lines 361–462), add a new install card for guardians (and users too, since it benefits both) right above the "Go to Sign In" button:

```
📱 Install Check-iN on your phone
Get instant SOS alerts and check-in updates — even when the app is closed.
[ Install App ]   [ Skip for now ]
```

Behavior:
- The **Install App** button uses the existing `usePwaInstall()` hook. If the browser supports `beforeinstallprompt` (Android Chrome, desktop Chrome/Edge), it triggers the native install dialog directly.
- If install isn't available (iOS Safari, already installed, or unsupported browser), the button instead navigates to the existing `/install` page, which already has iOS "Add to Home Screen" steps and the Android fallback.
- If `isInstalled === true`, the card is hidden entirely.
- Skip just continues to Sign In as today.

This reuses `PwaInstallBanner`'s logic (`usePwaInstall`, `installApp()`) — no new hook needed.

### 4. Bonus: in-app install nudge for first-time guardian sign-in

The first time a brand-new guardian signs in (no wards yet, no install dismissed), `GuardianDashboard` already shows their empty state. I'll add the existing `<PwaInstallBanner />` to the top of `GuardianDashboard` (same component used elsewhere) so the install nudge persists until they install or dismiss it. The banner already respects the `pwa-install-dismissed` localStorage flag, so it won't nag.

### Verification

1. Send a fresh guardian invite — the email shows the new "Install the Check-iN app" section between the "What does this mean?" box and the Accept button.
2. After updating the MSG91 template body and re-approval, the WhatsApp/SMS message includes the install hint line.
3. Complete a new guardian registration — the success screen shows the install card. On Android Chrome, clicking Install fires the native prompt; on iOS Safari, it routes to `/install` with the Add-to-Home-Screen steps.
4. After signing in for the first time, GuardianDashboard shows the install banner at the top until installed or dismissed.

### What I will NOT change

- No DB migration, no new edge function, no MSG91 secret rotation.
- No change to the 24-hour auto-accept rule.
- The `/install` page itself stays as-is — it's already the right destination.

