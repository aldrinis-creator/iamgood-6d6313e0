

## Fix Pop-up Blocked Error in Medical Vault

### Problem
The Medical Vault uses `window.open()` to display record details in a new browser tab. This is blocked by browsers and WebViews (especially in Capacitor apps), causing the "Pop-up blocked" error.

### Solution
Replace the popup window approach with an **in-page Dialog/Modal** that renders the record details, attachment preview, and action buttons directly inside the app.

### Implementation

**File: `src/pages/MedicalVault.tsx`**

1. Add new state variables:
   - `viewRecord: MedicalRecord | null` — the record being viewed
   - `viewSignedUrl: string` — signed URL for the attachment
   - `viewLoading: boolean` — loading state while fetching signed URL

2. Replace `openRecordViewWindow()` with a simpler function that sets state:
   - Sets `viewRecord = r`, `viewLoading = true`
   - Fetches signed URL if `r.file_url` exists
   - Sets `viewSignedUrl` and `viewLoading = false`

3. Add a new `<Dialog>` at the bottom of the JSX that renders when `viewRecord` is set:
   - Record details (title, type, date, doctor, hospital)
   - Description/notes section (pre-wrapped)
   - Attachment section: inline `<img>` for images, `<iframe>` for PDFs, download button for all files
   - Action buttons: Download, Share (WhatsApp/Email), Print (using `window.print()` on current page or a hidden iframe)

4. Remove `buildRecordViewHtml()` function and the `buildLetterheadHtml` import (if only used here — check first)

5. Keep print functionality by using a hidden iframe approach or `window.print()` scoped to dialog content

### Files to modify
- `src/pages/MedicalVault.tsx` — replace popup with in-page Dialog for record viewing

