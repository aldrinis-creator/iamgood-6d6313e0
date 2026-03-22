

# Emergency Profile Back Button + Past Medical History

## Changes

### 1. Add Back Button to Emergency Profile (`src/pages/EmergencyProfile.tsx`)
- Add a "Back to App" button at the top of the public emergency profile page
- Uses `window.history.back()` or links to `/` so users who navigated from within the app can return
- Styled as a subtle link/button above the emergency card header

### 2. New Database Table: `medical_history`
```sql
CREATE TABLE public.medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'hospitalization' or 'surgery'
  reason text NOT NULL,
  nature text,
  start_date date,
  end_date date,
  treatment text,
  medications text,
  advice text,
  hospital_name text,
  doctor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
-- Standard authenticated CRUD policies for own records
-- Guardian SELECT policy (same pattern as other health tables)
-- Anon SELECT policy scoped to active share tokens
```

### 3. Add Past Medical History Section to Profile (`src/pages/MyProfile.tsx`)
Insert a new card **after the Body & Health card** (line ~503) with:

- **Hospitalizations (Last 10 Years)**
  - Toggle: "Any hospitalization in the last 10 years?" — Yes/No
  - If Yes: show list of existing entries + "Add" button
  - Add form collects: Reason, Nature of hospitalization, Start date, End date, Treatment given, Medications prescribed, Other advice, Hospital name, Doctor name
  - Each entry is a row in `medical_history` with `type = 'hospitalization'`

- **Surgeries (Last 10 Years)**
  - Toggle: "Any surgeries in the last 10 years?" — Yes/No
  - If Yes: show list of existing entries + "Add" button
  - Same structured form as hospitalizations
  - Each entry stored with `type = 'surgery'`

- View mode: display entries as compact cards with key details
- Edit mode: allow adding/removing entries via inline form with all fields
- Data loads in `loadData()` alongside existing queries
- Save handled alongside existing `handleSave()` flow (individual inserts/deletes for history entries)

### 4. Settings fields for toggles
The Yes/No toggles for "any hospitalization" and "any surgery" will be stored as part of `user_settings` JSON (`hasHospitalizations: boolean`, `hasSurgeries: boolean`) to remember the user's answer even if they haven't added entries yet.

## Files Changed
- `src/pages/EmergencyProfile.tsx` — add back button
- `src/pages/MyProfile.tsx` — add Past Medical History section
- `src/hooks/useUserSettings.ts` — add `hasHospitalizations`, `hasSurgeries` defaults
- Database migration — create `medical_history` table with RLS

