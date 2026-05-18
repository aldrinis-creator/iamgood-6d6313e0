## Investigation findings

The guardian UI and RLS are not the main blocker. I found a concrete data mismatch:

- Slot files exist in private storage under the ward folder, e.g. `.../slots/aadhaar-...pdf`, `.../slots/pan-...pdf`, `.../slots/id_photo-...jpg`.
- But the matching `medical_records` rows were never created for those storage files.
- The Guardian Admission Kit only reads `medical_records`, so it shows nothing even though uploads exist in storage.
- This points to the upload flow uploading the file successfully, then failing or skipping the database insert/update without recovery.

## Fix plan

1. **Make Hospital Kit upload atomic and recoverable**
   - In `IdInsuranceSection.tsx`, after storage upload, verify the `medical_records` insert/update result.
   - If the database write fails, remove the newly uploaded storage file and show a clear error instead of leaving an orphaned file.
   - Close the capture dialog only after the database row is successfully saved.

2. **Recover existing orphaned slot uploads automatically**
   - Add an Admission Kit recovery backend function that runs with secure server permissions.
   - It will scan the ward’s storage folder under `medical-documents/{wardUserId}/slots/`.
   - For each latest slot file, it will create or repair the matching `medical_records` row with:
     - `record_slot`
     - `record_type`
     - `title`
     - `file_url`
     - `file_name`
     - `user_id`
   - It will only operate for the signed-in ward, or for an accepted guardian of that ward.

3. **Call recovery from both sides before showing empty data**
   - In `IdInsuranceSection.tsx`, call recovery before resolving the ward’s own Hospital Kit records.
   - In `HospitalVisitTab.tsx` and `HospitalKitCard.tsx`, call recovery for the selected ward before counting/displaying records.
   - This means the existing uploaded Aadhaar/PAN/Photo files should appear without asking the ward to re-upload.

4. **Harden guardian visibility and preview**
   - Keep current guardian RLS and storage policies intact.
   - Preserve the existing realtime filtered subscriptions.
   - Add error handling/toasts if the guardian fetch fails instead of silently rendering empty.

5. **Verify with live data**
   - Confirm `medical_records` rows are created for the orphaned slot files.
   - Confirm the guardian Admission Kit count updates from `0/5` to the recovered count.
   - Confirm preview/download uses the recovered `file_url` paths.

## Files to change

- `src/components/profile/IdInsuranceSection.tsx`
- `src/components/guardian/HospitalVisitTab.tsx`
- `src/components/guardian/HospitalKitCard.tsx`
- New backend function under `supabase/functions/recover-admission-kit/`

## Out of scope

- No new document categories.
- No changes to the PDF builder design.
- No change to guardian nomination rules.