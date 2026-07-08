// Curated product knowledge base for the Check-iN help assistant.
// Kept as a single string so both the voice-query and product-assistant
// edge functions can inject it into their system prompt without extra I/O.
// Sourced from src/data/faqData.ts, guardianFaqData.ts and .lovable/memory/features/*.

export const PRODUCT_KB = `# Check-iN Product Knowledge Base

## Overview
Check-iN is a mobile-first elder-care safety and health companion for Indian families. It has two roles:
- **User**: the elder (or anyone) whose health, medications and safety are being tracked. Gets check-in reminders, medication alarms, SOS button, health tools, medical vault, and a journey tracker.
- **Guardian**: a family member or caregiver who watches over one or more Users ("wards"). Gets alerts when the ward misses a check-in, misses medication, triggers SOS, deviates from a journey, or leaves a safe zone. Guardians never receive local audio alerts on their own device — only wards do.
All scheduling and cutoffs run in India Standard Time (IST, Asia/Kolkata). Daily cycles reset at midnight IST.

## Registration
Sign-up is a 4-step wizard at /register:
1. Choose role (User or Guardian).
2. Enter full name and phone number (phone is the primary identity — email is optional and a placeholder is generated if omitted).
3. Verify a 6-digit OTP sent by SMS via MSG91 (self-managed OTP; the code is nullified from the database after successful verification).
4. Basic profile / consent.
Guardians can only sign up through a **nomination link** sent by an existing User. Direct guardian sign-up is blocked — the user must nominate them first.

## Login
Phone-first login at /login. Enter phone, receive OTP, verify. Google sign-in is also supported. During the whole login/OTP flow all alerts, overlays and notifications are suppressed via the loginInProgress flag so nothing pops up before the session is ready.

## Guardian Nomination
- A User opens their **Guardian** tab and taps "Add Guardian", enters the guardian's name and phone.
- The app generates a nomination token (72-hour expiry) and sends the guardian a link via SMS/WhatsApp.
- The guardian taps the link → registers → **explicitly accepts** the nomination. Only then are they active.
- Free plan = 1 guardian, Basic = 3, Pro = 5, Premium+ = 10.
- A guardian can be linked to at most **3 wards** total across all their users.
- Guardian profile is identity-only: name, phone, avatar, one emergency contact. Guardians do NOT have their own health records, ID documents, medications, sub-guardians, or vault PIN.

## Check-ins
Users get three daily check-in prompts at **7 AM, 12 PM and 7 PM IST**. Tapping the big heart on the dashboard opens a short "How are you feeling?" prompt. Missing a check-in for more than the configured window sends a chime alert to all active guardians. Guardian accounts do not receive their own check-in prompts.

## Medications
- Add medications under the **Tablets** tab with name, dosage, schedule times, refill quantity, and low-stock threshold.
- Alarms fire at each scheduled time; multiple meds due at once are **batched** into a single overlay and one audio tone.
- Adherence tracking runs T+0 to T+50 minutes after the scheduled time. If not marked "taken" within the 1-hour cutoff it's counted as **missed**, and between 60–75 minutes a "missed medication" alert goes to guardians.
- **Refills**: when remaining_quantity <= low_stock_threshold the app shows a visual refill reminder. Refill ordering requires a linked Doctor and Hospital in the profile, and can be routed through Jan Aushadhi stores.

## SOS
- Big red SOS button (bottom-right on user dashboard). One tap opens a 3-second confirmation dialog with a countdown.
- Confirming triggers an SOS event: sends SMS/WhatsApp with live location to all active guardians, plays a 880 Hz distress tone locally, and shows an "Active SOS" banner across the app.
- SOS state syncs across roles in real time. Only the user can resolve it (Mark as Safe). Guardians see the same active banner until it's resolved.
- Falls detected by the motion sensor open a 15-second countdown overlay; if the user doesn't cancel, an SOS auto-triggers.

## Ambulance Booking
Yes — the Check-iN app books ambulances. Here is how:
- Open **Services** (bottom navigation) → tap **Ambulance**.
- Choose a provider, confirm your pickup location, and tap **Book**.
- Available on **all plans** (including Free); pay-per-use tariff applies at the time of booking.
- Guardians can book on behalf of their ward from **Guardian → Services → Ambulance**; the ward's emergency card (blood group, allergies, chronic conditions, current meds, emergency contacts) is auto-attached to the booking.
- For life-threatening emergencies, also press the red **SOS** button so all guardians are alerted with your live location while the ambulance is en route.

## Medical Vault
- Store health records, ID documents, insurance, prescriptions, lab reports, and more, organised by category.
- Vault is protected by a **4-digit PIN** (encrypted). PIN can be recovered via nominee escrow.
- Files are stored with signed URLs valid for 1 hour; previews open in an in-app Dialog (image or PDF iframe).
- **Nominee claims**: a designated vault nominee can request release of the vault after the user is unreachable. This goes through an admin-reviewed claim + a release token flow. Pending or rejected nominees have no access — only guardians accepted as vault nominees can read claim data.

## Emergency Profile
Each user has a public **Emergency Profile** at /e/<token> — a QR-scannable page paramedics can view without logging in. It shows blood group, allergies, chronic conditions, current meds, emergency contacts. Tokens are opaque and revocable. Cached in the service worker so it works offline.

## Health Tools (Pro plan)
- **Health Passport**: daily 0-100 wellness score across 7 categories (vitals, nutrition, medications, activity, wellness, check-in, plus overall). Trend chart on the dashboard.
- **Face Scan**: measures heart rate and stress from the phone camera using PPG. Falls back to manual entry if the scan fails.
- **Vitals Monitor**: manual + wearable BP, SpO2, glucose, temperature with trend analysis.
- **Symptom Checker**: AI-guided triage.
- **Document Analyzer**: upload a scan or prescription; AI extracts findings and flags concerns.
- **Nutrition Advisor**: personalised meal logging with calories, protein, fiber, sodium, potassium totals against a daily goal.
- **Wellness Tracker**: mood, sleep, mindfulness.

## Map My Journey
Real-time journey tracking for outings. Set origin and destination, share a public journey link (/j/<token>), and guardians see live progress. Route deviation and inactivity trigger alerts. **Safe Zones** are geofenced circles (home, park, temple); leaving a safe zone sends a guardian alert with a 30-minute cooldown.

## Subscriptions and Pricing
Four tiers:
- **Free** — SOS, Emergency Profile, Basic Vitals, Ambulance booking, 1 guardian.
- **Basic (₹99/month)** — adds Tablets, Activity, Vault, Services; up to 3 guardians.
- **Pro (₹199/month)** — adds all Health Tools (Symptom Checker, Document Analyzer, Face Scan, Nutrition, Vitals trends, Geofencing, PDF Export); up to 5 guardians.
- **Premium+** — adds Financial Healthcare (expense tracking with voice notes and AI bill scanning); up to 10 guardians. Currently invite-only via waitlist.
Payments are processed at **futurewave.in/pay** (Razorpay). After payment the app confirms the upgrade automatically. Coupon codes can be applied at checkout.

## Notifications
System notifications appear in the bell icon in the header. Read/unread state is user-controlled. Notifications older than 48 hours are cleaned up automatically. Push notifications work in the background via a service worker with VAPID keys — supported on Android and desktop; iOS requires the app to be installed to the home screen (PWA).

## Voice Assistant ("Hey Check-iN")
Tap the floating microphone (bottom-right, above SOS). Ask a question aloud — the app understands your personal health status for today (medications, nutrition, check-ins, appointments, passport score) and general product/how-to questions. Answers are spoken back in an Indian voice. Speech recognition runs on-device; only the final text query is sent to the server. Available to all users.

## Privacy and Security
- All personal data is protected by Postgres row-level security — you only see your own data (and, if you're a guardian, only the wards who accepted your nomination).
- Vault files are stored in a private bucket with time-limited signed URLs.
- The Vault PIN is stored as an encrypted hash; recovery goes through nominee escrow.
- Emergency Profile is intentionally public (via opaque token) so first responders can read it — you control what fields it exposes.
- You can request data export or deletion from **Settings → Privacy**.

## Troubleshooting
- **OTP not received**: check the phone number and network, request a new code after 30 seconds. If MSG91 delivery is failing you'll see a specific error message.
- **Guardian didn't get my SOS**: confirm they've accepted the nomination and appear in your Guardian tab with status "Active". Guardians with pending/expired nominations don't receive alerts.
- **Medication alarm didn't ring**: check that battery saver / Do Not Disturb isn't blocking the app, and that Sleep Mode / Nap Mode isn't active in Settings.
- **Payment succeeded but plan didn't upgrade**: the Razorpay webhook can take a minute; pull-to-refresh the Subscription page. If still stuck, use Contact Us.
- **Anything else**: open **Help** in the app, or use **Contact Us** to reach support.
`;
