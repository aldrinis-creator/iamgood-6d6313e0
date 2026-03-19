

# My Persona — Expanded Health Profile in My Health

## Overview

Create a dedicated **My Persona** screen accessible from the My Health grid. It consolidates all health/nutrition persona data into one place, adds new fields (activity level, medical conditions, dietary preferences), and removes the duplicate "Health Information" card from My Profile.

## Database Changes

**Alter `nutrition_personas` table** — add columns:
- `activity_level` (text, nullable) — sedentary / light / moderate / active / very_active
- `medical_conditions` (text[], nullable, default `'{}'`)
- `dietary_preferences` (text[], nullable, default `'{}'`) — e.g. no sugar, low salt, high protein
- `blood_group` (text, nullable)

This consolidates health data that was previously only in `health_profile` into the persona the AI advisor uses.

## Files to Create

### 1. `src/components/MyPersona.tsx`
Full-page persona editor with sections:
- **Basic Info**: Diet type, age, weight (pre-filled from profile if available)
- **Body & Health**: Blood group, allergies, medical conditions (from health_profile + persona)
- **Activity Level**: Select dropdown (sedentary → very active)
- **Dietary Preferences**: Comma-separated input (no sugar, low salt, high protein, etc.)
- **Health Goals**: Comma-separated input (weight loss, muscle gain, etc.)
- **Save** button that upserts to `nutrition_personas`

Data loading: merges data from both `nutrition_personas` and `health_profile` tables on mount. Saves to `nutrition_personas`.

## Files to Modify

### 2. `src/pages/MyHealth.tsx`
- Add `UserCog` icon import
- Add "My Persona" tile to `healthTools` array (9th tile)
- Add `"My Persona": MyPersona` to `toolComponents` map

### 3. `src/pages/MyProfile.tsx`
- **Remove** the "Health Information" card (lines 442-473) — this data now lives in My Persona
- Keep: Personal Info, Body Metrics, Primary Guardian, Government ID Cards

### 4. `src/components/NutritionAdvisor.tsx`
- Remove the inline "Edit Persona" dialog (it's now a full page in My Health)
- Replace with a small "Edit Persona" button that navigates back to My Health grid or sets the parent tool to "My Persona"
- Update the `Persona` interface to include new fields and pass them to the edge function

### 5. `supabase/functions/nutrition-advisor/index.ts`
- Update system prompts to include new persona fields (activity_level, medical_conditions, dietary_preferences, blood_group) for richer AI context

## Duplication Cleanup

| Data | Currently in | Move to |
|------|-------------|---------|
| Blood group | health_profile (MyProfile) | My Persona (reads health_profile) |
| Allergies | health_profile + nutrition_personas | nutrition_personas (single source) |
| Chronic conditions | health_profile (MyProfile) | My Persona |
| Current medications | health_profile (MyProfile) | My Persona (display only, from health_profile) |
| Weight/Age | nutrition_personas | nutrition_personas (pre-fill from profile) |

The Health Information card in MyProfile is removed. My Persona becomes the single place to view and edit all health parameters.

