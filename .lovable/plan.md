

# Pixel-Perfect Letterhead from Official PDF

## Problem
The current CSS-recreated letterhead doesn't match the uploaded PDF design — the FW logo, wave swooshes, and styling details differ from the official version.

## Approach
Extract the top header area (~120px) and bottom footer area (~180px) from the uploaded PDF as cropped images, convert to base64 data URIs, and embed them directly in the letterhead HTML. This guarantees pixel-perfect match with zero CSS approximation.

## Steps

1. **Extract header/footer images from the PDF** — use Python (`pdf2image` + `Pillow`) to render the PDF page, crop the top ~15% as the header image and bottom ~25% as the footer image, then convert both to optimized base64 JPEG strings.

2. **Update `src/lib/reportPdf.ts`** — replace `buildLetterheadHeader()` to render a single `<img>` tag with the base64 header image (full width). Replace `buildLetterheadFooter()` similarly with the footer image. Simplify `getLetterheadCss()` by removing all the hand-crafted header/footer CSS classes (`.fw-icon`, `.fw-f`, `.footer-wave`, etc.) and replacing with simple full-width image styling.

3. **Keep everything else unchanged** — title block, content area, markdown-to-HTML, utility styles, action bar, QR section, and all export functions remain as-is.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/reportPdf.ts` | Replace header/footer builders with embedded base64 images from the official PDF; simplify CSS |

## Technical Notes
- Base64 images ensure the letterhead renders in print-to-PDF without external dependencies
- All consumers (`ReportShareButtons`, `buildLetterheadHtml`, `WardEmergencyCard`, `WardRefillOrder`, `GuardianReports`, `SOSDialog`, `MedicalVault`) automatically pick up the change
- Header image: full-width, contains logo + "Check-iN" + tagline + gradient line
- Footer image: full-width, contains FW logo + contact info + wave swooshes

