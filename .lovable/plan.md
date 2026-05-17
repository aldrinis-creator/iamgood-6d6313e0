# Vault Attachment: Crop + Size Limits

Add an in-app image cropper and enforced size limits to `VaultAttachmentField` (used by every Medical Vault entry: IDs, bank, insurance, etc.).

## Limits (enforced before encryption/upload)

- **Images**: max **5 MB** raw input, auto-compressed after crop to **≤ 1.5 MB** JPEG (quality 0.85, max 2000px long edge).
- **PDFs**: max **10 MB**, no cropping (passed through as-is).
- Reject anything else with a toast.

Limits exposed as constants at top of `VaultAttachmentField.tsx` so they're easy to tune.

## Cropping UX

When the user picks/captures an **image** (camera or upload):
1. Open a `Dialog` cropper before accepting the file.
2. Use **`react-easy-crop`** (lightweight, touch-friendly, ~15kb) — already common in Lovable projects.
3. Controls:
   - Pan + pinch/drag to position
   - Zoom slider (1×–3×)
   - Aspect ratio toggle: **Free / 1:1 / 4:3 / ID card (1.586:1)** — defaults to **Free** so receipts/long IDs aren't forced to square.
   - Rotate 90° button (handy for phone-camera ID shots).
4. Buttons: **Cancel** (discard) / **Use original** (skip crop) / **Crop & use**.
5. On confirm: render to canvas → export as JPEG at quality 0.85, downscale so long edge ≤ 2000px → produce a `File` → hand to parent via existing `onSelectFile`.

PDFs skip the cropper entirely and go straight to `onSelectFile`.

## Size enforcement

- Pre-crop check: reject raw input >5 MB (image) / >10 MB (PDF).
- Post-crop check: if compressed result still >1.5 MB, re-encode at quality 0.7; if still over, warn and reject.
- Show human-readable error toasts (e.g. "Image too large (7.2 MB). Max 5 MB.").

## Files

- **Modify** `src/components/vault/VaultAttachmentField.tsx`
  - Add size constants, cropper dialog, canvas export helper.
  - Wire camera/upload inputs through cropper for images, straight through for PDFs.
- **Add dep**: `react-easy-crop`.
- No DB / storage / encryption changes — parent's encrypt + upload flow is unchanged; it just receives a smaller, cropped `File`.

## Out of scope

- Cropping for the separate Medical Records / Health Tools uploads (different components).
- Multi-page PDF editing.
- Server-side image processing.
