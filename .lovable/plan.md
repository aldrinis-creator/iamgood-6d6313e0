

## Tablets/Medication Feature — Full Build

This is a large feature. I'll build it in two layers: database tables + a full-featured medication management page replacing the current static "Tablets" section.

### Database Tables (2 new tables via migration)

**1. `medications`** — the medication catalog per user
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | FK-like, not to auth.users |
| name | text | e.g. "Metformin 500mg" |
| dosage | text | e.g. "1 tablet" |
| frequency | text | e.g. "twice_daily" |
| instructions | text nullable | "Take after food" |
| total_quantity | int | Total pills in current stock |
| remaining_quantity | int | Current stock count |
| low_stock_threshold | int default 5 | Alert when remaining <= this |
| refill_reminder | boolean default true | |
| alarm_enabled | boolean default true | |
| alarm_mode | text default 'chime' | off/chime/voice |
| schedule_times | text[] | e.g. {"08:00","21:00"} |
| start_date | date | |
| end_date | date nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: Users can CRUD their own medications.

**2. `medication_logs`** — dose-level tracking
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| medication_id | uuid FK→medications | |
| user_id | uuid | |
| scheduled_at | timestamptz | Exact scheduled time |
| taken_at | timestamptz nullable | When actually taken |
| status | text default 'pending' | pending/taken/missed/skipped |
| created_at | timestamptz | |

RLS: Users can CRUD their own logs.

### Scheduling & Missed Logic
- Each day, the app generates today's dose schedule from `medications.schedule_times`
- Doses are sorted: **current hour first**, then upcoming, then past
- A dose is **Missed** if `now() > scheduled_at + 1 hour` and status is still `pending`
- A dose is **Taken** only within ±1 hour of schedule; outside that window it's marked "Late"

### New Components

**`src/components/medications/MedicationManager.tsx`** — Main tabbed view with sub-tabs:
1. **Today's Schedule** — timeline of doses sorted by proximity to now; tap to mark taken; auto-mark missed after 1hr
2. **My Medications** — list all medications with add/edit/delete; shows stock level with color-coded low-stock badge
3. **Refill & Order** — medications with low stock; "Order" button (placeholder link to pharmacy); "Scan Prescription" button (camera placeholder for Phase 2)
4. **Alarm Settings** — per-medication alarm toggle and mode (off/chime/voice); test button; integrates with existing `audioAlerts.ts`

**`src/hooks/useMedicationAlarms.ts`** — Similar to `useCheckInAudio.ts`
- Checks every 30s against today's medication schedule
- Plays chime/voice per medication's `alarm_mode` setting
- Voice says: "Time to take [medication name]"
- Integrated into `AppLayout.tsx`

### Changes to Existing Files
- **`src/pages/MyHealth.tsx`** — Replace the static "Tablets" card with `<MedicationManager />`
- **`src/components/AppLayout.tsx`** — Add `useMedicationAlarms()` hook
- **`src/lib/audioAlerts.ts`** — Add `playMedicationVoice(medName)` helper

### UI Flow
```text
[Tablets] tap → MedicationManager opens with 4 tabs:

┌─────────────┬───────────┬─────────┬──────────┐
│  Today      │  My Meds  │ Refill  │  Alarms  │
└─────────────┴───────────┴─────────┴──────────┘

Today tab:
  ┌──────────────────────────────────┐
  │ 🕐 8:00 AM — NOW                │
  │  ● Metformin 500mg    [✓ Take]  │
  │  ● Amlodipine 5mg     [✓ Take]  │
  ├──────────────────────────────────┤
  │ 🕐 9:00 PM — Upcoming           │
  │  ○ Atorvastatin 10mg  [Pending] │
  ├──────────────────────────────────┤
  │ 🕐 7:00 AM — Missed             │
  │  ✗ Vitamin D           [Missed] │
  └──────────────────────────────────┘

Refill tab:
  ┌──────────────────────────────────┐
  │ ⚠️ Low Stock                     │
  │  Metformin — 3 left    [Order]  │
  │  Amlodipine — 5 left   [Order]  │
  ├──────────────────────────────────┤
  │ 📷 Scan Prescription             │
  │  [Upload/Scan] → Compare prices │
  └──────────────────────────────────┘
```

### Files Created/Modified
| File | Action |
|------|--------|
| `src/components/medications/MedicationManager.tsx` | Create — main tabbed component |
| `src/components/medications/TodaySchedule.tsx` | Create — today's doses with sorting/status |
| `src/components/medications/MedicationList.tsx` | Create — CRUD medications |
| `src/components/medications/RefillOrder.tsx` | Create — low stock + order + scan |
| `src/components/medications/AlarmSettings.tsx` | Create — per-med alarm config |
| `src/hooks/useMedicationAlarms.ts` | Create — real-time alarm hook |
| `src/lib/audioAlerts.ts` | Edit — add medication voice helper |
| `src/pages/MyHealth.tsx` | Edit — replace static Tablets card |
| `src/components/AppLayout.tsx` | Edit — add medication alarm hook |
| Database migration | Create `medications` + `medication_logs` tables with RLS |

