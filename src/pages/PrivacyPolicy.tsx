import LegalPageLayout from "@/components/LegalPageLayout";
import SeoMeta from "@/components/SeoMeta";

const sections = [
  {
    heading: "1. About This Policy",
    content:
      "This Privacy Policy explains how Check-iN, a personal safety and health companion app operated by Future Wave ('we', 'us', 'our'), collects, uses, stores, and protects your personal data. It is designed to comply with India's Digital Personal Data Protection Act, 2023 ('DPDP Act'), the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the EU General Data Protection Regulation 2016/679 ('GDPR') for users in the European Economic Area and the United Kingdom.",
  },
  {
    heading: "2. Our Role as Data Fiduciary / Controller",
    content:
      "Future Wave is the 'Data Fiduciary' under the DPDP Act and the 'Data Controller' under GDPR for the personal data you provide through Check-iN. We engage trusted Data Processors who act only on our documented instructions under contractual data-protection terms: Lovable Cloud (backend, database and file storage), MSG91 (SMS, OTP and WhatsApp delivery) and Razorpay (subscription payments).",
  },
  {
    heading: "3. Information We Collect",
    content:
      "Identity & contact data: your name, phone number, optional email, date of birth, profile photo, and nominated guardian and emergency contact details. Health data: medications, dosage schedules, vitals, check-in responses, medical vault documents (prescriptions, reports, ID and insurance), and outputs from in-app face, tongue and urine scans. Location data: device location when you trigger SOS, use Map My Journey, or are inside an active Safe Zone. Device & usage data: device model, OS, app version, battery status, IP address, push tokens, and interaction logs needed to operate the service and diagnose issues.",
  },
  {
    heading: "4. Sensitive Personal Data",
    content:
      "Your health information, biometric scan results and precise location qualify as Sensitive Personal Data under Indian SPDI Rules and as 'Special Category Data' under GDPR Article 9. We process this data only for the specific safety and wellness purposes you have explicitly consented to, and we apply enhanced safeguards including encryption, access controls and minimal retention.",
  },
  {
    heading: "5. Purpose & Legal Basis for Processing",
    content:
      "We process your data to: (a) deliver scheduled check-ins, medication reminders and adherence alerts; (b) send SOS and missed-check-in notifications to your nominated guardians; (c) provide AI-assisted health insights you request; (d) manage your subscription and payments; and (e) maintain account security. Our legal bases are your explicit consent (DPDP §6; GDPR Art. 6(1)(a) and Art. 9(2)(a)), performance of our service contract with you (GDPR Art. 6(1)(b)), and protection of your vital interests during an emergency (GDPR Art. 6(1)(d) and Art. 9(2)(c)).",
  },
  {
    heading: "6. How We Use Your Data",
    content:
      "Your data is used solely to operate the Check-iN service. We do not sell your personal data. We do not use your data for advertising or behavioural profiling. We do not train third-party AI models on your health records.",
  },
  {
    heading: "7. Data Sharing",
    content:
      "We share information only with: (i) the guardians you nominate, who receive the alerts, status and limited health information you choose to share; (ii) emergency responders or persons you contact when you trigger SOS; and (iii) our Data Processors (Lovable Cloud, MSG91, Razorpay) strictly to deliver the service. All processors are bound by confidentiality and data-protection contracts aligned with the DPDP Act and GDPR.",
  },
  {
    heading: "8. Data Storage & Location",
    content:
      "All personal data is hosted on servers located within India. We do not transfer your personal data outside India. For users in the EEA or UK whose data is accessed by our India-based infrastructure, transfers (where applicable) rely on appropriate safeguards including Standard Contractual Clauses under GDPR Article 46.",
  },
  {
    heading: "9. Data Security",
    content:
      "We apply industry-standard safeguards: TLS encryption in transit, encryption at rest, Row-Level Security on all personal records, time-limited signed URLs for vault documents, OTP-based authentication, role-based access controls, and regular security reviews. No method of transmission or storage is 100% secure, but we work continuously to protect your data.",
  },
  {
    heading: "10. Data Retention",
    content:
      "We retain your personal data for as long as your account is active. When you delete your account or withdraw consent, we erase your personal data within 90 days, except where retention is required by law (for example, financial and transaction records under tax laws, or records needed to defend a legal claim). Anonymised, aggregated data that cannot identify you may be retained for analytics.",
  },
  {
    heading: "11. Your Rights as Data Principal / Data Subject",
    content:
      "Under the DPDP Act (§§11–14) and GDPR (Articles 15–22), you have the right to: access your personal data; correct or update inaccurate data; request erasure of your data; restrict or object to certain processing; receive your data in a portable format; nominate another person to exercise your rights in case of death or incapacity; and lodge a complaint with the Data Protection Board of India or, for EEA/UK users, with your local supervisory authority. To exercise any right, contact our Grievance Officer (Section 14). We respond within 30 days.",
  },
  {
    heading: "12. Withdrawing Consent",
    content:
      "You may withdraw your consent at any time through Settings → Account, or by contacting our Grievance Officer. Withdrawal does not affect the lawfulness of processing carried out before withdrawal. Please note that withdrawing consent will disable core safety features such as SOS alerts, guardian notifications and medication reminders.",
  },
  {
    heading: "13. Cookies & Local Storage",
    content:
      "We use cookies, local storage and similar technologies to keep you signed in, remember your preferences, and understand how the app is used. You can manage these via the Cookie Settings option in the app footer.",
  },
  {
    heading: "14. Children's Data",
    content:
      "Check-iN is intended for adults aged 18 and over. We do not knowingly collect personal data from children. If you believe a child has provided personal data to us, please contact the Grievance Officer and we will delete it promptly.",
  },
  {
    heading: "15. Grievance Officer & Data Protection Contact",
    content:
      "In accordance with the DPDP Act §8(9) and the IT Rules, our designated Grievance Officer is: Aldrin Alphonso, Future Wave. Phone: +91 70458 68482. Email: checkin_support@futurewave.in. The Grievance Officer also acts as our point of contact for GDPR-related queries from EEA and UK users. We acknowledge requests within 7 days and resolve them within 30 days.",
  },
  {
    heading: "16. Changes to This Policy",
    content:
      "We may update this Privacy Policy from time to time. Material changes will be notified in-app and, where required, by email. The 'Last updated' date at the top of this page indicates the latest revision. For any questions, contact checkin_support@futurewave.in.",
  },
];

const PrivacyPolicy = () => (
  <>
    <SeoMeta
      title="Privacy Policy"
      description="Check-iN Privacy Policy — DPDP Act 2023 and GDPR compliant. How we protect your health data, medical vault records, location and guardian alerts."
      canonicalPath="/privacy-policy"
    />
    <LegalPageLayout title="Privacy Policy" sections={sections} />
  </>
);

export default PrivacyPolicy;
