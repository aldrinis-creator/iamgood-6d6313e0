

## Fix: Original Documents from Document Analyzer Cannot Be Opened in Medical Vault

### Root Cause

The `saveToVault()` function in `DocumentAnalyzer.tsx` has two bugs:

1. **PDFs/DOCXs with extractable text are never uploaded**: When a PDF has text content, `imageBase64` and `imagePreview` are both `null` (only `extractedDocText` is set). The upload block checks `if (imageBase64 || imagePreview)` and skips entirely, so `file_url` is saved as `null`. The attachment appears in the vault (because `file_name` is set) but clicking Download does nothing — there is no file in storage.

2. **Image uploads use raw `Uint8Array` without `Blob` wrapping**: The content type is guessed from the base64 string (`image/png` vs `image/jpg`) rather than from the actual file. This can cause mismatched content types, making downloaded files unreadable.

### Fix — File: `src/components/health-tools/DocumentAnalyzer.tsx`

Rewrite the upload section of `saveToVault()` to:

1. **Keep a reference to the original `File` object** — add a new state `originalFile` that stores the raw `File` from the file input, preserved through extraction.

2. **Upload the original file when available** — use the actual `File` object (PDF, DOCX, or image) directly with `supabase.storage.upload()`, which correctly handles content type. This ensures the real document (not a rendered image) is stored.

3. **Fall back to base64 upload for camera captures** — when the user captures via camera (no `File` object), convert base64 to a proper `Blob` with the correct MIME type before uploading.

### Detailed changes

```typescript
// Add state to preserve original file
const [originalFile, setOriginalFile] = useState<File | null>(null);

// In handleFileSelect — store the original file for all types
// For documents (PDF/DOCX):
setOriginalFile(selected);  // add this line

// For images:
setOriginalFile(selected);  // add this line

// In clearFile:
setOriginalFile(null);

// In saveToVault — rewrite upload block:
if (originalFile) {
  // Upload the actual original file (PDF, DOCX, or image)
  const ext = originalFile.name.split(".").pop() || "bin";
  fileName = fileName || originalFile.name;
  const storagePath = `${user.id}/${Date.now()}-${fileName}`;
  const { error: uploadErr } = await supabase.storage
    .from("medical-documents")
    .upload(storagePath, originalFile, { contentType: originalFile.type });
  if (!uploadErr) fileUrl = storagePath;
} else if (imageBase64 || imagePreview) {
  // Camera capture fallback — convert base64 to Blob
  const base64Data = (imageBase64 || imagePreview)!;
  const mimeMatch = base64Data.match(/^data:(.*?);/);
  const mime = mimeMatch?.[1] || "image/jpeg";
  const base64Str = base64Data.split(",")[1];
  const byteArray = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
  const blob = new Blob([byteArray], { type: mime });
  const ext = mime.includes("png") ? "png" : "jpg";
  fileName = fileName || `doc-scan-${Date.now()}.${ext}`;
  const storagePath = `${user.id}/${Date.now()}-${fileName}`;
  const { error: uploadErr } = await supabase.storage
    .from("medical-documents")
    .upload(storagePath, blob, { contentType: mime });
  if (!uploadErr) fileUrl = storagePath;
}
```

Also reset `originalFile` in the Back button's `onClick` handler alongside the other state resets.

### Files to modify
- `src/components/health-tools/DocumentAnalyzer.tsx` — add `originalFile` state, store it on file select, use it in `saveToVault()`

