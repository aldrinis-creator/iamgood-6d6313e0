

## Fix: PDF Files Not Being Read in Document Analyzer

### Root Cause

The PDF.js worker is loaded from a CDN URL (`cdnjs.cloudflare.com/ajax/libs/pdf.js/5.6.205/pdf.worker.min.mjs`), but **version 5.6.205 does not exist on that CDN** (returns 404). This causes `getDocument()` to hang indefinitely — the "loop" users experience.

### Fix

Change the worker source from a CDN URL to a direct import of the local worker file bundled with the `pdfjs-dist` package. Vite will handle serving it correctly.

### File to modify

**`src/lib/documentExtractor.ts`** — Replace the CDN worker URL (line 4) with a local import:

```typescript
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

This uses Vite's `?url` import suffix to get a proper URL to the local worker file, eliminating the CDN dependency entirely. No other files need changes.

