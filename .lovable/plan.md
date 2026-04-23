

## Plan — Ambulance booking redesign + payment & guardian-notification advice

This redesigns the **Emergency Request** flow on both the User and Guardian apps to auto-fill everything, add a destination search, send via API with a clear MSG91/WhatsApp fallback, and bundle the user's profile + vitals. Two advisory answers at the end.

---

### Part A — UI changes (User and Guardian Ambulance flow)

File: `src/components/AmbulanceBooking.tsx` (single component used by both apps).

**1. Auto-detect location on mount**

- On open, the form immediately calls `navigator.geolocation.getCurrentPosition`. While resolving it shows "Locating you…" with a small spinner.
- On success: shows "📍 Detected: <reverse-geocoded address>" + lat/lng, with a small **Edit** (pencil) icon to override.
- On permission denied / failure: shows an inline warning with a **Use saved location** button (reads `user_settings.lastLocation` if present) and an **Enter manually** option (lat/lng or address text).
- Guardian mode keeps the existing behaviour of preferring `wardLocation` from props but uses the same auto-detect fallback if none.

**2. Patient Name auto-fills from `user_name`**

- User mode: pre-fills `profile.full_name` (from `useAuth().profile`). Editable but defaults filled.
- Guardian mode: pre-fills the ward's name (already done).

**3. Contact Number = user number + Primary Guardian number**

Replace the single `Contact Number` input with a two-row "Contacts on this request" section:

```
Contacts to be shared with ambulance:
  • You — +91 98xxx xxxxx          [Primary]
  • Jane (Daughter) — +91 99xxx xxxxx  [Primary Guardian]
  + Add another guardian   ▾ (dropdown of accepted guardians)
```

- Both numbers are sent to MSG91 / API. If no Primary Guardian exists, show an inline note: *"No Primary Guardian set — only your number will be shared."* with a link to `/profile` to set one.
- Guardian mode mirrors this: the ward's number + the guardian's own number.

**4. Destination search (MMJ-style)**

Add a new required field **Destination Hospital** above the action buttons. Reuses the exact `usePlaceAutocomplete({ origin: detectedLocation })` hook from `MapMyJourney.tsx` so users get the same 5-tier search (Google → New Places → Photon → Nominatim → fuzzy), India-biased and origin-biased:

```
🏥 Destination Hospital  *
[ Search hospital, clinic, or address ]   ▾ suggestions
   ↳ "Apollo Hospital, Bandra (4.2 km)"
   ↳ "Lilavati Hospital, Bandra West (5.1 km)"
```

- A "Use nearest hospital" quick chip calls the existing nearby-facilities endpoint and pre-fills the closest one.
- Selected destination is stored as `{ name, address, lat, lng }` and included in the outgoing payload.

**5. Profile + Health Vitals attached automatically**

The existing `fetchWardHealthCard()` is generalised into `buildHealthCardForUser(userId)` so both user mode and guardian mode use the same builder. The payload appended to every ambulance request includes:

- Name, age, gender, phone (from `profiles`)
- Blood group, allergies, chronic conditions, current medications, family doctor (from `health_profile` + `medications`)
- Latest vitals snapshot (HR, SpO₂, BP from latest `vitals_log` row if present)
- Emergency profile link `/e/:token`
- Up to 3 emergency contacts

This is sent both as structured JSON to the API and as the formatted `EMERGENCY HEALTH CARD` block in the WhatsApp fallback message (consistent with current behaviour).

---

### Part B — Send via API, fallback to WhatsApp via MSG91

**New edge function:** `supabase/functions/send-ambulance-request/index.ts`

Flow on **Send Request**:

1. Build the structured payload `{ patient, contacts:[user, primaryGuardian], pickup, destination, healthCard, requestedAt, source: 'user'|'guardian' }`.
2. **Primary attempt** — POST the payload to a configured ambulance partner endpoint (env `AMBULANCE_API_URL` + `AMBULANCE_API_KEY`). Until that integration is live, this primary attempt is a no-op stub that returns `{ ok: false, reason: 'not_configured' }` so the fallback always runs — clearly logged.
3. **MSG91 WhatsApp fallback** — if primary fails or times out (8s), call MSG91 Flow API with a new template `MSG91_AMBULANCE_TEMPLATE_ID` to **+918710810887**. Variables: `{{1}}` patient name, `{{2}}` pickup address, `{{3}}` destination, `{{4}}` user phone, `{{5}}` guardian phone, `{{6}}` short health-card summary, `{{7}}` emergency profile link.
4. Always insert a row into a new `ambulance_requests` table for audit (id, user_id, ward_user_id?, payload jsonb, channel `api|whatsapp`, status `sent|failed|pending`, response, created_at). RLS: user can read own; guardian can read where `ward_user_id = a guardian.user_id` they're accepted on.
5. Return `{ channel, success, message }` so the UI can show:
   - ✅ *"Request sent via Ambulance Service. ETA confirmation will follow."* (API)
   - ⚠️ *"Ambulance Service not reachable — sent via WhatsApp instead. Helpline: +91 7045868482"* (fallback)
   - ❌ *"Both channels failed — please call the helpline now."* with a big red **Call Helpline** button (existing UI).

