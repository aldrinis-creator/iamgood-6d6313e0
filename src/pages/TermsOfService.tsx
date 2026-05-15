import LegalPageLayout from "@/components/LegalPageLayout";
import SeoMeta from "@/components/SeoMeta";

const sections = [
  { heading: "Acceptance of Terms", content: "By accessing or using Check-iN, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services." },
  { heading: "Description of Service", content: "Check-iN is a Personal Emergency Response System (PERS) that provides health check-ins, emergency SOS alerts, guardian notifications, medical vault storage, and related services. The app is designed to assist users in emergencies but is not a replacement for professional emergency services." },
  { heading: "User Accounts", content: "You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate and complete information during registration and keep it updated." },
  { heading: "Emergency Services Disclaimer", content: "Check-iN is not an emergency service provider. In case of a medical emergency, always call your local emergency number (112 in India) immediately. Our SOS feature notifies your designated guardians but does not guarantee emergency response. We are not liable for delays or failures in emergency communication." },
  { heading: "Subscription & Payments", content: "Certain features require a paid subscription. All prices are listed in Indian Rupees (₹). Subscriptions auto-renew unless cancelled before the renewal date. Refunds are subject to our refund policy. Ambulance services are charged separately at ₹1,500 for the first 5 km and ₹300 per km thereafter." },
  { heading: "Limitation of Liability", content: "To the maximum extent permitted by law, Check-iN and its affiliates shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the preceding 12 months." },
  { heading: "Termination", content: "We reserve the right to suspend or terminate your account if you violate these terms. You may delete your account at any time through the Settings page. Upon termination, your data will be handled in accordance with our Privacy Policy." },
  { heading: "Governing Law", content: "These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in India." },
  { heading: "Contact Us", content: "If you have questions about these Terms of Service, please contact us at checkin_support@futurewave.in." },
];

const TermsOfService = () => (
  <>
    <SeoMeta
      title="Terms of Service"
      description="Check-iN Terms of Service — India's medication reminder, elderly care & emergency alert app. Subscriptions, emergency disclaimer, and liability."
      canonicalPath="/terms-of-service"
    />
    <LegalPageLayout title="Terms of Service" sections={sections} />
  </>
);

export default TermsOfService;
