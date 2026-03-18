

# Check-iN Mobile PERS — Implementation Plan

This is a large project. Given the scope, I recommend building it incrementally across multiple iterations. Here is the plan for the **first implementation pass** — the complete UI shell with mock data and navigation, establishing the foundation for backend integration later.

---

## Design System

- **Navy Blue** (`#1B3A5C`) — primary/trust color for headers, nav
- **White** (`#FFFFFF`) — backgrounds, clarity
- **Emerald Green** (`#10B981`) — safety indicators, success states
- **Red** (`#EF4444`) — SOS only
- **Font sizes**: minimum 18px on User Dashboard for accessibility
- Mobile-first layout (max-width ~430px centered)

## Architecture Overview

```text
src/
├── pages/
│   ├── Index.tsx          (landing/auth gate)
│   ├── Login.tsx          (sign-in)
│   ├── Register.tsx       (sign-up with guardian nomination)
│   ├── UserDashboard.tsx  (Safety Hub — SOS, Check-in, Health Passport)
│   ├── GuardianDashboard.tsx (Map, Quick Actions, User status)
│   ├── MyHealth.tsx       (Health tools grid — screenshots 5/6)
│   ├── MedicalVault.tsx   (Blood group, allergies, conditions, IDs)
│   ├── NutritionAdvisor.tsx
│   ├── Settings.tsx       (Check-in intervals, fall detection, geofencing)
│   ├── Subscription.tsx   (Basic/Pro pricing table)
│   └── NotFound.tsx
├── components/
│   ├── SOSButton.tsx      (floating red SOS button, 5s cancel countdown)
│   ├── CheckInCard.tsx    (pulsing heart, timer, check-in logic)
│   ├── HealthPassport.tsx (daily score ring, category rows)
│   ├── HealthDashboard.tsx(wellness/meds summary cards)
│   ├── AppHeader.tsx      (logo, globe, avatar, nav tabs)
│   ├── NavTabs.tsx        (Home, Appointments, My Health tabs)
│   ├── SubNavTabs.tsx     (My Profile, Guardian, Secret Vault, Help)
│   ├── QuickActionBar.tsx (Call, Route, Ambulance for Guardian)
│   ├── SafeZoneCard.tsx   (geofencing UI)
│   ├── MedicalInfoForm.tsx(health info, doctor, insurance forms)
│   ├── IDCardSection.tsx  (Aadhaar, PAN card storage)
│   ├── EmergencyModeOverlay.tsx (high-vis alert with cancel countdown)
│   └── PricingTable.tsx   (Basic/Pro tiers with Razorpay placeholder)
```

## Implementation Phases (this session)

### Phase A — Foundation & Navigation
- Set up color theme (CSS variables) with navy/white/emerald/red palette
- Create `AppHeader` with logo, nav tabs (Home, Appointments, My Health)
- Create sub-nav tabs (My Profile, Guardian, Secret Vault, Help)
- Set up all routes in App.tsx
- Create persistent floating SOS button component

### Phase B — User Dashboard (Home)
- Sleep Mode / Check-Out toggle bar
- **CheckInCard**: pulsing heart animation, "Did you Check-In today?" prompt, next check-in time display
- **HealthPassport**: circular progress ring (score/100), "Steady" trend line, category rows (Check-In, Face Scan, Activity, Wellness, Medications) with scores and action links
- **HealthDashboard**: Wellness score card + Meds adherence card
- "How It Works" expandable section
- AI Health Companion description section

### Phase C — My Health Screen
- 3x3 grid of health tool icons (Tablets, Health Tools, Ambulance, Activity/Workout, Face Scan, Wellness, Nutrition, Services, Care Journal)
- Tool detail views: when "Health Tools" is selected, show sub-cards (Doctor Visit Report, Medical Documents, Document Analyzer, Symptom Checker, Medication Info, Tele-Consult)
- Medication Manager card with "Open Tablets" CTA

### Phase D — Medical Vault / Profile
- Health Information form (Blood Group dropdown, Food Preference, Allergies, Medical Conditions)
- Family Doctor section (name, phone with country code)
- Insurance Information (Health + Life insurance forms)
- Government ID Cards section (Aadhaar, PAN with masked numbers, show/hide toggle)
- "Generate Emergency PDF" button

### Phase E — Guardian Dashboard
- Map placeholder (Leaflet/static) showing user location
- Status bar: battery %, last active, location
- Quick Action Bar: Call User, Route to Location, Request Ambulance (premium)
- Ambulance booking flow (Rs. 1500 for first 5km, Rs. 300/km after)

### Phase F — Settings & Safety Features
- Check-In schedule settings (default 7AM, 12PM, 7PM)
- Inactivity Nudge Interval with frequency dropdown
- Fall Detection toggle with accelerometer description
- Geofencing: Safe Zone management (add/edit/delete zones)

### Phase G — Subscription & Auth
- Registration flow with guardian nomination (up to 5, 1 mandatory)
- Login with role selection (User/Guardian)
- Pricing table: Basic (Rs.99/mo, Rs.999/yr) and Pro (Rs.199/mo, Rs.1999/yr)
- Mock Razorpay checkout modal on "Go Pro"

### Phase H — Emergency Mode
- Full-screen red overlay when SOS triggered
- 5-second cancel countdown with "Cancel SOS" button
- Auto-share location + medical vault data to guardians
- State management for emergency mode toggle

## Technical Notes

- **No backend yet** — all data is mock/local state. Supabase integration will follow.
- **Mobile-only layout** — all screens max-width ~430px, centered on larger screens.
- **Leaflet** for map placeholder on Guardian Dashboard (lightweight, no API key needed).
- **Recharts** (already installed) for the health trend mini-charts.
- State management via React context for user role (User/Guardian) and emergency mode.

## What This Plan Does NOT Include (future iterations)
- Supabase auth, database, real-time subscriptions
- Actual push notifications / accelerometer APIs (requires Capacitor)
- Razorpay live integration
- Real geolocation tracking
- PDF generation for medical vault

---

This first pass will produce a fully navigable, visually complete mobile app matching the screenshots, with all screens and components wired together using mock data. Ready to implement?

