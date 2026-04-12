

## Add PDF and Word File Support to Health Tools

### What changes

Both **Document Analyzer** and **Prescription Scanner** currently accept only images or plain text. This plan adds PDF (.pdf) and Word (.docx) file acceptance. Since the AI models already handle text input well and Gemini supports image-based PDFs, the approach is:

1. **Client-side PDF/DOCX text extraction** using `pdfjs-dist` (PDF) and `mammoth` (DOCX) — extract text on the browser, send as text payload to the existing edge function. No server changes needed.
2. For image-heavy PDFs (scanned documents), convert the first few pages to images client-side via `pdfjs-dist` canvas rendering, then send as image payload for vision analysis.

### Files to modify

| File | Change |
|------|--------|
| `package.json` | Add `pdfjs-dist` and `mammoth` dependencies |
| `src/lib/documentExtractor.ts` | **New** — shared utility with `extractTextFromPDF(file)`, `extractTextFromDOCX(file)`, `renderPDFPageToImage(file, pageNum)` |
| `src/components/health-tools/DocumentAnalyzer.tsx` | Accept `.pdf, .docx` in photo mode file input. When a PDF/DOCX is selected, extract text (or render to image for scanned PDFs). Update accept strings, validation, and UI labels. |
| `src/components/medications/PrescriptionScanner.tsx` | Same — accept PDF/DOCX in photo mode. Extract text or render first page as image. Update accept strings and labels. |

### Technical approach

**`src/lib/documentExtractor.ts`**:
```typescript
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Extract text from PDF (first 10 pages)
export async function extractTextFromPDF(file: File): Promise<{ text: string; hasText: boolean }> { ... }

// Render PDF page to base64 image (for scanned/image PDFs)
export async function renderPDFPageToImage(file: File, page = 1): Promise<string> { ... }

// Extract text from DOCX
export async function extractTextFromDOCX(file: File): Promise<string> { ... }
```

**DocumentAnalyzer changes**:
- Photo mode `accept` → `"image/*,.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"`
- When file selected: if PDF/DOCX, extract text. If text is minimal (scanned PDF), fall back to rendering page 1 as image.
- Show file name + icon instead of image preview for document files.
- Label changes: "Photo / Upload" → "Upload File", hint text → "JPG, PNG, PDF, DOCX — max 10MB"

**PrescriptionScanner changes**:
- Same accept string update
- Same extraction logic
- For prescriptions, image mode is preferred (render PDF page to image for vision model)

### UI updates

- File type icons: show a PDF/Word icon in the preview area instead of an image thumbnail
- Increase `MAX_IMAGE_SIZE` to 10MB for documents (PDFs can be larger than photos)
- Add a small "Extracting text…" spinner while parsing PDF/DOCX client-side

### No edge function changes needed

The existing `health-tools` function already handles both `{ image: base64 }` and text string payloads. Client-side extraction feeds into these existing paths.

