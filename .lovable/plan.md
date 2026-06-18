# WhatsApp Safe Zone Return Alert

Mirror the existing `safe_zone` exit flow for re-entry, using template `safe_zone_return`.

## 1. New edge function `supabase/functions/msg91-whatsapp-safezone-return/index.ts`
- Public CORS, POST only, Zod-validated input: `{ wardName, zoneName, occurredAt (ISO), phones[] }`.
- Normalize phones to E.164; format `occurredAt` to IST via `Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata" })`.
- POST to `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/` with:
  - `integrated_number: "917045868482"`
  - `template.name: "safe_zone_return"`
  - `language: { code: "en_GB", policy: "deterministic" }`
  - `namespace: "e1e205a8_3b76_4c20_bde4_9f124a35c8c4"`
  - `to_and_components` body vars: `body_1` = ward name, `body_2` = zone name, `body_3` = return time IST
- Uses existing `MSG91_AUTH_KEY` secret. Best-effort; logs failures.

## 2. Wire into `src/hooks/useLocationSync.ts`
- In the safe-zone **re-entry** branch (where `wasInsideRef` flips false → true, mirroring the exit branch), after the existing notification insert, collect non-empty `guardian_phone` values from `filteredGuardians` and fire:
  ```ts
  supabase.functions.invoke("msg91-whatsapp-safezone-return", { body: { wardName, zoneName, occurredAt, phones } })
  ```
  in a try/catch. Respects the existing entry guard/cooldown so each return triggers exactly one WhatsApp blast.

## 3. No DB migration, no UI changes
- Guardian phones already on `guardians.guardian_phone`. No new secrets.

## Variable mapping (matches exit alert)
- `body_1` → Ward full name
- `body_2` → Safe zone name
- `body_3` → Return time formatted as IST (e.g. `7:42 PM IST`)
