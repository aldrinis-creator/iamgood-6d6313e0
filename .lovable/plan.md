

## Plan — Add "Ambulance Type" (BLS / ALS) to ambulance request flow

Add a required **Ambulance Type** selector to the booking UI and propagate it through the edge function, MSG91 templates, and the audit table.

### 1. Database — `ambulance_requests` table

Add one column via migration:

- `ambulance_type text not null default 'BLS'` with a CHECK constraint allowing only `'BLS'` or `'ALS'`.

Existing rows backfill to `'BLS'` automatically via the default.

### 2. UI — `src/components/AmbulanceBooking.tsx`

Add a new required field directly **above the Destination Hospital** field, identical for User and Guardian modes:

```
🚑 Ambulance Type *
( ) BLS — Basic Life Support (oxygen, first aid, stretcher)
(•) ALS — Advanced Life Support (ICU-equipped, paramedic, defib)
```

- Two radio buttons rendered as large tap-friendly cards (≥56px tall, 18px font).
- Default selection: **BLS** (most common, lower cost).
- Short helper text under each option explaining when to choose it.
- A small inline hint: *"Choose ALS for cardiac, stroke, severe trauma, or unconscious patients."*
- Selected value stored in form state and added to the payload sent to `send-ambulance-request` as `ambulance_type`.
- Both Emergency tab and Book & Pay tab include the selector (the Book & Pay pricing card will later differentiate BLS vs ALS pricing — for this change we simply capture the selection).

### 3. Edge function — `supabase/functions/send-ambulance-request/index.ts`

- Extend `RequestBody` with `ambulance_type: 'BLS' | 'ALS'` (default `'BLS'` if missing).
- Persist it on the new `ambulance_type` column in the `ambulance_requests` insert.
- Include it in the partner API JSON payload.
- Pass it as a new MSG91 variable on **both** templates so the dispatch center and the guardian both see it.

### 4. MSG91 templates — you update in dashboard

Both templates gain one trailing numbered slot. **No code mapping change needed** — the edge function will start sending `ambulance_type` as a new key; you map it to the new slot number in MSG91.

**Template `ambulance_dispatch_request`** — append `Type: {{8}}`:

```
🚑 Ambulance Request — Check-iN

Type: {{8}}
Patient: {{1}}
Pickup: {{2}}
Destination: {{3}}
Patient phone: {{4}}
Guardian phone: {{5}}
Health: {{6}}
Profile: {{7}}
```

| Slot | Variable | Value |
|---|---|---|
| `{{8}}` | `ambulance_type` | `BLS` or `ALS` |

**Template `ambulance_guardian_notify`** — append `Type: {{5}}`:

```
🚑 Ambulance booked for {{1}}

Type: {{5}}
Pickup: {{2}}
Destination: {{3}}
Request ID: {{4}}

Open Check-iN to track status.
```

| Slot | Variable | Value |
|---|---|---|
| `{{5}}` | `ambulance_type` | `BLS` or `ALS` |

Resubmit both templates for MSG91 approval. Once approved, no further code change is needed — the edge function will already be sending the field.

### 5. Memory update

Append to `mem://features/ambulance-booking`: *"Ambulance Type (BLS / ALS) is a required field on every request, default BLS, sent to partner API, persisted on `ambulance_requests.ambulance_type`, and shown on both MSG91 templates."*

### What I will NOT change

- No price logic change — pricing tier (BLS vs ALS rate) stays as a future enhancement to the Book & Pay tab.
- No change to guardian notification channels (push / in-app / WhatsApp) beyond adding the type label.
- No change to SOS, MMJ, or any other flow.

