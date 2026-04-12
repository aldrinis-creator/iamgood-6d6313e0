

## Fix: PDF Analysis Looping in Document Analyzer

### Root Cause

Two likely failure points cause the "loop" (infinite loading with no response):

1. **PDF.js worker loading failure**: The worker is loaded from a CDN URL tied to `pdfjsLib.version`. If there's a version mismatch or the CDN is slow/blocked, `getDocument()` hangs indefinitely — the extraction never completes and no error is thrown.

2. **No timeout on extraction or edge function call**: Neither the PDF text extraction nor the `supabase.functions.invoke()` call has a timeout. If either hangs, the loading spinner runs forever.

3. **Oversized image payload**: For scanned PDFs, `renderPDFPageToImage` uses `scale=2`, producing a very large base64 string that can cause the edge function to time out.

### Fix

**File: `src/lib/documentExtractor.ts`**
- Add a timeout wrapper around `getDocument()` (e.g. 15 seconds) so extraction fails fast with a clear error instead of hanging
- Reduce image render scale from 2 to 1.5 and cap JPEG quality at 0.7 to reduce payload size
- Add error handling for worker load failures

**File: `src/components/health-tools/DocumentAnalyzer.tsx`**
- Add a timeout (60 seconds) around the `supabase.functions.invoke` call using `AbortController` or a Promise.race pattern
- On timeout, show a clear error toast ("Analysis timed out. Try a smaller file or paste the text manually.") and exit loading state

### Implementation details

```typescript
// documentExtractor.ts — wrap getDocument with timeout
function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

// In extractTextFromPDF:
const pdf = await withTimeout(
  pdfjsLib.getDocument({ data: arrayBuffer }).promise,
  15000,
  "PDF loading timed out"
);

// In renderPDFPageToImage: reduce scale
const scale = 1.5;
// ...
return canvas.toDataURL("image/jpeg", 0.7);
```

```typescript
// DocumentAnalyzer.tsx — timeout on edge function call
const analyzeWithTimeout = Promise.race([
  supabase.functions.invoke("health-tools", { body: { type: "document_analysis", payload } }),
  new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 60000)),
]);
```

### Files to modify

| File | Change |
|------|--------|
| `src/lib/documentExtractor.ts` | Add timeout wrapper to `getDocument`, reduce image scale/quality |
| `src/components/health-tools/DocumentAnalyzer.tsx` | Add 60s timeout on edge function call, show error toast on timeout |

### No database or edge function changes needed

