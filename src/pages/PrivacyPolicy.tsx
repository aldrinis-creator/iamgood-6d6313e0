import AppLayout from "@/components/AppLayout";

const PrivacyPolicy = () => {
  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Information We Collect</h2>
          <p className="text-sm text-muted-foreground">We collect personal information you provide, including your name, phone number, emergency contacts, health data, and location when using emergency features. We also collect device information and usage data to improve our services.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Use of Cookies</h2>
          <p className="text-sm text-muted-foreground">We use cookies and similar technologies to remember your preferences, maintain your session, and analyse how our app is used. You can manage your cookie preferences via the Cookie Settings option in the app footer.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">How We Use Your Data</h2>
          <p className="text-sm text-muted-foreground">Your data is used to provide emergency response services, notify your guardians during emergencies, store your medical records securely, and improve our services. We do not sell your personal information to third parties.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Data Sharing</h2>
          <p className="text-sm text-muted-foreground">We share your information only with your designated guardians, emergency services when you trigger an SOS, and service providers who assist in delivering our services. All third parties are bound by confidentiality agreements.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Data Security</h2>
          <p className="text-sm text-muted-foreground">We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal and medical data. Your medical vault data is encrypted at rest and in transit.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Your Rights</h2>
          <p className="text-sm text-muted-foreground">You have the right to access, correct, or delete your personal data. You can export your data or request account deletion through the Settings page. We will respond to your requests within 30 days.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Contact Us</h2>
          <p className="text-sm text-muted-foreground">If you have questions about this Privacy Policy, please contact us at privacy@checkin-app.in.</p>
        </section>
      </div>
    </AppLayout>
  );
};

export default PrivacyPolicy;
