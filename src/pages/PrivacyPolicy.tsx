import LegalPageLayout from "@/components/LegalPageLayout";
import SeoMeta from "@/components/SeoMeta";

const sections = [
  { heading: "Information We Collect", content: "We collect personal information you provide, including your name, phone number, emergency contacts, health data, and location when using emergency features. We also collect device information and usage data to improve our services." },
  { heading: "Use of Cookies", content: "We use cookies and similar technologies to remember your preferences, maintain your session, and analyse how our app is used. You can manage your cookie preferences via the Cookie Settings option in the app footer." },
  { heading: "How We Use Your Data", content: "Your data is used to provide emergency response services, notify your guardians during emergencies, store your medical records securely, and improve our services. We do not sell your personal information to third parties." },
  { heading: "Data Sharing", content: "We share your information only with your designated guardians, emergency services when you trigger an SOS, and service providers who assist in delivering our services. All third parties are bound by confidentiality agreements." },
  { heading: "Data Security", content: "We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal and medical data. Your medical vault data is encrypted at rest and in transit." },
  { heading: "Your Rights", content: "You have the right to access, correct, or delete your personal data. You can export your data or request account deletion through the Settings page. We will respond to your requests within 30 days." },
  { heading: "Contact Us", content: "If you have questions about this Privacy Policy, please contact us at checkin_support@futurewave.in." },
];

const PrivacyPolicy = () => (
  <>
    <SeoMeta
      title="Privacy Policy"
      description="Check-iN Privacy Policy — how we protect your health data, medical vault records, and guardian alerts. DPDP Act compliant."
      canonicalPath="/privacy-policy"
    />
    <LegalPageLayout title="Privacy Policy" sections={sections} />
  </>
);

export default PrivacyPolicy;
