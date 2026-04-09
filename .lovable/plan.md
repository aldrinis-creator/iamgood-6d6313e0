

## Integrate Face Scan into Health Passport + Add Score Trend History

### Current State

1. **Face Scan data is NOT used in Health Passport scoring.** The Vitals score only reads from `activity_logs` (HR, SpO2, BP, temp, glucose). Face scan results (HR, stress) stored in `face_scans` table are ignored.
2. **No historical score tracking exists.** Health Passport computes scores on-the-fly every 60s but never persists them — so there's no daily/weekly/monthly trend view.

### Plan

**1. Include Face Scan in Vitals Score**

In `HealthPassport.tsx` and `WardHealthPassport.tsx`:
- Add a query to fetch today's latest `face_scans` record for the user
- If `activity_logs` has no HR/SpO2 but `face_scans` does, use face scan values as fallback for the HR and stress components of the Vitals score
- This means a user who only does face scans (no wearable) still gets Vitals credit

**2. Create `health_passport_scores` table to persist daily scores**

New migration:
```sql
CREATE TABLE health_passport_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  overall integer NOT NULL DEFAULT 0,
  checkin integer NOT NULL DEFAULT 0,
  activity integer NOT NULL DEFAULT 0,
  wellness integer NOT NULL DEFAULT 0,
  medications integer NOT NULL DEFAULT 0,
  vitals integer NOT NULL DEFAULT 0,
  nutrition integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);
ALTER TABLE health_passport_scores ENABLE ROW LEVEL SECURITY;
-- User can manage own scores
CREATE POLICY "Users can manage own scores" ON health_passport_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Guardians can view ward scores
CREATE POLICY "Guardians can view ward scores" ON health_passport_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM guardians g WHERE g.guardian_user_id = auth.uid() AND g.user_id = health_passport_scores.user_id AND g.status = 'accepted'));
```

**3. Persist scores on each compute cycle**

In `HealthPassport.tsx`, after computing all category scores, upsert a row into `health_passport_scores` for today. This happens every 60s but the unique constraint ensures only one row per day (upsert updates it).

**4. Add Trend Chart to Health Passport**

Below the existing category bars, add a collapsible "Score Trend" section with:
- Daily/Weekly/Monthly tab selector
- A line chart (using existing recharts) showing overall score over time
- Daily: last 7 days, Weekly: last 4 weeks (averaged), Monthly: last 6 months (averaged)
- Color-coded reference bands (green ≥70, amber 40-69, red <40)

**5. Ward Health Passport gets the same trend view**

`WardHealthPassport.tsx` will also persist scores and show the trend chart for guardians.

### Files to Modify

- 1 new SQL migration (table + RLS)
- `src/components/HealthPassport.tsx` — add face scan query, upsert scores, add trend chart
- `src/components/WardHealthPassport.tsx` — same face scan + upsert + trend chart

