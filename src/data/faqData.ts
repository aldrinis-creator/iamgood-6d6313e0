// FAQ data — update this file whenever FAQs change.
// Last updated: 2026-07-09


export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  icon: string; // emoji/icon identifier
  items: FaqItem[];
}

export const FAQ_VERSION = "2026-07-09";

export const faqSections: FaqSection[] = [
  {
    title: "Daily Check-In",
    icon: "heart",
    items: [
      {
        question: "What is the Daily Check-In feature?",
        answer: "Daily Check-In is a safety feature where you confirm you're okay at scheduled times (7 AM, 12 PM, 7 PM). Tap the beating heart on the home screen. If you miss multiple check-ins, the app alerts your nominated guardians to ensure your safety."
      },
      {
        question: "What happens if I miss a check-in?",
        answer: "After missing a check-in, you'll receive up to 3 reminders with audio alerts and vibrations over 30 minutes. If you still don't respond, an SOS alert is automatically sent to your guardians with your location and medical information."
      },
      {
        question: "Can I customize check-in times?",
        answer: "Currently, check-in times are fixed at 7 AM, 12 PM, and 7 PM. However, you can use Sleep Mode to pause check-ins during your sleep hours, and Check-Out (Vacation Mode) to disable them entirely for a set period."
      },
    ],
  },
  {
    title: "Sleep Mode",
    icon: "moon",
    items: [
      {
        question: "What is Sleep Mode?",
        answer: "Sleep Mode pauses check-in reminders during your designated sleep hours so you're not disturbed. By default, it's set from 10 PM to 6 AM."
      },
      {
        question: "How do I configure Sleep Mode?",
        answer: "Go to Settings → Check-In tab → Sleep Mode Settings. Set your typical sleep and wake times. Check-ins during these hours will be skipped."
      },
    ],
  },
  {
    title: "Check-Out (Vacation Mode)",
    icon: "calendar",
    items: [
      {
        question: "What is Check-Out mode?",
        answer: "Check-Out mode allows you to temporarily disable all check-in reminders for a specific period, such as when you're on vacation or traveling."
      },
      {
        question: "Can I notify my guardians when I check out?",
        answer: "Yes! When setting up Check-Out, you can choose to automatically notify your guardians that you'll be unavailable during that period."
      },
    ],
  },
  {
    title: "Guardians",
    icon: "shield",
    items: [
      {
        question: "What is a Guardian?",
        answer: "A Guardian is a trusted contact you nominate to receive emergency alerts. They can be family caregivers, friends, or neighbours. They receive SOS alerts, missed check-in notifications, and can optionally be granted access to your Secret Vault."
      },
      {
        question: "Is adding a Guardian mandatory?",
        answer: "Yes, Guardian 1 (your primary guardian) is mandatory during sign-up. This ensures you always have at least one emergency contact who will receive SOS alerts. You can add up to 4 more optional guardians."
      },
      {
        question: "How many Guardians can I have?",
        answer: "You can nominate up to 5 Guardians. Guardian 1 is required, while Guardians 2-5 are optional. We recommend having at least 2-3 for reliable coverage."
      },
      {
        question: "How does the Guardian nomination process work?",
        answer: "When you add a Guardian, they receive an SMS/WhatsApp invitation along with a branded email invitation. Using a 'silent consent' model, they have a one-hour window to reject the nomination. If they don't reject, they are automatically accepted."
      },
      {
        question: "How am I notified when a Guardian responds?",
        answer: "You receive an SMS and WhatsApp notification immediately when a Guardian accepts or declines your nomination. You can also check the guardian status in Settings → Guardians."
      },
      {
        question: "What if a Guardian doesn't respond?",
        answer: "The app sends daily reminders to pending Guardians. If they don't respond within the required window, the nomination expires and you'll need to add them again or choose someone else."
      },
      {
        question: "Where can I see my Primary Guardian?",
        answer: "Your Primary Guardian (Guardian 1) is prominently displayed in the My Profile 'View Details' tab. You can manage all your guardians in Settings → Guardians."
      },
      {
        question: "How many wards can a Guardian manage?",
        answer: "Each Guardian can manage up to 3 wards (users). If a Guardian already has 3 accepted wards, you'll be prompted to choose a different Guardian."
      },
    ],
  },
  {
    title: "Guardian Portal",
    icon: "shield-check",
    items: [
      {
        question: "What is the Guardian Portal?",
        answer: "The Guardian Portal is a dedicated dashboard for guardians to monitor the well-being of people they care for. Guardians can view real-time check-in statuses, medication adherence, and respond to emergencies — all from a single screen."
      },
      {
        question: "How do I access the Guardian Portal?",
        answer: "On the login page, toggle to 'Guardian' role. Once logged in, you'll see a dashboard listing all users who have nominated you as their guardian, along with their latest check-in and medication statuses."
      },
      {
        question: "What actions can a Guardian take?",
        answer: "Guardians can: track SOS alerts with location maps, make 'flash calls' to the user, book an ambulance with simulated tracking, send a 'ping' to nudge users to check in, and view emergency-relevant profile fields (blood type, allergies, conditions) with direct call buttons."
      },
      {
        question: "Is user privacy protected in the Guardian Portal?",
        answer: "Yes. Guardian access is strictly limited via a secure function that only exposes emergency-relevant profile fields. Personal identity documents and sensitive health metrics are hidden. SOS exchanges, pings, and ambulance requests are automatically deleted after 72 hours."
      },
    ],
  },
  {
    title: "Emergency SOS",
    icon: "alert-triangle",
    items: [
      {
        question: "How does the SOS feature work?",
        answer: "You can trigger an SOS manually by pressing the floating SOS button (always visible at the bottom-right corner), or it triggers automatically after missed check-ins or a detected fall. A 30-second countdown gives you time to cancel if triggered accidentally."
      },
      {
        question: "What information is shared in an SOS alert?",
        answer: "SOS alerts include your name, current location (Google Maps link), blood type, allergies, medical conditions, insurance information, and your doctor's contact details — all from your profile."
      },
      {
        question: "How can Guardians respond to an SOS?",
        answer: "Guardians can reply 'SAFE' or 'OK' via SMS/WhatsApp to confirm you're okay and close the alert. All other Guardians are then notified that the alert has been resolved. Guardians can also track the SOS on a map via the Guardian Portal."
      },
      {
        question: "Can I share my Emergency Profile publicly?",
        answer: "Yes! Go to Settings → Privacy → Public Emergency Profile. When enabled, a unique shareable link is generated. Anyone with the link can view your emergency-relevant details (blood type, allergies, conditions, emergency contacts) without needing an account."
      },
    ],
  },
  {
    title: "Appointments",
    icon: "calendar-clock",
    items: [
      {
        question: "How do appointments work?",
        answer: "Schedule appointments with mandatory Start Date and Start Time. End Date and End Time are optional. Appointments display in a 12-hour AM/PM format with relative date labels like 'Today' and 'Tomorrow'."
      },
      {
        question: "Can I set recurring appointments?",
        answer: "Yes! The system supports Daily, Weekly, and Monthly recurrence patterns. Set it once and all future instances are created automatically."
      },
      {
        question: "How do appointment reminders work?",
        answer: "Each appointment supports dual snoozeable alerts with customizable lead times. The navigation bar dynamically turns the Appointments link red whenever an appointment is scheduled for the current day."
      },
      {
        question: "What is the 'Due Today' filter?",
        answer: "The 'Due Today' filter shows only today's appointments with a dynamic count badge. You can also book 'In-person' rides directly from appointment cards."
      },
      {
        question: "How does Doctor Appointment Confirmation work?",
        answer: "After creating an appointment, each card shows a 'Share with Doctor' button. This generates a unique, shareable link that you can send to your doctor via WhatsApp, SMS, or email. The doctor can confirm, propose a reschedule, or decline — with optional notes."
      },
      {
        question: "Can the doctor reschedule via the confirmation link?",
        answer: "Yes! If the doctor selects 'Propose Reschedule', they can suggest a new date and time along with a note. You'll see the proposed date/time displayed on your appointment card."
      },
      {
        question: "Do I receive an email confirmation when I create an appointment?",
        answer: "Yes! A branded appointment confirmation email is automatically sent to your registered email address when you create a new appointment. The email includes the appointment title, date, time, and doctor's name."
      },
    ],
  },
  {
    title: "Map My Journey",
    icon: "map-pin",
    items: [
      {
        question: "What is Map My Journey?",
        answer: "Map My Journey is a safety feature that lets you share your real-time location with your guardians while traveling. Set a destination, start the journey, and your guardians can track your progress on a map."
      },
      {
        question: "How do I start a journey?",
        answer: "Go to Map My Journey from the navigation menu. Search for or select a destination, choose your transport mode, and tap 'Start Journey'. Your guardians will be notified that you're traveling."
      },
      {
        question: "What are Saved Destinations?",
        answer: "Frequently visited places are automatically saved for quick access. You can also mark destinations as favorites. The app tracks how many times you've visited each place."
      },
      {
        question: "What are journey check-ins?",
        answer: "While on a journey, the app periodically prompts you to confirm you're okay. These check-ins send your current location to guardians in real-time."
      },
      {
        question: "Can my Guardian track my journey?",
        answer: "Yes! Guardians can view your active journey on their Guardian Dashboard, including your current location, destination, estimated duration, and check-in responses."
      },
    ],
  },
  {
    title: "My Profile",
    icon: "user",
    items: [
      {
        question: "Why am I being asked to complete my profile?",
        answer: "After signing up, you'll be prompted to add health information. This data (blood type, allergies, medical conditions, insurance) is shared with guardians during SOS emergencies and can be life-saving."
      },
      {
        question: "Can I skip the profile update prompt?",
        answer: "Yes, click 'Remind Me Later' to dismiss. You'll receive up to 2 reminders over 48 hours, after which prompts stop. However, we strongly recommend completing your profile for your safety."
      },
      {
        question: "Can I store my identity documents (Aadhaar/PAN)?",
        answer: "Yes! The profile supports scanning and storage of Aadhaar and PAN identity cards using AI to extract card numbers. Card images are stored in a private bucket with owner-only access."
      },
      {
        question: "Where can I update my profile later?",
        answer: "Go to My Profile from the menu. The 'Edit Profile' tab lets you update all your health, insurance, and identity information."
      },
    ],
  },
  {
    title: "Notifications & Alerts",
    icon: "bell",
    items: [
      {
        question: "What types of alerts does the app send?",
        answer: "The app sends audio alerts (gentle chimes), vibration patterns, and push notifications for check-in reminders, medication times, and appointment alerts. These work even when the app is in the background."
      },
      {
        question: "Why are alarms not sounding?",
        answer: "Ensure notification permissions are granted in your browser/device settings. For best results, install the app as a PWA. Alarms require the service worker to be active — try refreshing the page if notifications aren't working."
      },
      {
        question: "How do medication alarms work?",
        answer: "Medication reminders trigger at your scheduled times with audio, vibration, and push notifications. You can snooze them and preview/change alarm sounds in the Tablets → Alarm Settings section."
      },
      {
        question: "How do check-in alarms work?",
        answer: "Check-in reminders trigger at 7 AM, 12 PM, and 7 PM (outside Sleep Mode hours). If you don't respond, you'll receive up to 3 audio reminders over 30 minutes, then an automatic SOS is triggered."
      },
      {
        question: "Can I mute audio alerts?",
        answer: "Yes! Go to Settings → Alerts → Audio Alerts and toggle it off. You'll still receive vibration and push notifications."
      },
      {
        question: "How do push notifications work?",
        answer: "Push notifications are delivered via your browser's Web Push API even when the app is closed. Go to Settings → Alerts to enable or disable push notifications. You'll be asked for permission the first time you sign in."
      },
    ],
  },
  {
    title: "Email Notifications",
    icon: "mail",
    items: [
      {
        question: "What email notifications does Check-iN send?",
        answer: "Check-iN sends branded email notifications for key events: a Welcome email when you create your account, Appointment Confirmations when you schedule appointments, and Guardian Invitation emails when you nominate a new guardian."
      },
      {
        question: "Can I unsubscribe from email notifications?",
        answer: "Yes! Every email includes an unsubscribe link at the bottom. Clicking it takes you to a confirmation page. Once unsubscribed, you won't receive any further email notifications from Check-iN."
      },
      {
        question: "I'm not receiving email notifications — what should I do?",
        answer: "Check your spam or junk folder first. Emails are sent from noreply@www.futurewave.in. If you previously unsubscribed, you won't receive emails until you re-register. Contact support if the issue persists."
      },
    ],
  },
  {
    title: "Medication Tracker & Orders",
    icon: "pill",
    items: [
      {
        question: "What is the Medication Tracker?",
        answer: "The Medication Tracker helps you manage your daily medications. Add your medicines with scheduled times, and the app will remind you with persistent alarms — even when the app is closed."
      },
      {
        question: "Can I track multiple doses per day?",
        answer: "Yes! You can set multiple times for each medication and track whether you've taken each dose. The weekly medication history shows your adherence pattern."
      },
      {
        question: "How does the Order Medicines feature work?",
        answer: "In the Tablets tab, select medications via checkboxes to generate an editable order table. Share orders with pharmacies via WhatsApp, Email, or PDF. Prescriptions are securely attached using private storage with 15-minute signed URLs."
      },
      {
        question: "Does the app check for banned medicines?",
        answer: "Yes! The app automatically flags medications found in the Indian banned medicines registry and suggests bioequivalent alternatives when available."
      },
      {
        question: "Can I import medicines from a prescription scan?",
        answer: "Yes! Use the Document Analyzer to scan a prescription, then import the detected medications directly into your Tablets list."
      },
      {
        question: "What is the Stock Tracker and how does it work?",
        answer: "The Stock Tracker monitors how many pills you have remaining. Every time you mark a dose as 'Taken', the pill count automatically decreases by one. You can set the total quantity when adding or editing a medication."
      },
      {
        question: "How do Low-Stock Alerts work?",
        answer: "When your remaining pills drop to or below your low-stock threshold (default: 5 pills), you'll see a prominent warning banner. Each medication card shows a colour-coded pill count — green when well-stocked, orange when low, red when out."
      },
      {
        question: "How do I refill my medication stock?",
        answer: "Tap the 'Refill' button on any medication card to update the pill count after purchasing new supplies. You can also use the 'Order Medicines' feature to share your order with a pharmacy before refilling."
      },
      {
        question: "Can I change the low-stock threshold?",
        answer: "Yes! When adding or editing a medication, expand the 'Stock Settings' section to set a custom low-stock threshold per medication. The default is 5 pills."
      },
      {
        question: "Does my Guardian get notified about low stock?",
        answer: "Yes! Your guardians can see which medications are running low on their Guardian Dashboard. Low-stock medications are also highlighted in the automated weekly health reports."
      },
    ],
  },
  {
    title: "Jan Aushadhi — Affordable Medicines",
    icon: "indian-rupee",
    items: [
      {
        question: "What is Jan Aushadhi?",
        answer: "Jan Aushadhi is an Indian government initiative providing quality generic medicines at affordable prices. Check-iN integrates a Jan Aushadhi alternative finder to help you save money on medications."
      },
      {
        question: "How do I find Jan Aushadhi alternatives?",
        answer: "In the Tablets section, tap the 'Jan Aushadhi Alternatives' button on any medication card. The app searches for equivalent generic medicines available at Jan Aushadhi Kendras, showing the MRP and potential savings."
      },
      {
        question: "Can I find nearby Jan Aushadhi stores?",
        answer: "Yes! The Jan Aushadhi feature includes a store locator that shows nearby Jan Aushadhi Kendras with their address, phone number, and distance from your location."
      },
    ],
  },
  {
    title: "Nutrition & Meal Advisor",
    icon: "utensils",
    items: [
      {
        question: "What is the Nutrition & Meal Advisor?",
        answer: "A personalized dietary guidance feature in the 'Nutrition' tab within My Health. It provides AI-driven meal suggestions, photo-based meal analysis, post-workout recovery analysis, and symptom-based meal planning."
      },
      {
        question: "What is the Health Persona setup?",
        answer: "A one-time setup that captures your health goals, dietary framework (vegetarian, vegan, etc.), medical considerations, activity level, and nutritional focus. This personalizes all nutrition recommendations."
      },
      {
        question: "Can I photograph my meals for analysis?",
        answer: "Yes! Take a photo of your meal and the AI estimates calories, macronutrients, and provides health feedback. Benefits are highlighted in green and potential issues in red."
      },
      {
        question: "Does it check for food-drug interactions?",
        answer: "Yes! The system cross-references your meal content with your current medications, wellness scores, and face scan results to flag any potential food-drug interactions."
      },
      {
        question: "What is post-workout recovery analysis?",
        answer: "After an activity session, the advisor cross-references your meal content with real-time activity data and wellness data to recommend optimal recovery nutrition."
      },
    ],
  },
  {
    title: "Calorie & Meal Tracker",
    icon: "flame",
    items: [
      {
        question: "What is the Calorie Tracker?",
        answer: "The Calorie Tracker helps you log your daily meals and monitor your calorie and macronutrient intake. View your daily totals for calories, protein, carbs, fats, and fiber against your personalized goals."
      },
      {
        question: "How do I log a meal?",
        answer: "Go to My Health → Calories tab. Tap 'Log Meal' and enter the meal name, type (Breakfast, Lunch, Dinner, or Snack), and individual food items with their nutritional values. You can also use the AI Nutrition Advisor to auto-analyze meals from photos."
      },
      {
        question: "Can I set a daily calorie goal?",
        answer: "Yes! Your daily calorie goal is set in your Nutrition Persona (Health Persona setup). The Calorie Tracker displays your progress against this goal with a visual progress bar."
      },
      {
        question: "Can I view my meal history?",
        answer: "Yes! The Calorie Tracker shows all logged meals for the selected date, organized by meal type. You can navigate between dates to review your eating patterns."
      },
    ],
  },
  {
    title: "Wellness Score & Awards",
    icon: "trophy",
    items: [
      {
        question: "What is the Wellness Score?",
        answer: "An AI-powered health assessment that analyzes your vitals — Blood Pressure, SpO2, Temperature, Blood Sugar, Heart Rate, Respiratory Rate, and Hydration — to generate an overall wellness score out of 100."
      },
      {
        question: "How is the Wellness Score calculated?",
        answer: "Enter your vitals manually or load data from your latest Face Scan. Our AI analyzes each measurement against standard medical reference ranges and provides an NHS-inspired classification: Excellent (90+), Very Good (80+), Good (70+), Fair (60+), Needs Attention (50+), or Urgent Care Needed (<50)."
      },
      {
        question: "What are 'Normal' buttons next to each vital?",
        answer: "Each vital input has a 'Normal' button that auto-fills standard healthy values (e.g., BP 120/80, SpO2 98%). Replace them with your actual readings for an accurate score."
      },
      {
        question: "Can I use Face Scan data in my Wellness Score?",
        answer: "Yes! Click 'Load Face Scan Data' to auto-populate Heart Rate, Respiratory Rate, and Hydration from your latest scan. You can also load vitals from your previous assessment."
      },
      {
        question: "What are XP, Levels, and Streaks?",
        answer: "Each wellness check earns XP based on your score (10–100 XP). XP accumulates to level you up from 'Wellness Beginner' (Level 1) to 'Wellness Legend' (Level 10). Consecutive daily check-ups build a streak with bonus points every 3 days."
      },
      {
        question: "What are Loyalty Points and how do I earn them?",
        answer: "Earned from three sources: 1) Wellness Checks (1.5× your XP), 2) Medication Adherence (based on timing and snooze scores), and 3) Activity Sessions (points for steps and duration with bonuses at 5K and 10K steps). Points can be redeemed for prizes."
      },
      {
        question: "What badges can I earn?",
        answer: "There are 15 badges across categories: score-based (Bronze at 70+, Silver at 80+, Gold at 90+), streak milestones (3, 7, 14, 30 days), assessment count milestones (5, 10, 25, 50, 100), level-up achievements, and personal best records."
      },
      {
        question: "Can I share or export my Wellness Score?",
        answer: "Yes! Export a detailed PDF report or share via WhatsApp, email, etc. The report includes your score, analysis, diagnosis, and recommendations."
      },
      {
        question: "Can my Guardian see my Wellness Score?",
        answer: "Yes! You can configure wellness sharing in Settings. Guardians can view a summarized wellness overview and weekly wellness reports."
      },
      {
        question: "Is the Wellness Score a medical diagnosis?",
        answer: "No. The Wellness Score is for guidance only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a healthcare provider for health concerns."
      },
    ],
  },
  {
    title: "Health Tools",
    icon: "scan",
    items: [
      {
        question: "What is the Face Scan (Vitals Scan) feature?",
        answer: "Vitals Scan uses rPPG technology to estimate Heart Rate (BPM), Respiratory Rate, and Heart Rate Variability from a 30-second video of your face. Results persist across tab switches and can be auto-loaded into the Wellness Score."
      },
      {
        question: "Does the Face Scan work on mobile?",
        answer: "Yes! On mobile devices, the camera stream stays alive during tab switching. There's also a 'Record Video' fallback for mobile browsers that don't support direct camera access."
      },
      {
        question: "What is the Document Analyzer?",
        answer: "Upload medical documents like X-rays, lab reports, or prescriptions, and our AI will analyze and explain them in simple terms. Extracted medications can be imported directly into your Tablets list."
      },
      {
        question: "What is the Symptom Checker?",
        answer: "Describe your symptoms in a chat interface, and our AI will provide guidance on potential causes and whether you should seek medical attention. Note: This is for information only, not medical advice."
      },
      {
        question: "What is Tele-Consult?",
        answer: "Record audio or video of medical consultations, or start a video call with a room code. Our AI analyzes the recording to generate a structured transcript, summary, symptoms list, and recommendations — exportable as PDF."
      },
      {
        question: "What is the Doctor Visit Report?",
        answer: "An AI-generated comprehensive report you can share with your doctor before a visit. It compiles your recent vitals, wellness scores, medication list, activity data, meal logs, care journal entries, and medical history into a single PDF."
      },
      {
        question: "What is Emergency First Aid?",
        answer: "A quick-reference AI-powered guide for common emergency situations. Describe the situation, and the AI provides step-by-step first aid instructions. This is not a substitute for calling emergency services."
      },
      {
        question: "Is my consultation data private?",
        answer: "Absolutely. All consultation recordings and analyses are stored securely and only accessible by you. The AI analysis includes a medical disclaimer."
      },
    ],
  },
  {
    title: "Quick Visual Checks",
    icon: "scan",
    items: [
      {
        question: "What is Quick Visual Checks?",
        answer: "Quick Visual Checks is a Premium Plus suite of AI-powered visual analysis tools — Urine Analysis, Tongue Analysis, and Face Analysis — that let you screen common health indicators in seconds, right from your phone camera. Results are instant, with clear guidance on whether to monitor, see a doctor soon, or seek urgent care."
      },
      {
        question: "How does Urine Analysis work?",
        answer: "Capture a clear photo of your urine sample (cup) and, optionally, a 10-pad dipstick. Our AI evaluates colour, clarity, and the dipstick pads (glucose, protein, blood, leukocytes, ketones, pH, etc.) to flag abnormalities. For best results, use natural light, a white background, and capture within 60 seconds of dipping. Severe red-flags (e.g., visible blood, very high glucose) trigger a 'See a doctor urgently' banner."
      },
      {
        question: "How does Tongue Analysis work?",
        answer: "Take a well-lit, full-mouth-open photo of your tongue. The AI assesses colour (pale, red, purple), coating (white, yellow, thick/thin), texture, and surface markings to surface possible indicators of dehydration, digestive issues, vitamin deficiencies, or oral health concerns. This is a screening tool — not a diagnosis."
      },
      {
        question: "How does Face Analysis work?",
        answer: "Face Analysis uses your phone camera to estimate Heart Rate, SpO₂, and Stress Level via remote photoplethysmography (rPPG). Two modes are available: a quick photo mode for snapshot vitals, and a 30-second video mode for higher-confidence readings with HRV. Results can be auto-saved into your Wellness Score."
      },
      {
        question: "Are my photos stored?",
        answer: "By default, images are processed in-memory and discarded immediately after analysis — only the structured results are saved. If you opt in, you can save the photo to your Medical Vault for future reference. We never share your images with third parties."
      },
      {
        question: "When are my guardians auto-alerted?",
        answer: "If a Quick Visual Check detects a red-flag classified as 'Urgent' (e.g., signs of severe dehydration, gross haematuria, or very abnormal vitals), your primary guardian receives an SMS/WhatsApp alert with the result summary. 'See doctor soon' results notify only you — no guardian alert."
      },
    ],
  },
  {
    title: "Premium Plus & Smart Ring",
    icon: "crown",
    items: [
      {
        question: "What's included in Premium Plus?",
        answer: "Premium Plus includes everything in Premium — plus unlimited daily Check-iNs, the full Medical Vault, Wellness AI Insights, Safe Zones with geofencing, Fall Detection, and the new Quick Visual Checks suite (Urine, Tongue & Face Analysis). It also bundles the Smart Ring wearable for continuous vitals monitoring."
      },
      {
        question: "What is the Smart Ring and what does it measure?",
        answer: "The Smart Ring is a discreet wearable that continuously tracks ECG, Heart Rate, SpO₂, Blood Pressure trends, EDA (stress), and sleep stages. It supports multiple sports modes, step counting, gesture controls, and 24x7 mobile/satellite tracking for safety in low-coverage areas."
      },
      {
        question: "When will the Smart Ring ship?",
        answer: "The Smart Ring is in advanced development. Pre-register your email on the Premium Plus card and we'll notify you the moment it's available for shipping in your region."
      },
      {
        question: "What does ₹9,999/yr include?",
        answer: "The ₹9,999/year Premium Plus subscription includes a 1-year content & service subscription plus a one-time wearable charge for the Smart Ring (saving ₹5,000 vs the ₹14,999 MRP). From Year 2 onward, only the standard data/subscription charges apply — the ring is yours to keep."
      },
    ],
  },
  {
    title: "Past Medical History",
    icon: "clipboard-list",
    items: [
      {
        question: "What is Past Medical History?",
        answer: "A structured record of your medical past — including surgeries, hospitalizations, chronic conditions, injuries, and allergies. This data is used in Doctor Visit Reports and can be shared with healthcare providers."
      },
      {
        question: "What types of records can I add?",
        answer: "You can add records categorized as: Surgery, Hospitalization, Chronic Condition, Injury, Allergy, or Other. Each record includes details like doctor name, hospital, dates, treatment, medications, and advice."
      },
      {
        question: "Is my medical history included in reports?",
        answer: "Yes! Your past medical history is automatically included in the Doctor Visit Report, giving your doctor a comprehensive view of your health background."
      },
    ],
  },
  {
    title: "Wearables & Health Data",
    icon: "watch",
    items: [
      {
        question: "Can I connect Apple Health or Google Fit?",
        answer: "Yes! When running as a native app on iOS or Android (via Capacitor), the app can read Heart Rate, SpO2, Blood Pressure, Temperature, Blood Glucose, Respiratory Rate, and Steps. On the web/PWA version, you can manually enter readings."
      },
      {
        question: "What wearable data is supported?",
        answer: "Through Apple HealthKit and Google Health Connect: Heart Rate (BPM), SpO2 (%), Blood Pressure (mmHg), Temperature (°C/°F), Blood Glucose/CGM (mg/dL or mmol/L), Respiratory Rate, and daily Steps."
      },
      {
        question: "Is CGM (Continuous Glucose Monitor) data supported?",
        answer: "Yes, in the native app version. CGM data synced to Apple Health or Google Health Connect can be auto-populated into the Wellness Score. We support both mg/dL and mmol/L units."
      },
      {
        question: "What if I'm using the web/PWA version?",
        answer: "The web version works great for all features except direct wearable data reading. Manually enter vitals, use Face Scan for contactless measurements, or install the native app for automatic data syncing."
      },
    ],
  },
  {
    title: "Activity Tracker & Workout Plans",
    icon: "dumbbell",
    items: [
      {
        question: "What does the Activity Tracker measure?",
        answer: "Records sessions with Heart Rate, Steps, Distance, and Duration. Each completed session earns Loyalty Points: 1 point per 100 steps (max 50), 1 point per minute (max 30), plus bonuses at 5,000 and 10,000 steps."
      },
      {
        question: "What is the Workout Plan feature?",
        answer: "A senior-friendly workout planning system offering two modes: 'Persona-Guided' (AI-generated plan based on your health goals) and 'Browse & Choose' (a curated library of ready-made workout templates)."
      },
      {
        question: "How does the Persona-Guided workout plan work?",
        answer: "Answer a short questionnaire about your fitness goals, current activity level, available equipment, and medical limitations. The AI generates a customized weekly workout plan."
      },
      {
        question: "What is the Browse & Choose workout library?",
        answer: "A curated collection of pre-built workout templates organized by category (Strength, Cardio, Flexibility, etc.). Preview any plan to see all exercises, then tap 'Adopt This Plan' to make it active."
      },
      {
        question: "Do exercises have animated demonstrations?",
        answer: "Yes! Tap any exercise name to open a detail dialog with animated GIF demonstrations. Each exercise also includes step-by-step text instructions."
      },
      {
        question: "Can I listen to exercise instructions?",
        answer: "Yes! Each exercise detail dialog has a 'Listen to instructions' button that reads the steps aloud using text-to-speech."
      },
      {
        question: "How is workout progress tracked?",
        answer: "The app compares your scheduled workout plan against actual activity sessions to show adherence rings, streak counts, and weekly progress grids."
      },
      {
        question: "How do Activity Points work with the Awards system?",
        answer: "Activity session points feed directly into the Loyalty Rewards system alongside Wellness Check and Medication Adherence points. They count toward milestone rewards and can be redeemed for prizes."
      },
      {
        question: "Is there a medical disclaimer for workout plans?",
        answer: "Yes. All generated and library workout plans include a mandatory medical disclaimer reminding you to consult your healthcare provider before starting any new exercise program."
      },
      {
        question: "Does Activity Tracking work in the background?",
        answer: "For best results, keep the app open or use it as a PWA (installed on your home screen). Background tracking depends on your device capabilities."
      },
    ],
  },
  {
    title: "Nearby Facilities",
    icon: "map",
    items: [
      {
        question: "What is the Nearby Facilities feature?",
        answer: "Find hospitals, pharmacies, clinics, and other healthcare facilities near your current location using Google Maps. View addresses, phone numbers, and get directions instantly."
      },
      {
        question: "Can I save facilities I visit often?",
        answer: "Yes! You can add custom facilities with their name, type, address, and phone number. These are saved to your profile and appear alongside auto-detected nearby facilities."
      },
      {
        question: "What types of facilities can I find?",
        answer: "You can search for Hospitals, Pharmacies, Clinics, Diagnostic Labs, and Jan Aushadhi Kendras (government-subsidized medicine stores)."
      },
    ],
  },
  {
    title: "Secret Vault",
    icon: "lock",
    items: [
      {
        question: "What is the Secret Vault?",
        answer: "A secure, encrypted storage for sensitive information like passwords, documents, and personal notes that you want to pass on to trusted contacts."
      },
      {
        question: "Who can access my Vault?",
        answer: "Only Guardians you designate as 'Vault Nominees' can access your Vault, and only after a verified death verification process involving two witnesses and documentation."
      },
      {
        question: "How is my data protected?",
        answer: "All Vault data is encrypted on your device before being stored. Only your designated nominees can decrypt it using a secure verification process."
      },
    ],
  },
  {
    title: "Pre & Post Operations",
    icon: "stethoscope",
    items: [
      {
        question: "What is the Pre & Post Operations Guide?",
        answer: "A comprehensive tool to help you prepare for surgery and track recovery. It covers pre-op checklists, baseline vitals recording (3 days prior), medication management, allergy tracking, and post-op site checks."
      },
      {
        question: "What are Baseline Vitals?",
        answer: "Record BP, Temperature, Heart Rate, SpO2, Blood Sugar, and Weight for the 3 days leading up to your operation. This helps doctors compare pre-op and post-op health."
      },
      {
        question: "What does the Physical Site Check track?",
        answer: "Record symptoms like Redness, Swelling, Unusual Discharge, Vomiting, Nausea, Dizziness, and Fatigue for each recovery day. Includes a Mobility Tracker and Remarks field."
      },
      {
        question: "Can Guardians view my operation data?",
        answer: "Yes! There's a dedicated Guardian Operation View that provides guardians with an overview of your pre/post-op status."
      },
      {
        question: "Can I export my operation data?",
        answer: "Yes! Generate a comprehensive PDF report with your case summary, baseline vitals, pre-op checklist, medications, allergies, post-op vitals, and physical site check records."
      },
    ],
  },
  {
    title: "Medical Services",
    icon: "hospital",
    items: [
      {
        question: "What are Medical Services?",
        answer: "A curated catalog of healthcare offerings including At-home Lab Tests, Companionship, Mobility Devices, Monitoring & Home Care devices, Nutrition/Meal Delivery, and Health Insurance."
      },
      {
        question: "When will these services be available?",
        answer: "These services are currently marked as 'Coming Soon'. We'll notify you as each service becomes available."
      },
    ],
  },
  {
    title: "Book Ambulance",
    icon: "ambulance",
    items: [
      {
        question: "How do I book an ambulance?",
        answer: "Use the Book Ambulance feature in My Health to quickly request emergency medical transport based on your location. Guardians can also book ambulances on your behalf through the Guardian Portal."
      },
      {
        question: "How much does an ambulance cost?",
        answer: "The base fare is ₹1,500 for the first 5 km, with an additional ₹300 per km beyond that. A fare estimate is shown before you confirm the booking."
      },
    ],
  },
  {
    title: "Medical Documents",
    icon: "file-text",
    items: [
      {
        question: "How do I store medical documents?",
        answer: "Go to My Health → Medical Documents. Upload or scan documents like lab reports, prescriptions, discharge summaries, imaging, vaccination records, and more. All files are stored in a private bucket with owner-only access."
      },
      {
        question: "Are my medical documents secure?",
        answer: "Yes! Documents are stored in private storage. The app uses time-limited signed URLs — 1 hour for viewing and 24 hours for sharing — ensuring documents can't be accessed permanently via a link."
      },
      {
        question: "Can I organize documents by type?",
        answer: "Yes! Tag documents by type: Lab Report, Prescription, Discharge Summary, Imaging, Vaccination, Insurance, Consultation Notes, Surgical Report, Pathology, or Other."
      },
    ],
  },
  {
    title: "Getting Started",
    icon: "rocket",
    items: [
      {
        question: "Is there a guided tour for new users?",
        answer: "Yes! When you first open the app, an interactive onboarding walkthrough introduces the four core features: Daily Check-In, Emergency SOS, Guardian Network, and Medication Reminders."
      },
      {
        question: "How do I install the app on my phone?",
        answer: "Check-iN is a Progressive Web App (PWA). On your phone's browser, tap the 'Install' option in the menu. This adds the app to your home screen for quick access and enables background notifications."
      },
      {
        question: "Can I use the app on multiple devices?",
        answer: "Yes! Sign in with the same account on any device. Your data, preferences, and language settings sync automatically across all devices."
      },
      {
        question: "Do I receive a Welcome email after signing up?",
        answer: "Yes! After creating your account and verifying your email, you'll receive a branded Welcome email introducing you to Check-iN's key features."
      },
    ],
  },
  {
    title: "Account & Login",
    icon: "log-in",
    items: [
      {
        question: "How do I sign up for Check-iN?",
        answer: "Check-iN is phone-first: enter your full name and mobile number, verify with a 6-digit OTP, and pick your role (User or Guardian). Email is optional — if you don't add one we create a placeholder address for your account."
      },
      {
        question: "How do I log in?",
        answer: "Enter your registered phone number and tap 'Send OTP'. You'll receive a 6-digit one-time password via SMS (and WhatsApp where supported). OTPs are self-managed and expire after a few minutes."
      },
      {
        question: "Why don't I see chimes or popups during login?",
        answer: "While the login/OTP flow is in progress, the app intentionally suppresses all alerts, audio chimes and overlays so nothing jumps in front of the auth screen. Everything resumes normally once you finish signing in."
      },
      {
        question: "I didn't receive my OTP — what should I do?",
        answer: "Wait for the resend timer, then tap 'Resend OTP'. Check your mobile signal and ensure your phone number is correct (with country code +91). If it still doesn't arrive, contact checkin_support@futurewave.in."
      },
    ],
  },
  {
    title: "Language & Translations",
    icon: "globe",
    items: [
      {
        question: "What languages does the app support?",
        answer: "Check-iN supports 9 languages: English (default), Hindi, Marathi, Tamil, Bengali, Malayalam, Kannada, Konkani, and French."
      },
      {
        question: "How do I change the app language?",
        answer: "Click the globe icon in the header navigation to open the language switcher. Select your preferred language and the app will immediately update."
      },
      {
        question: "Will my language preference be saved?",
        answer: "Yes! Your language preference is saved to your profile and synced across all your devices."
      },
    ],
  },
  {
    title: "Shared Care Journal",
    icon: "book-open",
    items: [
      {
        question: "What is the Shared Care Journal?",
        answer: "A chronological, shared notebook between you and your accepted Guardians. Both parties can post timestamped notes about health events, observations, mood changes, medication side effects, or doctor visit summaries."
      },
      {
        question: "What categories of notes can I create?",
        answer: "Notes can be categorized as: Observation, Symptom, Medication, Mood, Doctor Visit, or General. Each category has its own icon for easy scanning."
      },
      {
        question: "Can Guardians add notes to my journal?",
        answer: "Yes! Accepted Guardians can view and add entries to your journal. They can only edit or delete their own entries, while you (the user) can delete any entry."
      },
      {
        question: "Can I pin important notes?",
        answer: "Yes! Pin important entries so they always appear at the top of the journal in a highlighted section."
      },
      {
        question: "Does the journal appear in the Doctor Visit Report?",
        answer: "Yes! The last 15 pinned or recent journal entries are automatically included in your Doctor Visit Report."
      },
      {
        question: "Are journal entries automatically deleted?",
        answer: "No. Unlike SOS exchanges (which auto-delete after 72 hours), journal entries are kept permanently because they have long-term clinical value. You can manually delete entries at any time."
      },
    ],
  },
  {
    title: "Fall Detection",
    icon: "alert-circle",
    items: [
      {
        question: "What is Fall Detection?",
        answer: "Fall Detection uses your device's accelerometer and gyroscope sensors to detect potential falls. It monitors for a three-phase pattern: sudden free fall, followed by a hard impact, followed by a period of stillness."
      },
      {
        question: "Is Fall Detection enabled by default?",
        answer: "Yes, Fall Detection is enabled by default for all users on supported devices. You can disable it in Settings → Check-In tab → Fall Detection."
      },
      {
        question: "What happens when a fall is detected?",
        answer: "A full-screen alert appears with strong vibration, asking 'Are you okay?' You have 30 seconds to tap 'I'm OK — Cancel Alert'. If you don't respond, the app automatically triggers a full SOS alert."
      },
      {
        question: "Will it trigger false alarms?",
        answer: "The algorithm requires three conditions — free fall, high-impact acceleration, and subsequent stillness — making false positives unlikely. There's also a 1-minute cooldown between detections."
      },
      {
        question: "Does Fall Detection work on all devices?",
        answer: "It works on devices with accelerometer sensors (most modern smartphones). Desktop browsers and some older devices may not support the Device Motion API."
      },
      {
        question: "Does it work in the background?",
        answer: "Fall Detection requires the app to be open (in the foreground or as an active PWA). Install the app as a PWA on your home screen for best results."
      },
    ],
  },
  {
    title: "Subscription & Pricing",
    icon: "credit-card",
    items: [
      {
        question: "What subscription plans are available?",
        answer: "Three tiers: Free (1 guardian, core safety), Basic ₹99/month or ₹999/year (up to 3 guardians, full check-in + medication tools), and Pro ₹199/month or ₹1,999/year (up to 5 guardians, all AI health tools, priority support). Premium Plus (₹9,999/yr) bundles the Smart Ring."
      },
      {
        question: "How does checkout work?",
        answer: "From the Subscription page, choose a plan and you'll be redirected to futurewave.in/pay (Razorpay) to complete payment securely. After payment, the confirmation syncs back automatically and your plan is upgraded within seconds."
      },
      {
        question: "Can I use a coupon code?",
        answer: "Yes! Enter your coupon at checkout. Codes are validated server-side, are usually single-use per account, and apply an immediate discount on the Razorpay page before payment."
      },
      {
        question: "What are the per-tier guardian limits?",
        answer: "Free: 1 guardian. Basic: 3 guardians. Pro: 5 guardians. Advanced AI tools (Quick Visual Checks, Doctor Visit Report, Tele-Consult analysis) are gated to higher tiers."
      },
    ],
  },
  {
    title: "Privacy & Data Security",
    icon: "shield-lock",
    items: [
      {
        question: "How is my data protected?",
        answer: "All personal data is stored with strict owner-only access controls. Sensitive fields use encryption. Medical documents use time-limited signed URLs. Guardian access is restricted to emergency-relevant fields only."
      },
      {
        question: "What compliance standards does the app follow?",
        answer: "The app adheres to India's DPDA (Digital Personal Data Protection Act), PSS, PRB, and IT Act requirements. For international users, GDPR and US FDA guidelines are also followed."
      },
      {
        question: "Can I request my data or account deletion?",
        answer: "Yes! Go to Settings → Privacy tab → Data Privacy Controls. You can submit requests to access your data, correct information, or request account deletion."
      },
      {
        question: "What information is shared with Guardians?",
        answer: "Only emergency-relevant data: blood type, allergies, medical conditions, and your doctor/emergency contact details. Personal identity documents, health metrics, and vault contents are never shared unless you specifically nominate a vault nominee."
      },
      {
        question: "Where can I manage privacy settings?",
        answer: "Go to Settings → Privacy tab to control location sharing, health data sharing, and wellness score sharing preferences with your guardians."
      },
      {
        question: "Does the app use cookies?",
        answer: "Check-iN uses only essential cookies for authentication and session management. A cookie consent banner appears on your first visit. No third-party tracking cookies are used."
      },
    ],
  },
  {
    title: "Hospital Visit & Admission Kit",
    icon: "briefcase-medical",
    items: [
      {
        question: "What is the Hospital Visit tab in Guardian Reports?",
        answer: "Hospital Visit is a dedicated tab in the Guardian Reports section that bundles your ward's identity and insurance documents into a one-tap 'Admission Kit' for hospital reception. It shows 5 document cards (Aadhaar, PAN, Insurance Primary, Insurance Secondary, Passport Photo) with availability status (✅ Available / ⚠️ Missing).",
      },
      {
        question: "What documents are included in the Admission Kit?",
        answer: "The kit includes: Aadhaar Card, PAN Card, Health Insurance (primary and optional secondary), and a recent Passport Photo. It also generates a branded cover page with the ward's name, DOB, blood group, allergies, chronic conditions, and primary guardian contact.",
      },
      {
        question: "How does the one-tap Admission Kit PDF work?",
        answer: "Tap 'Download Admission Kit (PDF)' from the Hospital Visit tab. The app fetches all available documents, embeds images full-page, links to PDFs, and produces a single Check-iN branded PDF — ready to print or share at hospital reception.",
      },
      {
        question: "How do I share the Admission Kit via WhatsApp?",
        answer: "Tap 'Share via WhatsApp'. The app uploads the generated PDF to a private bucket, creates a 24-hour secure link, and opens WhatsApp with a templated message containing the link. The link expires after 24 hours for security.",
      },
      {
        question: "What if the ward hasn't uploaded a document?",
        answer: "Missing documents show a ⚠️ status. Tap 'Nudge {ward}' to send an in-app notification asking them to upload the missing items. The Admission Kit can still be generated with whatever documents are available.",
      },
    ],
  },
  {
    title: "ID & Insurance (Ward Profile)",
    icon: "id-card",
    items: [
      {
        question: "What is the ID & Insurance section?",
        answer: "A dedicated section in My Profile with 5 fixed slots for the documents most often requested at hospital admission: Aadhaar, PAN, Health Insurance (Primary), Health Insurance (Secondary), and a Passport Photo.",
      },
      {
        question: "How do I upload or replace a document?",
        answer: "Tap the Upload button on any empty slot to pick a file or take a photo. To replace an existing document, tap 'Replace' on the slot. Each slot holds exactly one current document — replacing automatically removes the old one.",
      },
      {
        question: "Can I take a passport photo using the camera?",
        answer: "Yes. The Passport Photo slot offers a 'Take Selfie' shortcut that opens your front camera so you can capture a fresh photo without leaving the app.",
      },
      {
        question: "Who can see my ID & Insurance documents?",
        answer: "Only you and your accepted guardians. Guardians access them through the Hospital Visit tab in their Reports section. Documents are stored in private storage with strict row-level security — pending or expired guardians cannot see them.",
      },
    ],
  },
  {
    title: "Guardian Reports & Appointments",
    icon: "clipboard",
    items: [
      {
        question: "What sections are in Guardian Reports?",
        answer: "Guardian Reports brings together all the information a guardian needs about their ward: Health Passport, Vitals, Medication Adherence, Activity, Care Journal, Wellness Trends, and the new Hospital Visit Admission Kit.",
      },
      {
        question: "How do Guardian Appointments work?",
        answer: "Guardians can view their ward's upcoming appointments in the Guardian Appointments page. Today's appointments also surface as a strip on the Guardian Dashboard with the next appointment time and a count badge.",
      },
      {
        question: "What is the 'Today's Appointments' strip on the Guardian Dashboard?",
        answer: "A compact card on the Guardian Dashboard that appears whenever the ward has appointments scheduled for today. It shows the count and next appointment title/time, and tapping it opens the full Guardian Appointments view.",
      },
      {
        question: "Where do I find Appointments in the Guardian app?",
        answer: "Open the Profile menu in the top-right corner and select 'Appointments'. You can also tap the 'Today's Appointments' strip on the Guardian Dashboard when active.",
      },
    ],
  },
  {
    title: "Health Passport",
    icon: "stamp",
    items: [
      {
        question: "What is the Health Passport?",
        answer: "A daily snapshot of your overall health, scored from 0–100 across 7 categories. It gives you and your guardians a single, easy-to-read indicator of how your wellbeing is trending over time.",
      },
      {
        question: "What are the 7 categories?",
        answer: "Vitals, Activity, Nutrition, Sleep, Medication Adherence, Mental Wellness, and Hydration. Each category contributes to your overall Health Passport score.",
      },
      {
        question: "How does Face Scan feed into the Passport?",
        answer: "When fresh vitals are missing, the Health Passport falls back to your latest Face Scan results (heart rate, respiratory rate, hydration) so your score stays current without manual entry.",
      },
      {
        question: "Can my Guardian see my Health Passport?",
        answer: "Yes — the WardHealthScoreRing on the Guardian Dashboard shows the latest passport score, and Guardian Reports includes a trend chart over time.",
      },
    ],
  },
  {
    title: "Pill Identifier",
    icon: "pill",
    items: [
      {
        question: "What is the Pill Identifier?",
        answer: "A photo-based AI tool that identifies tablets and capsules from your camera. Snap a clear photo of a pill and the app returns the likely name, strength, and common uses.",
      },
      {
        question: "Does it cross-check against my prescription?",
        answer: "Yes. The Pill Identifier compares the identified medication against your current Tablets list to flag mismatches — useful for spotting dispensing errors at the pharmacy.",
      },
      {
        question: "What happens if a banned drug is detected?",
        answer: "If the pill matches a medication on India's banned drugs registry, the app shows an immediate red-flag warning and notifies your primary guardian via SMS/WhatsApp.",
      },
    ],
  },
  {
    title: "Safe Zones & Geofencing",
    icon: "map-pin",
    items: [
      {
        question: "What are Safe Zones?",
        answer: "Safe Zones are geographic areas you define (home, day-care centre, family member's home) where you're expected to be. The app monitors your location every 5 minutes and alerts your guardians if you leave a Safe Zone unexpectedly.",
      },
      {
        question: "How do I set up a Safe Zone?",
        answer: "Open the Safe Zone Editor from Settings, drop a pin on the map, set a radius (in metres), and name the zone. You can create multiple zones.",
      },
      {
        question: "What happens when I leave a Safe Zone?",
        answer: "Your primary guardian receives an in-app, push, and (if configured) WhatsApp alert with your current location. A 30-minute cooldown prevents repeat alerts for the same exit event.",
      },
    ],
  },
  {
    title: "Map My Journey — Safety Net",
    icon: "navigation",
    items: [
      {
        question: "What is the MMJ Safety Net?",
        answer: "An extra layer of safety that runs while you're on a Map My Journey trip. It includes low-battery guardian alerts, automatic SOS escalation if you don't respond to a route-deviation prompt, and a public live-tracking link your guardians can open without signing in.",
      },
      {
        question: "What is the low-battery guardian alert?",
        answer: "If your phone battery drops below 10% during an active journey, your primary guardian is automatically alerted with your last known location — so they know your phone may shut off soon.",
      },
      {
        question: "What is auto-SOS escalation on route deviation?",
        answer: "If the app detects you've deviated from your planned route, it shows an 'Are you OK?' prompt. If you don't respond within the timeout, a full SOS is automatically triggered to all your guardians.",
      },
      {
        question: "What is the public live-tracking share link?",
        answer: "When you start a journey, the app generates a public URL that shows your live location on a map. Share it via WhatsApp/SMS — recipients don't need a Check-iN account to follow along.",
      },
    ],
  },
  {
    title: "Voice Query & AI Voice Check-ins",
    icon: "mic",
    items: [
      {
        question: "What is the Voice Query button?",
        answer: "A floating microphone button that lets you ask the app questions out loud — like 'When is my next medication?' or 'Show today's appointments'. Designed for hands-free use by elderly users.",
      },
      {
        question: "What are AI voice check-ins?",
        answer: "When a check-in is missed or a fall is suspected, the app can play a spoken prompt ('Are you okay?') and listen for your voice reply. A confirmed 'yes' resolves the alert; silence escalates to your guardians.",
      },
    ],
  },
  {
    title: "Onboarding Wizard",
    icon: "list-checks",
    items: [
      {
        question: "What is the Onboarding Wizard?",
        answer: "A 4-step setup modal shown on first sign-in for users (not guardians). It walks you through: (1) basic profile, (2) check-in times, (3) adding your primary guardian, and (4) enabling notifications.",
      },
      {
        question: "Can I skip steps and complete them later?",
        answer: "Yes — most steps can be skipped. You can finish the remaining setup any time from Settings and My Profile.",
      },
    ],
  },
  {
    title: "Battery Monitoring",
    icon: "battery-low",
    items: [
      {
        question: "How does battery monitoring work?",
        answer: "The app reads your device's battery level and shows a warning when it drops below safe thresholds. This helps ensure your phone stays charged enough to receive check-ins, alarms, and to send an SOS if needed.",
      },
      {
        question: "What are the alert thresholds?",
        answer: "Two thresholds: 30% (gentle reminder) and 10% (urgent — also notifies your primary guardian if you're on an active Map My Journey trip).",
      },
      {
        question: "Do guardians get battery alerts on their own phone?",
        answer: "No. Local battery alerts are only shown on user (ward) accounts. Guardians only receive a notification when the ward's battery drops critically during a live journey.",
      },
    ],
  },
  {
    title: "Accessibility Menu",
    icon: "accessibility",
    items: [
      {
        question: "What is the Accessibility Menu?",
        answer: "A quick-access menu in the top header that lets you adjust the app for easier reading and use — including font size, high-contrast mode, and reduced motion.",
      },
      {
        question: "How does it help elderly users?",
        answer: "The app already enforces a minimum 18px font size and a single mobile-first layout. The Accessibility Menu lets seniors further increase text size, boost contrast, and turn off animations for a calmer experience.",
      },
    ],
  },
  {
    title: "SOS Event Lifecycle",
    icon: "siren",
    items: [
      {
        question: "What is the Active SOS banner?",
        answer: "A persistent red banner that appears at the top of the app whenever an SOS is active — for both the user and their guardians. Tap it to view details, resolve, or escalate.",
      },
      {
        question: "How is SOS resolution synced across roles?",
        answer: "When the user, any guardian, or an SMS reply (SAFE/OK) resolves an SOS, the status syncs in real time across every connected device. The Active SOS banner disappears for everyone, and resolution is logged with timestamp and source.",
      },
      {
        question: "What is the trigger stability guard?",
        answer: "A short debounce window that prevents rapid duplicate SOS triggers from accidental button-mashing, fall re-detection, or flapping sensor signals — so guardians don't get bombarded with repeat alerts.",
      },
    ],
  },
  {
    title: "Check-In Settings & Vacation Mode",
    icon: "settings",
    items: [
      {
        question: "What is the Check-In Settings dialog?",
        answer: "A unified settings dialog where you can configure your check-in times, Sleep Mode hours, Fall Detection, and Check-Out (Vacation) periods — all in one place.",
      },
      {
        question: "How does Sleep Mode differ from Check-Out?",
        answer: "Sleep Mode pauses check-ins every night between your sleep and wake times (recurring). Check-Out (Vacation Mode) disables all check-ins for a one-off date range — useful for trips or hospital stays.",
      },
      {
        question: "Can I configure my check-in times?",
        answer: "The default windows are 7 AM, 12 PM, and 7 PM IST. You can adjust them during the Onboarding Wizard or later from Settings → Check-In tab.",
      },
    ],
  },
  {
    title: "Guardian Inactivity Monitor",
    icon: "shield",
    items: [
      {
        question: "What does my guardian see if I don't use my phone for a while?",
        answer: "On the Guardian Dashboard, your 'Last Active' tile escalates as inactivity grows: amber at 15 min, red at 30 min, flashing red at 45 min, and a popup at 60 min asking them to check on you. It auto-refreshes every 10 minutes.",
      },
      {
        question: "Will this fire while I'm sleeping or on vacation?",
        answer: "No. Sleep Mode and Check-Out (Vacation Mode) automatically suppress the escalation — no colour change, no flashing, no 1-hour popup. Normal monitoring resumes when you wake up or end Check-Out.",
      },
    ],
  },
  {
    title: "Notifications Inbox & Push",
    icon: "bell",
    items: [
      {
        question: "Where can I see past alerts?",
        answer: "The bell icon in the header opens your Notifications inbox. Every alert (check-ins, medication, SOS, geofence, low battery, fall) is mirrored here. Entries auto-clean after 48 hours.",
      },
      {
        question: "Why don't I get duplicate alerts for the same thing?",
        answer: "Notifications are de-duplicated server-side, so repeated triggers for the same event collapse into a single inbox entry and a single push.",
      },
      {
        question: "Do push notifications work when the app is closed?",
        answer: "Yes. Check-iN registers a service worker with Web Push. A 1-minute server-side cron evaluates pending alerts, so even with the app closed, the push reaches your lock screen.",
      },
    ],
  },
  {
    title: "Offline Reliability",
    icon: "wifi-off",
    items: [
      {
        question: "What happens if I press SOS while offline?",
        answer: "The service worker queues your SOS payload locally and retries automatically the moment connectivity returns — so the alert is never lost.",
      },
      {
        question: "Can my Emergency Profile be viewed offline?",
        answer: "Yes. Your public Emergency Profile page is cached by the service worker, so first-responders can open the shared link even with patchy network.",
      },
    ],
  },
  {
    title: "Settings Auto-Save",
    icon: "save",
    items: [
      {
        question: "Do I need to tap 'Save' after changing settings?",
        answer: "No — settings save automatically with a short debounce (about half a second after your last edit). Pending changes are also flushed when you sign out or close the app, so nothing is lost.",
      },
    ],
  },
  {
    title: "What's New (July 2026)",
    icon: "rocket",
    items: [
      {
        question: "Can I check in earlier than the scheduled time?",
        answer: "Yes — the check-in heart now unlocks 60 minutes before your scheduled slot (previously 30 minutes). Tap the pulsing heart any time in that hour to check in early.",
      },
      {
        question: "Will I be reminded even if the app is closed?",
        answer: "Yes. Push reminders now fire in three waves per missed slot — at the scheduled time (T-0), 10 minutes later, and 30 minutes later — driven by a server-side cron. They reach your lock screen even when Check-iN is not open.",
      },
      {
        question: "What happens if I respond late to a check-in?",
        answer: "Your check-in is still recorded and marked as a late response. Your Guardian sees the late completion on their dashboard, so nothing gets lost.",
      },
      {
        question: "Where did the Active / Sleep / Checked-Out toggle go?",
        answer: "It moved out of the top of the home screen into Settings → Check-iN → Mode. The home screen is now cleaner with a larger heart and clearer status.",
      },
      {
        question: "Why is Health Passport now above Map My Journey on the home tiles?",
        answer: "We reordered the tiles so daily health at-a-glance sits above travel tools — Health Passport now appears directly above Map My Journey.",
      },
    ],
  },
  {
    title: "Medication Voice Alerts",
    icon: "pill",
    items: [
      {
        question: "Does the app speak the medication name at dose time?",
        answer: "Yes. At T-0 (the exact scheduled time), the app announces the medication name out loud — e.g. \"Time to take Metformin\" — in addition to the chime and push. This is on by default.",
      },
      {
        question: "How do I turn the medication voice alert off?",
        answer: "Go to Settings → Alerts and toggle 'Medication voice alert at due time' off. The chime, vibration and push notification continue to work.",
      },
    ],
  },
  {
    title: "Appointment Loud Alerts",
    icon: "calendar-clock",
    items: [
      {
        question: "How loud is the appointment alert?",
        answer: "At the alert lead time you selected when adding the appointment, the app plays a 3-burst loud chime followed by a spoken reminder that says the appointment title and time — designed to be heard even if you've stepped away from the phone.",
      },
      {
        question: "Can I change the alert lead time?",
        answer: "Yes — when adding or editing an appointment, set the primary and secondary alert lead times (e.g. 1 hour before, 15 minutes before). The loud alert fires precisely at each lead time.",
      },
    ],
  },
  {
    title: "Blood Bank Directory",
    icon: "heart",
    items: [
      {
        question: "How do I find blood banks near me?",
        answer: "Open Emergency First Aid or Services → Blood Banks. Follow the 3-step flow: pick your blood group → pick the component (Whole Blood, Plasma, Platelets, etc.) → see the nearest matching centres sorted by distance.",
      },
      {
        question: "How many blood banks are listed?",
        answer: "6,145 blood banks across India, with contact numbers and directions. Sign-in is required to view the directory to protect centre data.",
      },
    ],
  },
  {
    title: "One-Tap Call & In-App Ring",
    icon: "phone",
    items: [
      {
        question: "How do I call my Guardian in one tap?",
        answer: "The green Call button on your home screen dials your Primary Guardian instantly using your phone's normal mobile call — no menus, no lists.",
      },
      {
        question: "Does the Guardian's phone ring inside the Check-iN app too?",
        answer: "Yes. When you tap Call, an in-app ringer also fires on your Guardian's Check-iN app (via realtime) — so even if your mobile call is missed, they see and hear the incoming Check-iN call.",
      },
    ],
  },
  {
    title: "Safe Zone WhatsApp Alerts",
    icon: "map-pin",
    items: [
      {
        question: "What happens when I leave a Safe Zone?",
        answer: "Your accepted Guardians get an instant WhatsApp message (via the 'safe_zone' template) telling them you've moved outside your defined Safe Zone, along with your name and time.",
      },
      {
        question: "Do they get told when I come back?",
        answer: "Yes — a matching 'safe_zone_return' WhatsApp is sent the moment you re-enter the Safe Zone, so Guardians know you're back to safety without needing to ask.",
      },
    ],
  },
  {
    title: "Voice Agent & Customer Service",
    icon: "bell",
    items: [
      {
        question: "What is the Voice Agent?",
        answer: "A conversational assistant you can talk to. Tap the mic button on your home screen — it greets you in voice and starts listening. Two modes: Ask (health & app questions) and Chat (companion conversation). Free for everyone.",
      },
      {
        question: "Is there a usage limit?",
        answer: "There is a soft cap of about 50 turns per day per account to keep the service fast and free for all.",
      },
      {
        question: "How do I reach Check-iN Customer Service?",
        answer: "Open /support (or Help → Contact Customer Service). You can chat on WhatsApp with your details pre-filled, call our support line, browse FAQs, or email a ticket. Support hours: Mon–Sat, 9 AM – 6 PM IST.",
      },
    ],
  },
  {
    title: "Hospital Admission Kit — Updated",
    icon: "hospital",
    items: [
      {
        question: "What's now included in the Hospital Admission Kit?",
        answer: "In addition to your IDs, insurance and vitals, the Kit now includes the full 6-section 'Ward Profile Snapshot' and the AI-generated Doctor Visit Report — so the treating team gets your complete medical picture in one PDF.",
      },
    ],
  },
  {
    title: "What's New (July 2026 · Update 2)",
    icon: "rocket",
    items: [
      {
        question: "Why does the Meds tile on my dashboard now show something like 2/5?",
        answer: "The Meds score now counts every scheduled dose in your medication list for today (sum of all schedule times across your active medications). The number on the left is doses you've marked as taken; the right is total scheduled. It updates live as you log doses.",
      },
      {
        question: "Why does the Health tile show a /100?",
        answer: "For consistency with Check-ins and Meds, the Health Passport score is now displayed as score/100 on the dashboard tile — same number as before, clearer format.",
      },
      {
        question: "Can I delete my Nap schedule?",
        answer: "Yes. Go to Settings → Auto-Nap Schedule and tap 'Clear nap schedule'. You'll be asked to confirm. This removes the daily nap window and turns Auto-Nap off — no more automatic Nap-Mode transitions.",
      },
      {
        question: "Does the voice assistant know which medications are still due?",
        answer: "Yes. Ask 'Any medications due today?' or 'What's left?' — the assistant reads today's dose slots directly from your medication list (not just the log) and tells you which are upcoming, which are overdue, and which are taken.",
      },
    ],
  },
  {
    title: "Ask Check-iN Help Bot",
    icon: "message-circle",
    items: [
      {
        question: "What is the floating chat button in the corner?",
        answer: "That's the 'Ask Check-iN' help bot — a product knowledge assistant. Ask anything about features, registration, guardian nomination, vault, medications, subscriptions, SOS, ambulance booking, etc. It answers from the official Check-iN knowledge base, not from your personal data.",
      },
      {
        question: "How is it different from the Voice Agent?",
        answer: "The Voice Agent (mic button) answers questions about your personal data (your meds today, your check-ins, your vitals) and speaks the answer aloud. The Help Bot (chat bubble) answers how-to and product questions in text. Both are free.",
      },
    ],
  },
  {
    title: "Indian Voice for the Assistant",
    icon: "mic",
    items: [
      {
        question: "The voice sounds Indian now — did something change?",
        answer: "Yes. Voice replies now use Sarvam.ai's Indian-English voice (Anushka) instead of the previous international voice, so pronunciations of Indian names, places and medicines sound natural.",
      },
      {
        question: "Why does the mic sometimes not work in the browser?",
        answer: "Some browser previews block on-device speech recognition. In those cases the app automatically falls back to Sarvam server-side transcription so the mic still works — including on iPhone Safari and inside the Lovable preview.",
      },
    ],
  },
  {
    title: "Ambulance Booking (Clarification)",
    icon: "ambulance",
    items: [
      {
        question: "Can I book an ambulance from the app?",
        answer: "Yes. Open Services (bottom navigation) → Ambulance, pick a provider, confirm pickup, and tap Book. Available on all plans including Free (pay-per-use tariff applies). For life-threatening emergencies, also press the red SOS button so guardians get your live location while the ambulance is en route.",
      },
    ],
  },
  {
    title: "Connect Check-iN to AI Assistants (MCP)",
    icon: "plug",
    items: [
      {
        question: "Can I ask ChatGPT or Claude about my Check-iN data?",
        answer: "Yes. Check-iN exposes an MCP (Model Context Protocol) endpoint with three read-only tools: today's medications, upcoming appointments, and your latest health status. Add Check-iN as an agent integration in ChatGPT / Claude / Cursor and approve access on the consent screen. You stay in control — nothing is written, and access can be revoked anytime.",
      },
      {
        question: "Is my data safe when using MCP?",
        answer: "Yes. The tools are read-only and scoped to your account via OAuth. No other user's data is exposed, and the assistants only see what you approve on the consent page.",
      },
    ],
  },
];

