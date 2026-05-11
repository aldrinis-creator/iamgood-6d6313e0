# FAQ Update — All Recent Ward & Guardian Features

## Current State
The FAQ file (`src/data/faqData.ts`, last updated 2026-04-20) has 32 sections but is missing coverage for many recently shipped features.

## Gaps to Fill

### 1. Hospital Visit & Admission Kit (NEW — just implemented)
- What is the Hospital Visit tab in Guardian Reports?
- What docs are included in the Admission Kit?
- How does the one-tap PDF download work?
- How does WhatsApp sharing work?
- What if a document is missing? (Nudge ward flow)

### 2. ID & Insurance Documents (NEW — just implemented)
- What is the ID & Insurance section in My Profile?
- Which 5 slots are available? (Aadhaar, PAN, Insurance Primary, Insurance Secondary, Photo)
- How do I upload or replace documents?
- How do I take a passport photo using the camera?
- Who can see these documents?

### 3. Guardian Reports & Appointments
- What tabs are in the Guardian Reports section?
- How do Guardian Appointments work?
- What is the "Today's Appointments" strip on the Guardian Dashboard?
- How does the red glow indicator work for today's appointments?

### 4. Health Passport
- What is the Health Passport?
- How is the Health Passport score calculated?
- What are the 7 categories?
- How do face scan results feed into the passport?

### 5. Pill Identifier
- What is the Pill Identifier?
- How does photo-based pill identification work?
- What happens if a banned drug is detected?
- How does the prescription cross-check work?

### 6. Safe Zones & Geofencing
- What are Safe Zones?
- How do I set up a Safe Zone?
- What happens when I leave a Safe Zone?
- How do guardians get notified?

### 7. Map My Journey — Safety Net
- What is the MMJ Safety Net?
- What is low-battery guardian alert?
- What is auto-SOS escalation on unanswered route deviation?
- What is the public live-tracking share link?

### 8. Voice Query & AI Check-ins
- What is the Voice Query button?
- How do AI voice check-ins work?
- When are they triggered?

### 9. Onboarding Wizard
- What is the 4-step onboarding wizard?
- What does each step cover?
- Can I skip steps and complete them later?

### 10. Battery Monitoring
- How does battery monitoring work?
- At what thresholds do alerts trigger?
- Who receives battery alerts?

### 11. Accessibility Menu
- What is the Accessibility Menu?
- What options does it provide?
- How does it help elderly users?

### 12. SOS Event Lifecycle
- What is the Active SOS banner?
- How is SOS resolution synced across roles?
- What is the trigger stability guard?

### 13. Check-In Settings & Vacation Mode
- What is the Check-In Settings dialog?
- How does Sleep Mode differ from Check-Out (Vacation Mode)?
- How do I configure check-in times?

## Implementation
- Update `src/data/faqData.ts` with new sections and update existing ones.
- Bump `FAQ_VERSION` to `2026-05-11`.
- Keep answer style consistent: 2-4 sentences, clear and direct.
- No code or UI changes needed — this is a content-only update.

## Files Touched
- `src/data/faqData.ts` (content update + version bump)
