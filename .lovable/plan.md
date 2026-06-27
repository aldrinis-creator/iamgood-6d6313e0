## Goal
Change the Ward's "Call Guardian" green button so that the **default tap action is a WhatsApp video call** to the primary guardian, with a secondary option to place a normal mobile (cellular) call.

## Behavior

**Primary tap (green band / nav icon):**
- Opens WhatsApp directly to the guardian's number and initiates a **video call**.
- Uses the WhatsApp deep link scheme:
  - Native (Capacitor): `whatsapp://call?phone=<digits>&video=true` opened via `window.open(..., "_system")`.
  - Web/PWA fallback: `https://wa.me/<digits>?video=1` (WhatsApp's universal link; opens the app if installed).
- Fire-and-forget activity log + `notify-guardian-call` push (unchanged).

**Secondary option — "Mobile call":**
- Accessed via:
  1. A small **"Mobile call"** chip/link directly under the green band (always visible, one tap away — no long-press needed), and
  2. The existing long-press / multi-guardian dropdown, which will list each guardian with **two icons**: a green WhatsApp-video icon (default) and a phone icon (mobile call).
- Mobile call uses the current `tel:` flow already in `CallGuardianButton.tsx`.

**Nav-icon variant** (bottom bar):
- Tap → WhatsApp video call.
- Long-press → menu with "WhatsApp video" + "Mobile call" for the primary guardian (and per-guardian rows when multiple guardians exist).

**Labels:**
- Green band text changes from "Call {Name}" → "Video call {Name}" with a small "via WhatsApp · Mobile call" sub-label.
- Nav icon label changes from "Call" → "Video".

## Files to change
- `src/components/CallGuardianButton.tsx` — only file touched.
  - Add `placeWhatsAppVideo(g)` helper using the deep links above.
  - Rename existing `placeCall` → `placeMobileCall` (unchanged behavior).
  - Default `onClick` → `placeWhatsAppVideo`.
  - Add visible "Mobile call" secondary action.
  - Update dropdown rows to expose both actions per guardian.
  - Update visible labels/icons (use `Video` icon from lucide-react for primary, keep `Phone` for mobile).

## Out of scope
- No backend, edge function, settings, or DB changes.
- Guardian-side `IncomingCallOverlay` is unchanged (still triggered for in-app ringer).
- iOS/Android system-level confirmation sheets cannot be suppressed; this is a limitation of WhatsApp/OS, not the app.

## Notes / caveats
- WhatsApp does not publish an official "force video call" URL; `whatsapp://call?phone=...&video=true` works on current WhatsApp Android/iOS builds and falls back to opening the chat if the param is ignored. If WhatsApp ignores `video=true` on a given device, the user will land in the chat and can tap the video icon — we'll surface a one-line hint under the button: *"Then tap 📹 in WhatsApp"*.
- Guardian's phone number must already be in international format; existing `normalizePhone` handles this.
