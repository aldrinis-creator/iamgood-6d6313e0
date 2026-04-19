---
name: Tongue Analysis
description: Photo-based tongue screening — colour, coating, moisture, shape, surface features, red-flag escalation with guardian alerts
type: feature
---

## Tongue Analysis Tool

**Backend prompt:** `tongue_analysis` in `supabase/functions/health-tools/index.ts` (vision, `google/gemini-2.5-flash`).

**Returns strict JSON:** `image_quality`, `tongue_detected`, `color` (pink/pale/red/purple/bluish), `coating` (none/thin_white/thick_white/yellow/brown/black/patchy), `moisture`, `shape`, `surface[]` (smooth/cracked/fissured/geographic/ulcer/spots), `possible_indicators[]`, `red_flags[]`, `recommendations[]`, `see_doctor` (no/soon/urgent), `confidence`, `disclaimer`.

**Component:** `src/components/health-tools/TongueAnalysis.tsx` — mirrors UrineCheck pattern.

**Safety tiers:**
- `see_doctor === "urgent"` → red destructive Alert
- `see_doctor === "soon"` → amber Alert
- `image_quality === "poor"` or `!tongue_detected` → "Photo unclear, retake"
- `confidence < 50` → low-confidence info banner

**Red flags trigger guardian alert** via `insert_notifications_deduped` RPC (`type: "tongue_warning"`) when `see_doctor === "urgent"` OR (`see_doctor === "soon"` AND `red_flags.length > 0`).

**Storage:** Saves to `medical_records` as `record_type: "Lab Reports"` with image in `medical-documents` bucket.

**Placement:** Top-level tile in My Health (not under Health Tools sub-list).
