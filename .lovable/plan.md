

# Apply Check-iN Letterhead to All Reports and Prints

## What Changes

Replace all ad-hoc print/PDF HTML templates across the app with a unified letterhead format matching the uploaded `Check-iN_Letterhead.pdf`. Every printable report — for both Users and Guardians — will use the same branded layout.

## Letterhead Design (from PDF)

```text
+--------------------------------------------------+
| [Check-iN Logo]  CHECK-iN              [FW Logo] |
|                  Personal Safety &                |
|                  Emergency Monitoring System       |
|——————————————— red divider line ——————————————————|
|                                                    |
| REPORT TITLE                                       |
| Generated on: DATE | TIME                         |
|                                                    |
| << Dynamic report content >>                       |
|                                                    |
|                                                    |
|——————————————— thin divider ——————————————————————|
| Check-iN | PERS    www.futurewave.in |             |
|                    sales@futurewave.in | +91       |
|                    7045868482                       |
|                              Confidential | Page   |
+--------------------------------------------------+
```

## Technical Plan

### 1. Copy logos to `public/`
- Copy `Check-iN_Letterhead.pdf` logos (extracted images) to `public/images/` as `checkin-logo.png` and `futurewave-logo.png`
- These will be embedded as base64 data URIs in the print HTML so they work offline

### 2. Update `src/lib/reportPdf.ts` — Central letterhead template
- Replace `buildHtml()` with the letterhead layout:
  - **Header**: Check-iN logo (left) + app name/tagline, Future Wave Technologies logo (right), red horizontal rule
  - **Title block**: Report title, subtitle, generated date/time, category badge
  - **Content area**: Same markdown-to-HTML converter
  - **Footer**: "Check-iN | PERS" (left), contact info centered, "Confidential | Page" (right)
- Embed both logos as inline base64 data URIs so print works without network
- Export a new helper `buildLetterheadHtml(opts)` that other files can reuse for custom content

### 3. Update `src/components/medications/RefillOrder.tsx`
- Replace inline `saveAsPdf()` HTML with a call to a shared letterhead builder from `reportPdf.ts`

### 4. Update `src/components/WardRefillOrder.tsx`
- Same: replace inline print HTML with shared letterhead builder

### 5. Update `src/components/SOSDialog.tsx`
- Replace `buildCardHtml()` inline HTML with letterhead-wrapped version (keeping emergency red accent for the alert sections inside)

### 6. Update `src/components/WardEmergencyCard.tsx`
- Replace `handlePrint()` and `handleDownload()` inline HTML with letterhead-wrapped version

### 7. Update `src/pages/MedicalVault.tsx`
- Replace `buildEmergencyHtml()` inline HTML with letterhead-wrapped version

| File | Change |
|------|--------|
| `public/images/checkin-logo.png` | New — Check-iN app logo for letterhead |
| `public/images/futurewave-logo.png` | New — Future Wave Technologies logo |
| `src/lib/reportPdf.ts` | Rewrite `buildHtml` with letterhead layout + export `buildLetterheadHtml` for custom body HTML |
| `src/components/medications/RefillOrder.tsx` | Use shared letterhead builder |
| `src/components/WardRefillOrder.tsx` | Use shared letterhead builder |
| `src/components/SOSDialog.tsx` | Wrap emergency card in letterhead |
| `src/components/WardEmergencyCard.tsx` | Wrap emergency card in letterhead |
| `src/pages/MedicalVault.tsx` | Wrap emergency card in letterhead |

