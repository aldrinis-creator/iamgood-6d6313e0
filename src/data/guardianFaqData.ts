// Guardian-facing FAQ data — separate from Ward FAQ.
// Last updated: 2026-05-27

import type { FaqSection } from "./faqData";

export const GUARDIAN_FAQ_VERSION = "2026-05-27";

export const guardianFaqSections: FaqSection[] = [
  {
    title: "Getting Started as a Guardian",
    icon: "shield-check",
    items: [
      {
        question: "What is a Guardian on Check-iN?",
        answer: "A Guardian is a trusted family member or responder nominated by a Ward (the protected person). You receive their safety alerts, can view their health summaries, and act in emergencies. You are NOT the protected person — the Ward is."
      },
      {
        question: "How do I become someone's Guardian?",
        answer: "The Ward nominates you from their app. You receive an SMS/email invite with a secure link, opt in explicitly, and verify with a 6-digit OTP. Nominations expire in 72 hours if unanswered."
      },
      {
        question: "Can I monitor more than one Ward?",
        answer: "Yes — up to 3 Wards across all your nominations. Each Ward must nominate you separately and you must accept each invite."
      },
      {
        question: "Who is the 'Primary Guardian'?",
        answer: "Each Ward marks one of their guardians as Primary. If you see a 'Primary' badge against your name in the Wards tab, it means that Ward has chosen you as their primary responder. The Ward themselves is never your guardian."
      },
    ],
  },
  {
    title: "Switching Between Wards",
    icon: "user",
    items: [
      {
        question: "How do I switch between my Wards?",
        answer: "Use the Ward Picker at the top of the Guardian Dashboard. Your selection is remembered across the app — alerts, reports, appointments and the Hospital Visit kit all follow the selected Ward."
      },
      {
        question: "Will I miss alerts from other Wards while one is selected?",
        answer: "No. Push notifications and the Alerts inbox aggregate across all your Wards. The Ward Picker only changes the focused dashboard view."
      },
    ],
  },
  {
    title: "Reading the Dashboard",
    icon: "heart",
    items: [
      {
        question: "What does the Health Score ring show?",
        answer: "It is a 0–100 daily score across 7 categories (vitals, activity, sleep, nutrition, medication adherence, mental wellness, hydration). Tap the ring to see category breakdowns."
      },
      {
        question: "What is the 'Last Active' tile?",
        answer: "It shows how long it has been since your Ward last interacted with their phone (any tap, scroll or app action sends a quiet heartbeat). The tile escalates automatically: under 15 min it stays neutral, ≥15 min turns amber, ≥30 min turns red, ≥45 min starts flashing red, and at ≥60 min a popup appears asking you to check on them. The tile auto-refreshes every 10 minutes and whenever you return to the tab."
      },
      {
        question: "When is the inactivity escalation suppressed?",
        answer: "Automatically — whenever the Ward is inside their Sleep window or has Checked Out (Vacation Mode). No colour escalation, no flashing, and no 1-hour popup will fire during those periods. Normal monitoring resumes when they wake or end their Check-Out."
      },
      {
        question: "Will the 1-hour inactivity popup show again if I dismiss it?",
        answer: "Dismiss hides it for that inactivity episode only. If your Ward becomes active again and later crosses 60 minutes of inactivity afresh, the popup can reappear. It is also per-Ward — switching Wards in the Ward Picker re-evaluates."
      },
      {
        question: "What is the Today's Appointments strip?",
        answer: "It shows the Ward's upcoming appointments for the day so you can prepare or accompany them."
      },
      {
        question: "Why does my Ward's app chime but mine doesn't?",
        answer: "Local audio alerts (check-in chimes, low-battery beeps, distress tones) are restricted to the Ward's device. As a Guardian you receive push notifications and on-screen alerts instead."
      },
      {
        question: "Why didn't any alerts fire while I was logging in?",
        answer: "While the login/OTP flow is in progress, all alerts, chimes and overlays are intentionally suppressed so nothing jumps in front of the auth screen. Normal alerting resumes the moment you finish signing in."
      },
    ],
  },
  {
    title: "Reports",
    icon: "file-text",
    items: [
      {
        question: "What is the Hospital Visit / Admission Kit?",
        answer: "A one-tap PDF bundle containing the Ward's Aadhaar, PAN, Insurance card (primary & secondary), ID photo, vitals, allergies, chronic conditions and primary guardian contact. Open it from Reports → Hospital Visit. Share via WhatsApp generates a secure 24-hour link."
      },
      {
        question: "What if a document is missing in the Admission Kit?",
        answer: "Use the 'Nudge' button on the Hospital Visit tab. The Ward gets an in-app notification asking them to upload the missing ID or insurance document."
      },
      {
        question: "What other reports are available?",
        answer: "Adherence (medications), Appointments, Journeys (Map My Journey history with distance & breaks), Vitals trends, and Health Passport history. All exportable as branded PDFs."
      },
    ],
  },
  {
    title: "Responding to Alerts",
    icon: "alert-triangle",
    items: [
      {
        question: "What types of alerts will I receive?",
        answer: "SOS (highest priority), Missed Check-In, Inactivity (≥60 min of no app activity, suppressed during Sleep/Check-Out), Low Battery (Ward's phone), Medication Missed, Geofence Exit (Safe Zones), Journey Deviation, and Fall Detected."
      },
      {
        question: "What should I do when an SOS arrives?",
        answer: "Call the Ward immediately. The active SOS banner shows their last known location and a one-tap 'Open in Maps' link. If unreachable, contact emergency services (112 in India) or the Ward's other guardians."
      },
      {
        question: "How quickly are missed medication alerts sent to me?",
        answer: "The Ward gets reminders from the scheduled time (T+0) through T+50 min. If they still haven't logged the dose, you are alerted between roughly T+60 and T+75 min so you can nudge them. After a 1-hour cutoff the dose is marked missed in the adherence report."
      },
      {
        question: "Why did I get only one alert for several medications?",
        answer: "Medications scheduled at the same time are intentionally consolidated into a single overlay and a single audio alert on the Ward's side, and a single push to you — to avoid alert fatigue."
      },
      {
        question: "Can I cancel a false-alarm SOS?",
        answer: "Only the Ward can resolve their own SOS event. You will see the resolution status sync in real-time once they tap 'I'm Safe'."
      },
    ],
  },
  {
    title: "Notifications & Push",
    icon: "bell",
    items: [
      {
        question: "How does the Notifications inbox work?",
        answer: "Every alert (SOS, missed check-in, inactivity, geofence, medication, low battery, fall) is mirrored into your in-app Notifications inbox. You can mark items as read; entries auto-clean after 48 hours so the inbox doesn't grow stale."
      },
      {
        question: "Why don't I see duplicate alerts for the same event?",
        answer: "Notifications are de-duplicated server-side — repeated triggers for the same SOS, missed check-in or inactivity episode collapse into a single entry."
      },
      {
        question: "How do push notifications reach me when the app is closed?",
        answer: "Check-iN registers a service worker with Web Push (VAPID). A 1-minute server-side cron evaluates pending alerts, so even if your phone is asleep or the browser is closed, the push fires and lands on your lock screen."
      },
    ],
  },
  {
    title: "Nudging Your Ward",
    icon: "bell",
    items: [
      {
        question: "What is a Nudge?",
        answer: "A polite, in-app reminder you can send to your Ward — for missing ID/insurance documents, missed check-ins, overdue medication refills, or upcoming appointments. Nudges are rate-limited to avoid annoyance."
      },
    ],
  },
  {
    title: "Ward Limits & Subscription",
    icon: "crown",
    items: [
      {
        question: "How many Wards can I monitor?",
        answer: "Each Ward's plan determines whether they can add you: Free (1 guardian), Basic ₹99/mo (3 guardians), Pro ₹199/mo (5 guardians). On your side, you can be the guardian for up to 3 different Wards regardless of plan."
      },
      {
        question: "Do I need to pay anything as a Guardian?",
        answer: "No — the Ward's subscription covers all guardian features. You only need to pay if you also use Check-iN as a Ward yourself."
      },
    ],
  },
  {
    title: "Privacy",
    icon: "shield",
    items: [
      {
        question: "What can I see about my Ward?",
        answer: "Health Score, vitals trends, medication adherence, check-in status, location during active SOS or Journey, appointments, and ID/insurance documents the Ward has chosen to share via the Admission Kit."
      },
      {
        question: "What can I NOT see?",
        answer: "Private chats, Medical Vault contents (unless you are a Vault Nominee in a released claim), exact real-time location outside SOS/Journey windows, and any document the Ward has not uploaded."
      },
      {
        question: "Can I edit my Ward's data?",
        answer: "No. Guardians have read-only access. Only the Ward can change their own settings, schedules, medications and documents."
      },
    ],
  },
  {
    title: "Medication Refills",
    icon: "pill",
    items: [
      {
        question: "Can I see when my Ward is running low on medication?",
        answer: "Yes — the Guardian Dashboard surfaces low-stock medications (under the Ward's chosen threshold, default 5 pills). You can send a Nudge prompting them to refill."
      },
      {
        question: "Can I place a refill order on my Ward's behalf?",
        answer: "Refill orders are placed from the Ward's app, but require a Doctor or Hospital reference attached to the prescription. Jan Aushadhi generic alternatives are synced into the order cart automatically when available."
      },
    ],
  },
  {
    title: "Your Settings",
    icon: "settings",
    items: [
      {
        question: "Can I set Quiet Hours?",
        answer: "Yes — set a do-not-disturb window in Settings → Notifications. SOS alerts always break through Quiet Hours; routine notifications are deferred."
      },
      {
        question: "Which channels do I receive alerts on?",
        answer: "Push (browser/app), email and WhatsApp. Toggle each channel in Settings → Notifications."
      },
      {
        question: "What's in my Guardian profile?",
        answer: "Identity only — your name, phone, avatar and emergency contact. Guardians do not have a health record, ID/insurance vault, medications list or sub-guardians in their own profile. All of that lives on the Ward's side."
      },
    ],
  },
  {
    title: "Subscriptions & Coupons",
    icon: "crown",
    items: [
      {
        question: "Do I pay for being a Guardian?",
        answer: "No. Guardian access is fully covered by your Ward's subscription. You only pay if you also use Check-iN as a Ward yourself."
      },
      {
        question: "Where does my Ward pay for their plan?",
        answer: "Checkout opens futurewave.in/pay (Razorpay). After successful payment the confirmation syncs back to the app within seconds — you'll see the updated plan reflected in their Ward profile."
      },
      {
        question: "Can my Ward use a coupon code?",
        answer: "Yes. Coupons are validated server-side at checkout, typically single-use per account, and apply an immediate discount on the Razorpay page."
      },
    ],
  },
  {
    title: "Account",
    icon: "user",
    items: [
      {
        question: "How do I stop being someone's Guardian?",
        answer: "For your safety and the Ward's, only the Ward can revoke a guardian. Ask them to remove you from their Settings → Guardians. Your access ends immediately upon revocation."
      },
      {
        question: "How do I contact support?",
        answer: "Email checkin_support@futurewave.in or use Help → Contact Us inside the app."
      },
    ],
  },
  {
    title: "Devices & Compatibility",
    icon: "settings",
    items: [
      {
        question: "Does my Ward need a smartphone for Check-iN to work?",
        answer: "Yes. Check-iN runs on the Ward's smartphone (Android 8+ or iOS 14+) to capture vitals, location, check-ins and SOS triggers. Without it, the Guardian side has nothing to monitor."
      },
      {
        question: "Which platforms does the Guardian app support?",
        answer: "Check-iN is a Progressive Web App (PWA) that works on Android, iOS, Windows and Mac via any modern browser (Chrome, Safari, Edge). Install it to your home screen for push notifications and an app-like experience."
      },
      {
        question: "Will the app drain my Ward's battery?",
        answer: "Background location and check-in services are tuned to minimise drain — typically 3–6% per day on modern phones. Active SOS or Map My Journey sessions use more, so the Ward also gets low-battery warnings at 30% and 10%."
      },
      {
        question: "What if my Ward's phone dies or loses signal?",
        answer: "You receive a Low Battery push at 30% and 10%. If the phone goes fully offline, missed check-ins escalate to you within the configured window. The last known location is preserved from the most recent sync."
      },
    ],
  },
  {
    title: "Emergency Response",
    icon: "alert-triangle",
    items: [
      {
        question: "Can I call emergency services directly from the app?",
        answer: "Yes — the active SOS banner shows a one-tap dialer for India's 112 emergency number, alongside the Ward's last known location and primary care contacts."
      },
      {
        question: "What happens if it turns out to be a false alarm?",
        answer: "Only the Ward can mark themselves 'I'm Safe' to resolve their own SOS. The resolution syncs to all guardians in real-time. False alarms are not penalised — better safe than sorry."
      },
      {
        question: "Can I book an ambulance for my Ward?",
        answer: "Yes. From the Guardian Dashboard, open Services → Book Ambulance. The Ward's emergency profile (blood group, allergies, primary contact) is auto-attached to the request."
      },
    ],
  },
  {
    title: "Sharing with Doctors",
    icon: "file-text",
    items: [
      {
        question: "Can I share my Ward's reports with their doctor?",
        answer: "Yes — every report (Adherence, Vitals, Health Passport, Hospital Visit Kit) exports to a branded PDF. Use Share → WhatsApp or download and email. Hospital Visit Kit shares generate a secure 24-hour link."
      },
      {
        question: "Can I bring the Hospital Visit Kit to an in-person appointment?",
        answer: "Yes. Generate the PDF in advance, save it to your phone, or print a copy. It contains all IDs, insurance, vitals, allergies and chronic conditions in one document."
      },
    ],
  },
  {
    title: "Privacy & Data Security",
    icon: "shield",
    items: [
      {
        question: "Is my Ward's health data secure?",
        answer: "Yes. All data is encrypted in transit (TLS) and at rest. Medical Vault contents use additional client-side encryption. We comply with India's Digital Personal Data Protection (DPDP) Act."
      },
      {
        question: "Who else can see my Ward's data?",
        answer: "Only the Ward, their accepted guardians (within the access scope they grant), and Check-iN's automated alerting systems. Data is never sold, never shared with advertisers, and never used to train AI models without explicit consent."
      },
      {
        question: "What happens to the data if my Ward deletes their account?",
        answer: "All personal data is permanently deleted within 30 days, including vitals, location history, vault contents, and your guardian linkage. Anonymised aggregate metrics may be retained for service improvement."
      },
    ],
  },
];
