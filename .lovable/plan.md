## Multi-page bill upload for Hospital Bill Analyzer

Many hospital bills span multiple pages and users photograph each page separately. Today the analyzer only accepts one image / PDF / DOCX. This change lets users select multiple photos (or a mix of photos) at once and analyzes them together as one bill.

### What the user sees

- The upload area becomes "Tap to upload bill pages or take photos" and accepts multiple images.
- After picking, a thumbnail strip shows all selected pages (numbered Page 1, 2, 3…) with a small ✕ on each to remove individual pages, plus an "Add more" button to append more photos.
- A single "Analyze Bill" button audits all pages together as one bill.
- PDF / DOCX uploads stay single-file (multi-page PDFs are already handled internally page-by-page). Only image uploads support batching.
- File limit: up to **8 pages**, each max 10 MB, combined max ~25 MB after compression.

### Where it lives

- `src/components/health-tools/HospitalBillAnalyzer.tsx` only. No other components or pages change.

### Frontend changes

- Replace single `imagePreview` / `imageBase64` / `originalFile` state with arrays:
  - `pages: { id: string; file: File; previewUrl: string; base64: string }[]`
- `<input type="file" multiple accept="image/*">` for the batch image picker. Keep a separate path for PDF/DOCX (non-multiple) so document extraction logic is untouched.
- New page strip UI: horizontally scrollable row of numbered thumbnails with remove buttons + "Add more pages" tile.
- Light client-side downscale of each image (max 1600 px on longest side, JPEG quality 0.8) via canvas before base64 — keeps payload under edge function limits.
- "Analyze Bill" enabled when `pages.length >= 1` OR text/doc is present.
- Save-to-Vault: upload each page to storage (`{user_id}/{ts}-page-{n}.jpg`); store the first page URL in `medical_records.file_url` and append a comma-separated list of all page paths in the description footer so the vault still works without DB changes.

### Backend changes

`supabase/functions/health-tools/index.ts`

- Vision dispatch currently checks `payload.image` (single string). Extend it to also accept `payload.images` (string array).
- When `images` array present:
  - Build a multi-image user message:
    ```
    content: [
      { type: "text", text: visionPrompt + "\n\nThe bill spans multiple pages provided in order." },
      { type: "image_url", image_url: { url: images[0] } },
      { type: "image_url", image_url: { url: images[1] } },
      ...
    ]
    ```
  - Cap at 8 images server-side; reject with 400 if exceeded.
- Bump model for multi-page bill analysis to `google/gemini-2.5-pro` (better at reasoning across multiple tabular images). Single-image keeps current `gemini-2.5-flash`.
- Prompt addendum for `hospital_bill_analysis` when multiple images: instruct AI to treat all pages as one bill, sum totals across pages, and de-duplicate items already counted on earlier pages.

### Out of scope

- No camera-capture-with-crop UI (use native multi-select on mobile).
- No automatic page-order detection (user controls order via add/remove).
- No PDF multi-file merging — single PDF only (already multi-page internally).
- No changes to other health tools.

### Effort

One file edit on the frontend (~120 lines added/changed), ~25 lines in the edge function. No DB migration, no new dependencies, no new secrets.