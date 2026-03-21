

# Multi-part Update: Persona Migration, Vault Fix, Phone Formatting

## Summary
Four changes: (1) fix Medical Vault screen jumping, (2) migrate My Persona fields into My Profile and Medical Vault, (3) remove My Persona from Health tools, (4) add country code prefix to all phone inputs.

---

## 1. Fix Medical Vault Screen Jumping

**Root cause**: Select dropdowns and input focus on mobile cause the page to scroll/jump. The form is conditionally rendered inside a scrollable tab, and Select `popper` positioning fights with mobile keyboards.

**Fix in `src/pages/MedicalVault.tsx`**:
- Wrap the upload form and profile tab inputs in a container with stable height
- Add `autoFocus={false}` and use `onOpenChange` on Select to prevent scroll
- Add `className="text-base"` to all Input fields (prevents iOS zoom on focus, which causes "jumping")
- For the Health Profile tab inputs (allergies, conditions, medications), the ChipInput's onKeyDown Enter + state update may cause scroll — stabilize with `e.stopPropagation()`

---

## 2. Migrate My Persona into My Profile + Medical Vault

### A. My Profile (`src/pages/MyProfile.tsx`) — Add "My Persona" Card below Body Metrics

Add a new Card section after Body Metrics containing:
- **Blood Group** (Select)
- **Allergies** (comma-separated input)
- **Medical Conditions** (comma-separated input)
- **Activity Level** (Select)
- **Smoking** (Select)
- **Alcohol** (Select)
- **Diet Type** → moved to a "Body & Health" grouping alongside Blood Group
- **Dietary Preferences** (dropdown/popover with chip selection — same multi-select UX as current My Persona)
- **Health Goals** (dropdown/popover with chip selection)

Data loads from `nutrition_personas` table (existing). Save upserts to `nutrition_personas`.

Fields **NOT** moved (stay in My Profile's existing cards): Date of Birth, Weight, Height.

### B. Medical Vault Profile Tab (`src/pages/MedicalVault.tsx`)

Replace the current manually-entered Health Profile tab with read-only data pulled from:
- `profiles` table: full_name, date_of_birth, gender, phone, weight_kg, height_m
- `nutrition_personas` table: blood_group, allergies, medical_conditions, diet_type, activity_level, smoking, alcohol, dietary_preferences, health_goals
- `health_profile` table: family_doctor_name, family_doctor_phone, emergency_notes, current_medications

Display as read-only InfoRow cards. Keep the "Save Health Profile" for emergency_notes and current_medications (which aren't in persona). Keep the Emergency PDF generation.

### C. Remove My Persona from Health Tools (`src/pages/MyHealth.tsx`)

- Remove `{ icon: UserCog, label: "My Persona", ... }` from `healthTools` array
- Remove `"My Persona": MyPersona` from `toolComponents`
- Remove the import of `MyPersona`

---

## 3. Phone Number Country Code — Create `PhoneInput` Component

**New file: `src/components/PhoneInput.tsx`**

A reusable component with:
- Country code dropdown (default `+91` India, with a few common options: +1, +44, +971, +65, +61)
- Phone number input field
- Props: `value`, `onChange`, `placeholder`
- Stores full value as `+91 9876543210` format

**Files to update** (replace raw phone `<Input>` with `<PhoneInput>`):
- `src/pages/MyProfile.tsx` — Mobile Number, Doctor Mobile, Guardian Phone
- `src/pages/MedicalVault.tsx` — Family Doctor Phone
- `src/pages/Settings.tsx` — Guardian phone
- `src/components/GuardianTab.tsx` — Guardian phone
- `src/pages/Register.tsx` — already has country code selector, keep as-is
- `src/components/AmbulanceBooking.tsx` — Contact Number

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/PhoneInput.tsx` | **New** — reusable phone input with country code |
| `src/pages/MyProfile.tsx` | Add persona card, use PhoneInput |
| `src/pages/MedicalVault.tsx` | Fix scroll jumping, pull profile data into Profile tab |
| `src/pages/MyHealth.tsx` | Remove My Persona tool |
| `src/components/MyPersona.tsx` | Keep file (no delete), just unreferenced |
| `src/pages/Settings.tsx` | Use PhoneInput |
| `src/components/GuardianTab.tsx` | Use PhoneInput |
| `src/components/AmbulanceBooking.tsx` | Use PhoneInput |

No database changes needed — all tables already exist with the right columns.

