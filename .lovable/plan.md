# Safe Zone WhatsApp Alert for Guardians

When a user leaves a safe zone, notify all their accepted guardians via WhatsApp using the MSG91 `safe_zone` template.

## Variable mapping
- `body_1` → Ward full name
- `body_2` → Safe zone name
- `body_3` → Exit time in IST (e.g., "17 Jun 2026, 7:42 PM IST")

## Changes

### 1. New edge function: `supabase/functions/msg91-whatsapp-safezone/index.ts`
- Public CORS, POST only, validates input with Zod.
- Input: `{ wardName: string, zoneName: string, occurredAt: string (ISO), phones: string[] }`.
- Normalizes phones to E.164 digits (strip `+`, ensure country code `91` prefix for 10-digit Indian numbers).
- Formats `occurredAt` to IST string using `Asia/Kolkata`.
- POSTs to `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/` with:
  - `integrated_number: "917045868482"`
  - `template.name: "safe_zone"`, `language: { code: "en", policy: "deterministic" }`
  - `namespace: "e1e205a8_3b76_4c20_bde4_9f124a35c8c4"`
  - `to_and_components[0].to`: deduped phone list
  - `components.body_1/2/3` mapped as above
- Uses existing `MSG91_AUTH_KEY` secret. Returns MSG91 response status + body. Logs failures (no throw to caller).

### 2. Wire into `src/hooks/useLocationSync.ts`
- In the existing safe-zone exit branch (right after `insert_notifications_deduped` RPC fires for guardians), collect non-empty `guardian_phone` values from the same accepted-guardian query already in scope.
- Fire `supabase.functions.invoke("msg91-whatsapp-safezone", { body: { wardName, zoneName, occurredAt, phones } })` inside try/catch — never blocks the rest of the exit flow.
- Respects existing `wasInsideRef` guard and 30-minute guardian alert cooldown, so each exit event triggers exactly one WhatsApp blast.

### 3. No DB migration, no frontend UI changes
Guardian phone numbers already live in `guardians.guardian_phone`. No new secrets needed (reuse `MSG91_AUTH_KEY`).

## Technical notes
- `verify_jwt = false` is the default; the function only ever runs server-side (invoked from the authenticated client hook), and MSG91 auth key never leaves the edge.
- All responses include `corsHeaders`.
- IST formatting via `Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ... })`.
