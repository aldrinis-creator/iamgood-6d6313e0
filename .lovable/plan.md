## Goal

Add the ability to attach a photo or scanned file (camera capture or upload) to every entry in the Medical Vault (Identity Docs, Email, Bank, Insurance, Will). The attachment must respect the vault's existing zero-knowledge promise: the file is AES-256-GCM encrypted client-side with the user's vault PIN before upload, and only decrypted in-browser on reveal.

## What you'll see

In every "Add / Edit" dialog inside the unlocked vault (`VaultCategorisedSection`), below the existing fields and above Notes:

- A **Photo / Scan** section with two buttons: **Take photo** (opens device camera) and **Upload file** (image or PDF).
- Selected file shows filename + size and a "Remove" link.
- If an attachment already exists for the entry, a thumbnail/file chip is shown with **View** (decrypts to a temporary blob URL inside a dialog), **Replace**, and **Remove** actions.
- The entry preview gets a small "📎 Attachment" badge when one is present.
- Works for all five categories (identity, email, bank, insurance, will) using the same shared sub-component.

## Technical approach

1. **Storage bucket** — new private bucket `vault-attachments` with RLS scoped to `auth.uid()::text = (storage.foldername(name))[1]`. Files are stored as encrypted bytes under `<user_id>/<doc_id>.bin`.

2. **Encryption helpers** — extend `src/lib/encryption.ts` with `encryptBytes(bytes, pin)` and `decryptBytes(ciphertextB64, iv, salt, pin)` that mirror the existing text helpers but operate on `ArrayBuffer`. The text helpers stay unchanged.

3. **Entry shape** — add an optional `attachment` field to every entry type in `src/lib/vaultCategories.ts`:
   ```ts
   attachment?: {
     path: string;          // storage path
     file_name: string;     // original name
     mime_type: string;
     iv: string;            // base64
     salt: string;          // base64
     size: number;          // plaintext bytes
   }
   ```
   Because the entry JSON itself is encrypted, the IV/salt of the file live inside the encrypted blob — even storage admins cannot decrypt the file without the PIN.

4. **UI component** — new `VaultAttachmentField` used inside `EntryForm` for all categories. Handles file picker (`accept="image/*,.pdf"`), camera capture (`capture="environment"`), preview, replace, remove, and a "View attachment" dialog that fetches the encrypted blob, decrypts, and renders an `<img>` or `<iframe>` from an object URL (revoked on close).

5. **Save flow** — `saveEntry` in `VaultCategorisedSection`:
   - If a new file was selected: encrypt bytes with the vault PIN, upload to `vault-attachments/<userId>/<docId-or-temp>.bin`, then write the metadata into `draft.attachment` before encrypting the JSON.
   - If the user removed an existing attachment: delete from storage and clear `draft.attachment`.
   - On entry delete: also remove the file from storage.

6. **Backwards compatibility** — entries without `attachment` work exactly as today; no migration of existing rows needed.

## Files to add / change

- `supabase/migrations/<ts>_vault_attachments_bucket.sql` — create private bucket + storage RLS policies.
- `src/lib/encryption.ts` — add `encryptBytes` / `decryptBytes`.
- `src/lib/vaultCategories.ts` — add `VaultAttachment` type, extend each entry interface.
- `src/components/vault/VaultAttachmentField.tsx` — new shared upload/camera/preview component.
- `src/components/vault/VaultCategorisedSection.tsx` — wire attachment field into `EntryForm`, handle upload/delete in `saveEntry` / `removeEntry`, show 📎 badge in `EntryPreview`.

## Out of scope

- No changes to the existing Medical Records ("Records" tab) flow — it already supports uploads.
- No changes to the nominee Vault-claim viewer (separate flow).
- No bulk re-encryption of existing entries.