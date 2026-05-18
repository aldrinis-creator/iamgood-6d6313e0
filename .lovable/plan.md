## Problem

**1. Multi-image / mixed uploads don't get analyzed**
In `DocumentAnalyzer.analyze()`, the payload-building logic is:
```ts
if (extractedDocText) {
  payload = "...text only..."   // ← images dropped
} else if (pages.length > 0) {
  payload = { images: [...] }
}
```
So the moment one PDF/DOCX has selectable text, every JPG/PNG the user added is silently discarded. Also, when only images are sent, errors (body size, 60 s timeout, gateway 4xx) surface as a generic "Analysis failed" toast, so the user thinks nothing happened.

**2. PDF "space constraint"**
`MAX_FILE_SIZE = 10 MB` per file → larger PDFs trigger `"<name> is too large"`. Even within the limit, only the first 10 000 chars are sent for analysis, and a text-less PDF only ever renders **page 1** as an image (`renderPDFPageToImage(selected)` with no page loop).

## Fix

### 1. `src/components/health-tools/DocumentAnalyzer.tsx`
- **Merge text + images in one request.** New payload shape when both are present:
  ```ts
  payload = {
    images: pages.map(p => p.base64),
    category: selectedCat || "General",
    text: extractedDocText?.slice(0, MAX_TEXT_LENGTH),
  }
  ```
  When only text → string payload (unchanged). When only images → images payload (unchanged).
- **Bump per-file limits**: keep images at 10 MB, raise PDFs/DOCX to **25 MB**.
- **Render up to 4 pages** of text-less PDFs (instead of page 1 only) via a small loop over `renderPDFPageToImage(file, n)`, respecting the `MAX_PAGES = 8` cap.
- **More aggressive downscale** when many pages are queued: drop `MAX_DIMENSION` to **1200** and JPEG quality to **0.72** once `pages.length >= 3` to keep total body under the Edge Function limit.
- **Surface real errors**: replace generic `"Analysis failed"` with `err?.message || data?.error || "Analysis failed"`, and log the response payload to console for debugging.
- **Raise client timeout** from 60 s → **90 s** (Gemini 2.5 Pro multi-image is slower).

### 2. `supabase/functions/health-tools/index.ts`
- In the `document_analysis` vision branch, when `payload.text` is present, prepend it to the vision prompt so the model sees the extracted PDF/DOCX text *and* the image pages together.
- Raise `MAX_PAYLOAD_CHARS` for `document_analysis` from 20 000 → **40 000** (text-only path).

### 3. `src/lib/documentExtractor.ts`
- Add an optional `maxPages` arg to `extractTextFromPDF` (default 20, up from 10) so larger PDFs contribute more text before truncation.

## Out of scope
- Async/background job processing pattern (the existing 90 s timeout + reduced payload is enough for the documented use case; can revisit if users still hit the wall).
- Hospital Kit, Pill Identifier, and other health-tools that already work.
- Storage/upload-to-Vault path (unchanged).
