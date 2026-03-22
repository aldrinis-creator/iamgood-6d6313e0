

# Nutrition Advisor: Health Profile Fallback

## What
When `nutrition_personas` has no row for the user, fall back to `health_profile` to still provide personalized AI recommendations using available data (blood group, allergies, chronic conditions, current medications).

## Changes

### `src/components/NutritionAdvisor.tsx`
In `handleAction`, after the `nutrition_personas` query returns null, query `health_profile` and map its fields to the persona shape the edge function expects:

```typescript
let persona = null;
if (user) {
  const { data } = await supabase.from("nutrition_personas").select("*").eq("user_id", user.id).maybeSingle();
  if (data) {
    persona = data;
  } else {
    // Fallback: build partial persona from health_profile
    const { data: hp } = await supabase.from("health_profile").select("*").eq("user_id", user.id).maybeSingle();
    if (hp) {
      persona = {
        blood_group: hp.blood_group,
        allergies: hp.allergies || [],
        medical_conditions: hp.chronic_conditions || [],
        diet_type: "not specified",
        health_goals: [],
        dietary_preferences: [],
      };
    }
  }
}
```

Also add `weight_kg` and `height_m` from the `profiles` table (already available via `useAuth`) if persona is still sparse.

### Additional: Show hint when no persona exists
After results render, if fallback was used, show a small info banner: "For better recommendations, complete your Nutrition Persona in My Profile."

### No edge function changes needed
The edge function already handles partial/missing persona fields gracefully with fallback text like `"unknown"` and `"none"`.

### Fix: `.single()` → `.maybeSingle()`
The current code uses `.single()` which throws when no row exists. Switch to `.maybeSingle()` to prevent errors for new users.

