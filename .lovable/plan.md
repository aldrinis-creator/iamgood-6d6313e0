

## Fix Vault Attachment — Show Real Downloadable File Instead of Plain Text

### Problem
When a Document Analyzer result is saved to Medical Vault, the "Attachment" section in the view window displays only the file name as plain text (e.g., "image.jpg"). There is no way to view or download the actual attached file.

### Root Cause
In `src/pages/MedicalVault.tsx`, the `buildRecordViewHtml` function (line 287) renders the attachment as:
```html
<p>image.jpg</p>
```
It never fetches the file URL from storage or provides a download/view link.

### Fix

**File: `src/pages/MedicalVault.tsx`**

1. Make `openRecordViewWindow` async — before building HTML, fetch a signed URL (1-hour expiry) from the `medical-documents` storage bucket using `supabase.storage.from("medical-documents").createSignedUrl(r.file_url, 3600)`.

2. Pass the signed URL into `buildRecordViewHtml` as an optional parameter.

3. Update the attachment section in `buildRecordViewHtml` to:
   - For image files (jpg/jpeg/png/webp): embed an `<img>` tag showing the image inline, plus a download link
   - For PDF files: embed a download/open link
   - For all files: add a "Download" button/link using the signed URL
   - Keep the file name displayed as a label

4. The attachment section HTML will change from plain text to something like:
```html
<div class="section">
  <div class="section-title">📎 Attachment</div>
  <div class="section-body">
    <p><strong>image.jpg</strong></p>
    <img src="SIGNED_URL" style="max-width:100%;border-radius:8px;margin:8px 0" />
    <a href="SIGNED_URL" download="image.jpg" target="_blank" 
       style="display:inline-block;margin-top:8px;padding:6px 16px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none">
      ⬇ Download File
    </a>
  </div>
</div>
```

### Files to modify
- `src/pages/MedicalVault.tsx` — update `buildRecordViewHtml` signature and attachment rendering; make `openRecordViewWindow` async to fetch signed URL

