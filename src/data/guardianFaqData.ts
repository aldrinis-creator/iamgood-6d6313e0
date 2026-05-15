// Guardian-facing FAQ data — separate from Ward FAQ.
// Last updated: 2026-05-11

import type { FaqSection } from "./faqData";

export const GUARDIAN_FAQ_VERSION = "2026-05-15";

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
        question: "What is the Today's Appointments strip?",
        answer: "It shows the Ward's upcoming appointments for the day so you can prepare or accompany them."
      },
      {
        question: "Why does my Ward's app chime but mine doesn't?",
        answer: "Local audio alerts (check-in chimes, low-battery beeps, distress tones) are restricted to the Ward's device. As a Guardian you receive push notifications and on-screen alerts instead."
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
        answer: "SOS (highest priority), Missed Check-In, Low Battery (Ward's phone), Medication Missed, Geofence Exit (Safe Zones), Journey Deviation, and Fall Detected."
      },
      {
        question: "What should I do when an SOS arrives?",
        answer: "Call the Ward immediately. The active SOS banner shows their last known location and a one-tap 'Open in Maps' link. If unreachable, contact emergency services (112 in India) or the Ward's other guardians."
      },
      {
        question: "Can I cancel a false-alarm SOS?",
        answer: "Only the Ward can resolve their own SOS event. You will see the resolution status sync in real-time once they tap 'I'm Safe'."
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
];
