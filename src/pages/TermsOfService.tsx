import AppLayout from "@/components/AppLayout";

const TermsOfService = () => {
  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground">By accessing or using Check-iN, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Description of Service</h2>
          <p className="text-sm text-muted-foreground">Check-iN is a Personal Emergency Response System (PERS) that provides health check-ins, emergency SOS alerts, guardian notifications, medical vault storage, and related services. The app is designed to assist users in emergencies but is not a replacement for professional emergency services.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">User Accounts</h2>
          <p className="text-sm text-muted-foreground">You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate and complete information during registration and keep it updated.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Emergency Services Disclaimer</h2>
          <p className="text-sm text-muted-foreground">Check-iN is not an emergency service provider. In case of a medical emergency, always call your local emergency number (112 in India) immediately. Our SOS feature notifies your designated guardians but does not guarantee emergency response. We are not liable for delays or failures in emergency communication.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Subscription & Payments</h2>
          <p className="text-sm text-muted-foreground">Certain features require a paid subscription. All prices are listed in Indian Rupees (₹). Subscriptions auto-renew unless cancelled before the renewal date. Refunds are subject to our refund policy. Ambulance services are charged separately at ₹1,500 for the first 5 km and ₹300 per km thereafter.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground">To the maximum extent permitted by law, Check-iN and its affiliates shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the preceding 12 months.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Termination</h2>
          <p className="text-sm text-muted-foreground">We reserve the right to suspend or terminate your account if you violate these terms. You may delete your account at any time through the Settings page. Upon termination, your data will be handled in accordance with our Privacy Policy.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Governing Law</h2>
          <p className="text-sm text-muted-foreground">These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in India.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Contact Us</h2>
          <p className="text-sm text-muted-foreground">If you have questions about these Terms of Service, please contact us at support@checkin-app.in.</p>
        </section>
      </div>
    </AppLayout>
  );
};

export default TermsOfService;
