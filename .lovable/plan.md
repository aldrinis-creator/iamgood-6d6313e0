

# PWA Install Prompt + QR Code on Emergency Card + Download as PDF on Ward Card

## Three Features

### 1. PWA Install Prompt
The app already has `vite-plugin-pwa` configured with manifest, icons, and service worker. What's missing is a user-facing install prompt.

**New file: `src/hooks/usePwaInstall.ts`**
- Listen for `beforeinstallprompt` event, store the deferred prompt
- Expose `canInstall`, `installApp()`, and `isInstalled` (check `display-mode: standalone`)

**New file: `src/components/PwaInstallBanner.tsx`**
- Dismissible banner shown at top of the app when `canInstall` is true
- "Install Check-iN" button that calls `installApp()`
- Auto-hides if already installed or dismissed (persist in localStorage)

**Edit: `src/components/AppLayout.tsx`**
- Render `<PwaInstallBanner />` above `<AppHeader />`

**New page: `src/pages/Install.tsx`**
- Dedicated `/install` route with instructions for iOS (Share → Add to Home Screen) and Android (auto-prompt)
- Renders the install button when available

**Edit: `src/App.tsx`**
- Add `/install` route

### 2. QR Code on SOS Emergency Health Card
**Edit: `src/components/SOSDialog.tsx`**
- After SOS is sent, fetch the user's `emergency_share_tokens` token
- Generate a QR code using a lightweight inline SVG QR generator (use `qrcode` npm package or a Google Charts QR API URL as `<img>`)
- Display QR below the Emergency Health Card linking to `/e/{token}` (the public emergency profile page)
- Also include QR in the print/download HTML output
- Install `qrcode.react` package for rendering QR codes

### 3. Download as PDF on WardEmergencyCard
**Edit: `src/components/WardEmergencyCard.tsx`**
- Add a "Save" button alongside existing Share/Print buttons
- Reuse the existing `handlePrint` HTML template to create a downloadable `.html` file via Blob + anchor click (same pattern as SOSDialog's `handleDownloadPdf`)
- Add `Download` icon from lucide

## Technical Details

- **QR library**: `qrcode.react` — renders SVG QR codes inline, no external API dependency
- **PWA install**: Uses standard `beforeinstallprompt` Web API; iOS doesn't fire this event so the Install page shows manual instructions
- **Download**: Uses Blob + `URL.createObjectURL` pattern already established in SOSDialog
- No database changes needed

### Files to create
- `src/hooks/usePwaInstall.ts`
- `src/components/PwaInstallBanner.tsx`
- `src/pages/Install.tsx`

### Files to edit
- `src/components/AppLayout.tsx` — add install banner
- `src/App.tsx` — add /install route
- `src/components/SOSDialog.tsx` — add QR code section + fetch token
- `src/components/WardEmergencyCard.tsx` — add Save/Download button
- `package.json` — add `qrcode.react` dependency

