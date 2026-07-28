## Personal Healthcare Hub + Nearest Hospital Finder

### 1. Secret
- Add `ORANGE_WEBHOOK_SECRET` via `add_secret` tool (user enters value in secure form). No DB table yet.

### 2. New tile in My Health
Edit `src/pages/MyHealth.tsx`:
- Add tile **"Personal Healthcare"** to `healthTools` array using `HeartHandshake` (Lucide) icon.
- On tap → `navigate("/personal-healthcare")`.

### 3. New page `src/pages/PersonalHealthcare.tsx`
- Wrapped in `AppLayout`, back arrow to `/my-health`.
- 5 tiles in a list/grid layout mirroring existing hub style:
  - **Blood Tests** (`Droplet`) — "Soon to come" badge
  - **Nurse-on-Call** (`Stethoscope`) — "Soon to come"
  - **Attendant-at-Home** (`UserPlus`) — "Soon to come"
  - **Doctor-on-Call** (`BriefcaseMedical`) — "Soon to come"
  - **Nearest Hospital Finder** (`Hospital`) — active, navigates to `/nearest-hospitals`
- "Soon to come" tiles show a small muted badge and toast on tap: "Coming soon with Orange Labs".

### 4. New page `src/pages/NearestHospitals.tsx`
- Back arrow to `/personal-healthcare`.
- On mount: `navigator.geolocation.getCurrentPosition()` to grab user coords (with error/permission handling).
- Call Google Places API (New) **searchNearby** twice in parallel via existing `loadGoogleMapsAPI` client (already loaded with `places` library) OR via a small edge function using the Google Maps connector gateway (`places/v1/places:searchNearby`) for hospitals + dental clinics within 5km:
  - `includedTypes: ["hospital"]` → labeled with hospital icon
  - `includedTypes: ["dental_clinic"]` → labeled with a tooth/dental icon (`Bluetooth`→ use custom; Lucide has no tooth — use `Smile` or lab icon `Sparkles`; best fit: import `Tooth`-like via lucide-lab, or fallback to a two-letter "DC" badge). Recommend using `Bluetooth`→ no; use small text label "Dental" + `Stethoscope` icon variant. **Decision:** use `Smile` icon tinted differently, plus a "Dental Clinic" text label under name for clarity.
- Render each result as a Card with:
  - Name, type badge (Hospital / Dental Clinic)
  - Distance in km (Haversine from `src/lib/haversine.ts`)
  - Address (`formattedAddress`)
  - Phone (`internationalPhoneNumber`) — tap to call (`tel:`)
  - Website (if present) — external link
  - Rating + open-now status if available
  - "Directions" button → `google.com/maps/dir/?api=1&destination=lat,lng`
- Sort by distance ascending. Empty state if none found.

### 5. Routing
Edit `src/App.tsx`: add `/personal-healthcare` and `/nearest-hospitals` routes (protected).

### 6. Back arrow on Unlock Medical Vault tile
- Locate the Medical Vault unlock screen (`src/pages/MedicalVault.tsx` or `src/components/VaultGate.tsx`) and add a back arrow button (top-left) that navigates back to `/my-health`.

### Technical notes
- Use Google Maps connector via **gateway** in a new edge function `nearby-hospitals` (POST body `{ lat, lng }`) to avoid exposing extra API calls to the browser key beyond what's authorized. The existing `VITE_...BROWSER_KEY` is only for Maps JS + Places browser autocomplete — nearby search should go through the gateway per Google Maps connector guidance.
- Field mask: `places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.currentOpeningHours,places.primaryType`.
- No DB changes.
