

# Update Letterhead to Match Official Check-iN Design

## What Changes

Replace the current simplified text-based letterhead in `src/lib/reportPdf.ts` with the official Check-iN letterhead design from the uploaded image. The new design features colorful gradient wave banners at top and bottom, the Future Wave Technologies Pvt. Ltd. logo, and proper footer contact layout.

## Design from Uploaded Letterhead

```text
┌─────────────────────────────────────────────┐
│  ~~~ Colorful wave swoosh (purple/orange) ~~│
│                    FW  Future Wave           │
│                        Technologies Pvt. Ltd.│
├─────── orange/red divider line ─────────────┤
│  [Logo]  Check-iN                           │
│          A PERS PRODUCT OF FUTURE WAVE TECH │
│                                             │
│         (report content area)               │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  ~~~ Colorful wave swoosh (bottom) ~~~~~~~~~│
│  📞 +917045864882 | 🌐 futurewave.in | ✉ sales│
└─────────────────────────────────────────────┘
```

## Approach

1. **Copy the uploaded letterhead image** into `public/` as a reference asset
2. **Create top wave header and bottom wave footer as base64-encoded image slices** — crop the top ~80px and bottom ~80px from the uploaded letterhead and embed as base64 data URIs in the CSS, ensuring the wave graphics render in print
3. **Update `buildLetterheadHeader()`** — replace text-only "FUTURE WAVE / Technologies" with proper "Future Wave Technologies Pvt. Ltd." branding alongside the wave header graphic
4. **Update `buildLetterheadFooter()`** — add the wave footer graphic with contact info showing phone icon, globe icon, and email icon matching the uploaded design
5. **Update `getLetterheadCss()`** — adjust styles for the new wave-based layout, proper spacing, and the orange divider line between header waves and content area

## Key Design Details (from image)

- **Company name**: "Future Wave Technologies Pvt. Ltd." (not just "FUTURE WAVE / Technologies")
- **Tagline**: "A PERS PRODUCT OF FUTURE **WAVE** TECHNOLOGIES" (WAVE is bold)
- **Phone**: +917045864882 (note: different from current +91 7045868482)
- **Divider**: Single orange/red line below the wave header
- **Footer contacts**: Phone, website (https://futurewave.in), email (sales@futurewave.in) with icons

## Files Changed

| File | Change |
|------|--------|
| `src/lib/reportPdf.ts` | Update header/footer HTML builders and CSS to match official letterhead with wave graphics, proper branding text, and contact details |

## Technical Notes

- The wave graphics will be embedded as base64 data URIs (same approach as the existing logo) to ensure they render in print-to-PDF workflows without external dependencies
- All existing consumers (`ReportShareButtons`, `buildLetterheadHtml`, `printReport`, `WardEmergencyCard`, `WardRefillOrder`, `GuardianReports`) automatically pick up the change since they all call the shared functions

