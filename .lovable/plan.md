# Update FAQs with All Recent Changes

Refresh both FAQ files (`src/data/faqData.ts` and `src/data/guardianFaqData.ts`) so the in-app Help pages, search, and downloadable Markdown guides reflect every feature added in this working session. Bump `FAQ_VERSION` and `GUARDIAN_FAQ_VERSION` to `2026-07-01`.

## Ward FAQ additions (`faqData.ts`)

Add/refresh these Q&As across existing sections (create new sections where noted):

**Daily Check-In**
- Early check-in window is now **60 minutes** before the scheduled time (was 30).
- Push reminders now fire at **T-0, T+10, T+30** even if the app is closed.
- Late responses are recorded and surfaced to Guardians.

**Medications (new/updated)**
- Voice alert at T-0 announcing the medication name (toggle in Settings, default ON).

**Appointments (new section)**
- Loud 3-burst chime + spoken reminder at the selected alert lead time.

**Emergency & Hospital**
- Blood Bank Directory (6,145 centres) — 3-step Group → Component → Nearest flow; sign-in required.
- Hospital Admission Kit now includes the full **Ward Profile Snapshot** (6 sections) and the **Doctor Visit Report**.

**Communication (new section)**
- One-tap **Call Guardian** button (mobile call) on the home screen.
- In-app ringer to the Guardian's phone via Realtime.

**Safe Zones**
- WhatsApp alerts to Guardians on **exit** (`safe_zone`) and **return** (`safe_zone_return`).

**Voice Assistant / Customer Service (new section)**
- Conversational **Voice Agent** (Ask + Chat modes, auto-speaks first reply, 50 turns/day soft cap) — free for all.
- **Customer Service** hub at `/support`: WhatsApp, phone (Mon–Sat 9–6 IST), email ticket, FAQ.

**Home Screen / Settings**
- Mode selector (Active / Sleep / Checked-Out) moved to **Settings → Check-iN**.
- Health Passport tile now sits above Map My Journey.

## Guardian FAQ additions (`guardianFaqData.ts`)

**Alerts & Audio (new/updated)**
- Persistent missed check-in audio escalation on app open/foreground (loops every 12s, Dismiss button, toggle in Guardian Settings, default ON).
- WhatsApp Safe Zone exit + return alerts explained.

**Communication (new section)**
- Incoming in-app call ringer from the Ward; how to accept/decline.

**Reports (new/updated)**
- Weekly report now emailed every **Sunday 09:00 IST**.
- Doctor Visit Report section in Reports tab (Primary Guardian only).

**Hospital Admission Kit**
- Now includes Ward Profile Snapshot + Doctor Visit Report.

**Voice Agent & Customer Service (new section)**
- Same Voice Agent available to Guardians.
- `/support` hub details.

## Technical notes

- Both files are plain TS arrays; append items to existing sections and push new `FaqSection` objects where needed. Icons use the existing `iconMap` keys in `Help.tsx` / `GuardianHelp.tsx` (`heart`, `shield`, `bell`, `phone`, `message-circle`, etc.) — if a new icon key is introduced, extend the corresponding `iconMap` in the page files.
- Bump both version constants; the download filename and footer pick these up automatically.
- No schema, backend, or route changes.

## Out of scope
- No UI/layout changes to Help pages.
- No changes to blog, legal pages, or Guardian dashboard.