**Manual fallback button** — keep the existing **Send via WhatsApp** button on screen as a manual escape hatch, but it now hits the same edge function with `force_channel: 'whatsapp'`. The click-to-open `wa.me` link stays as a final user-side fallback if even MSG91 fails.

**MSG91 template (you create in MSG91 dashboard):**
> 🚑 *Ambulance Request — Check-iN*  
> Patient: {{1}}  
> Pickup: {{2}}  
> Destination: {{3}}  
> Patient phone: {{4}}  
> Guardian phone: {{5}}  
> Health: {{6}}  
> Profile: {{7}}

Numbered slots mapped (per MSG91's numbered-variable rule we just confirmed): `patient_name`, `pickup_address`, `destination`, `user_phone`, `guardian_phone`, `health_summary`, `profile_link`.

**Same flow for Guardian** — Guardian's `<AmbulanceBooking wardUserId=… />` calls the same edge function with `source: 'guardian'`, ward's data, and the guardian's own phone as the secondary contact.

---

### Part C — Advisory answers

**Q1. When/where to integrate payment, considering it's an emergency?**

Recommendation: **Do not put a payment wall in front of the Emergency request.** In a true emergency, friction kills the product. Instead:

- **Emergency tab → free dispatch, pay-after-service.** The request goes out immediately (API or WhatsApp). The ambulance partner collects payment on-site (cash/UPI/card) at standard published pricing (₹1,500 first 5 km + ₹300/km, already in business-logic memory). The app simply records the trip.
- **Book & Pay tab → pre-paid scheduled bookings only.** Razorpay checkout for non-emergency transfers (hospital discharge, scheduled dialysis pickup, OPD visits, inter-hospital transfer). This is where pre-payment makes sense because there's time and the user gets a guaranteed slot + locked price.
- **Optional later:** add a one-time card-on-file ("Save card for emergencies") in Settings so emergency dispatch can auto-charge after the trip without blocking dispatch. Strictly opt-in.

**Therefore yes — keep two tabs in the Guardian app too, identical to the User app:**
- **Emergency** — instant dispatch, pay-on-arrival, no payment screen.
- **Book & Pay** — Razorpay pre-pay for scheduled bookings.

This keeps the mental model identical across both apps and avoids the worst possible UX: a payment failure during a heart attack.

**Q2. When the User books an ambulance, how is the Guardian informed?**

Three parallel notifications, fired by the `send-ambulance-request` edge function the moment the request is dispatched (before waiting for partner ACK):

1. **In-app realtime alert** — insert a row via `supabase.rpc('insert_notifications_deduped', …)` of type `ambulance_dispatched` for every accepted guardian. The Guardian dashboard's existing alert hierarchy (top-priority red banner) renders it instantly via the realtime subscription that already exists in `GuardianDashboard.tsx`.
2. **Push notification** — same channel as SOS push: title *"Ambulance dispatched for <ward>"*, body with pickup + destination, deep-links to a new `/guardian/ambulance/:requestId` page showing live status + Call Patient + Call Helpline.
3. **MSG91 WhatsApp/SMS to the Primary Guardian's phone** using a second new MSG91 template (`MSG91_AMBULANCE_GUARDIAN_NOTIFY_TEMPLATE_ID`):
   > 🚑 <Ward name> just requested an ambulance.  
   > Pickup: <address>  
   > Destination: <hospital>  
   > Status: Dispatched  
   > Track: <link to public status page using existing emergency_share_tokens pattern>

For **Guardian-initiated** bookings, the same three notifications go to the User (and to other accepted guardians), so everyone is in sync regardless of who triggered it.

---

### What I will NOT change

- No change to the Razorpay subscription flow.
- No change to the existing `EMERGENCY HEALTH CARD` content — only generalising the builder so user mode also benefits.
- No change to the SOS lifecycle or the existing `wa.me` fallback link.
- No change to MSG91 template approval process — you'll create the two new templates in the MSG91 dashboard and give me the template IDs to add as secrets (`MSG91_AMBULANCE_TEMPLATE_ID`, `MSG91_AMBULANCE_GUARDIAN_NOTIFY_TEMPLATE_ID`).

