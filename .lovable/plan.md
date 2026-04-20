## Plan

Three coordinated changes to surface the new Quick Visual Checks feature, refresh FAQs, and showcase the Smart Ring in Premium Plus.

### 1. Add the user's Smart Ring image as a project asset

- Copy `user-uploads://image-106.png` → `src/assets/smart-ring.png` so it can be imported and bundled.

### 2. Premium Plus card — surface "Quick Visual Checks" + show Smart Ring visual (`src/pages/Subscription.tsx`)

- **Add feature line** to the `premium-plus` plan's `features` array:
  - `"Quick Visual Checks"` with a sub-line `"Urine, Tongue & Face Analysis"` rendered as a 2-line item (small muted second line under the main feature).
  - Render: extend the feature row to optionally accept `{ label, sub }` objects so only this entry shows the second line; rest stay strings (backward compatible).
- **Smart Ring visual block** — inside the existing Premium Plus "Pre-Register Now" gradient card, add a hero image block at the top:
  - Imported `smart-ring.png` displayed in a circular glow frame (radial gradient backdrop, soft shadow, subtle pulse animation via Tailwind `animate-pulse` on the glow ring only — not the image).
  - Caption: "Smart Ring — Continuous ECG, HR, SpO₂, BP, Sleep tracking, and 24x7 mobile / satellite Tracking".
  - Badge overlay: "Coming Soon" pill in top-right.
- **Also add to Premium plan's `excluded` list**: `"Quick Visual Checks (Urine, Tongue & Face)"` so the upgrade incentive is visible from the Premium tier.

### 3. FAQ refresh (`src/data/faqData.ts`) + downloadable document (`src/pages/Help.tsx`)

**A. Add two new FAQ sections** (insert after "Health Tools"):

1. `**Quick Visual Checks**` (icon: `scan`)
  - What is Quick Visual Checks?
  - How does Urine Analysis work? (colour + 10-pad dipstick, photo tips, see-doctor severity)
  - How does Tongue Analysis work? (colour, coating, surface insights)
  - How does Face Analysis work? (HR/SpO₂/stress via camera, photo & video modes)
  - Is my image stored? (Vault opt-in, otherwise discarded after analysis)
  - When are guardians auto-alerted? (urgent / soon red-flag flow)
2. `**Premium Plus & Smart Ring**` (icon: `crown` — add `<Crown />` to `iconMap` in `Help.tsx`)
  - What's included in Premium Plus? (everything in Premium + unlimited check-ins, Vault, Wellness AI, Safe Zones, Fall Detection, Quick Visual Checks)
  - What is the Smart Ring and what does it measure? (ECG, HR, SpO₂, BP, EDA, sleep, multiple sports modes, gesture control)
  - When will the Smart Ring ship? (pre-register; we email when available)
  - What does ₹9,999/yr include? (1-year content subscription + one-time wearable charge; data charges from Year 2)

- Bump `FAQ_VERSION` to today's date (`2026-04-20`).

**B. Wire up the existing "Download" button in `Help.tsx**`:

- Implement `handleDownloadFaq()` that builds a single Markdown blob from `faqSections` (title → Q/A list) plus a header (`Check-iN FAQ — v{FAQ_VERSION}`) and footer disclaimer, then triggers a download as `Check-iN-FAQ-{FAQ_VERSION}.md`.
- Markdown is lightweight, opens in any text/markdown viewer, and stays in sync automatically with FAQ data on every future update (no manual PDF maintenance).

### Files to edit / create

- **Create**: `src/assets/smart-ring.png` (copied from upload)
- **Edit**: `src/pages/Subscription.tsx` — feature item with sub-line support, Smart Ring hero in Premium Plus card, add Quick Visual Checks to features/excluded
- **Edit**: `src/data/faqData.ts` — two new sections + version bump
- **Edit**: `src/pages/Help.tsx` — wire Download button to generate Markdown FAQ file, add `crown` to `iconMap`

### Out of scope

- PDF generation for the FAQ (Markdown is simpler and stays auto-fresh; can be upgraded to PDF later if needed)
- Changing pricing or plan structure
- Adding Smart Ring telemetry/integration code (hardware doesn't exist yet — visual-only)