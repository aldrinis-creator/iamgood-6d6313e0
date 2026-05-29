## Goal
Make the Hospital Bill Analyzer reliably handle 1–8 page uploads without hitting Supabase's request-body limit, and use a currently-supported Gemini model.

## Changes

### 1. Send images via Storage URLs instead of inline base64 (client)
File: `src/components/health-tools/HospitalBillAnalyzer.tsx`

- Before invoking the edge function, upload each page's JPEG blob to a temp path in the existing `medical-documents` bucket (`{user.id}/_tmp/bill-{ts}-{i}.jpg`).
- Create a 10-minute signed URL for each upload.
- Send `{ images: signedUrls[] }` (URLs, not data URLs) — request body drops from ~6 MB to a few KB.
- After analysis completes (success or fail), best-effort delete the temp objects.
- Reduce `MAX_DIMENSION` from 1600 → 1280 and JPEG quality 0.8 → 0.75 as a safety net for the storage upload itself.

### 2. Use a supported model + accept URL images (edge function)
File: `supabase/functions/health-tools/index.ts`

- Replace `google/gemini-1.5-pro` and `google/gemini-1.5-flash` with `google/gemini-2.5-pro` (multi-image / bill analysis) and `google/gemini-2.5-flash` (single-image simple tasks) across `taskConfig` and the vision-mode branch.
- The existing `image_url: { url }` shape already works for both data URLs and https URLs, so no schema change — the gateway will fetch the signed URLs directly.
- Add `console.log` of `type`, image count, and payload kind at the top of the handler so future failures show up in `edge_function_logs`.

### 3. Surface real errors (client)
File: `src/components/health-tools/HospitalBillAnalyzer.tsx`

- On `supabase.functions.invoke` error, also log `error.context?.status`, `error.context?.statusText`, and the response text (when readable) so the next failure isn't opaque.

## Out of scope
- No DB / RLS changes — `medical-documents` bucket already has authenticated upload + signed-URL read.
- No UI redesign — only the upload/invoke pipeline and the model id change.
- Other health-tools features keep working because the model swap is 1.5-pro→2.5-pro / 1.5-flash→2.5-flash (drop-in compatible for vision + text).
