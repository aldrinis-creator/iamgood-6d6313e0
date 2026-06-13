## Blood Bank Directory — Phase 1

A geo-localized blood bank finder inside Emergency First Aid, accessible to both users and guardians.

### 1. Data ingestion (one-time)

- Create `public.blood_banks` table with: `name`, `address`, `district`, `state`, `category`, `phone`, `email`, `lat`, `lng`, `geocode_status`.
- Seed all 6,145 rows from the uploaded CSV.
- Edge function `geocode-blood-banks` (admin-triggered, batched, resumable) calls Google Geocoding via the existing Maps connector gateway. Stores lat/lng, marks `geocode_status = ok | failed | partial`. Falls back to district + state centroid on failure so every row is still searchable.
- RLS: `SELECT` open to `authenticated` (and `anon` for guest emergency use). No writes from clients.

### 2. Entry point — Emergency First Aid tab

In `EmergencyFirstAid.tsx`, above the search input, add a **"Need Blood?"** card:

- Crimson accent (`bg-red-600`, white text, blood droplet icon from lucide `Droplet`).
- Full-width, prominent, sits below the 112 emergency banner.
- Taps open a new route `/blood-banks` (or in-place view — same pattern as `NearbyFacilities`).

### 3. Blood Banks screen — 3 steps

**Step A — Blood Group Selector**
- 4×2 grid of large pill buttons: `A+ A- B+ B- O+ O- AB+ AB-`.
- Defaults to the user's group from `profiles.blood_group` if set; otherwise unselected.
- Selecting a different group is instant (for searching on behalf of family).

**Step B — Component toggle**
- Segmented pills: `Whole Blood` (default) · `Platelets` · `Plasma`.
- Stored only in local state; filters display label but not the bank list (CSV has no component data).

**Step C — Action list (nearest 5)**
- Request geolocation; if denied, fall back to profile city or a manual district picker.
- Query `blood_banks`, compute Haversine in client over a state-prefiltered slice (cap 500 rows) for speed, take top 5.
- Each card shows:
  - Name, address line, district
  - `2.4 km away` (Haversine, IST timestamp not needed)
  - Stock indicator: always 🟡 **"Call to Verify"** (no fake greens/reds)
  - Two buttons: **Call Blood Bank** (green, `tel:`) and **Get Directions** (outline, `https://www.google.com/maps/dir/?api=1&destination=lat,lng`)
- "Show more" expands to next 10.

### 4. Guardian access

- Same `/blood-banks` route exposed from `GuardianServices.tsx` with identical UI.
- When opened in guardian mode via `GuardianWardContext`, defaults the blood group to the **selected ward's** `blood_group`.

### 5. Out of scope (Phase 2, separate plan)

- In-house donor opt-in registry, eligibility screening, and 3 km → 5 km SOS broadcast.
- Real-time stock reporting / admin overrides.

---

### Technical notes

- **Files added:** `src/pages/BloodBanks.tsx`, `src/components/blood-banks/BloodGroupGrid.tsx`, `src/components/blood-banks/BloodBankCard.tsx`, `supabase/functions/geocode-blood-banks/index.ts`.
- **Files edited:** `src/components/health-tools/EmergencyFirstAid.tsx` (add tile), `src/App.tsx` (route), `src/pages/GuardianServices.tsx` (entry), `profiles` migration if `blood_group` column missing.
- **Migrations:** create `blood_banks` table + GRANTs + RLS; add `profiles.blood_group` if absent.
- **Seeding:** CSV imported via `psql COPY` from `/mnt/user-uploads/blood_banks_data_March_2026.csv` into a staging table, then inserted into `blood_banks`. Geocoding runs async via the edge function after seed — list works immediately using state/district centroid fallback while geocoding catches up.
- **Connector:** existing `google_maps` connection (gateway) for Geocoding API. No new secret.
- **Performance:** index on `(state, district)` and `(lat, lng)` for fast prefilter.
