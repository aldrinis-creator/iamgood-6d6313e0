// FAQ data — update this file whenever FAQs change.
// Last updated: 2026-05-11

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  icon: string; // emoji/icon identifier
  items: FaqItem[];
}

export const FAQ_VERSION = "2026-04-20";

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
        answer: "Visit the registration page and choose your role (User or Guardian). Fill in your details, verify your phone number via OTP, and optionally nominate guardians. A verification email will be sent to your registered email address."
      },
      {
        question: "Can I sign in with my phone number?",
        answer: "Yes! On the login page, switch to the 'Phone' tab and enter your registered phone number. You'll receive a one-time password (OTP) via SMS to sign in."
      },
      {
        question: "I forgot my password — how do I reset it?",
        answer: "On the login page, tap 'Forgot Password?' and enter your email address. You'll receive a password reset link via email. Click the link to set a new password."
      },
      {
        question: "I didn't receive the verification email — what do I do?",
        answer: "On the login page, try signing in with your credentials. If your email isn't verified yet, a 'Resend Verification Email' option will appear. Check your spam/junk folder as well."
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
        answer: "Check-iN offers two plans: Basic at ₹99/month (core safety features, 2 guardians, basic health tools) and Pro at ₹199/month (all features, up to 5 guardians, advanced AI tools, priority support)."
      },
      {
        question: "Is there a free trial?",
        answer: "Check-iN's core safety features are available to try. Visit the Subscription page from the menu to view detailed plan comparisons and upgrade options."
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
];
