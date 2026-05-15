import AppLayout from "@/components/AppLayout";
import ContactUsForm from "@/components/ContactUsForm";
import SeoMeta from "@/components/SeoMeta";

const ContactUs = () => {
  return (
    <>
      <SeoMeta
        title="Contact Us"
        description="Contact Check-iN support for questions about our medication reminder, elderly care & emergency alert app. Email, phone, and WhatsApp support available."
        canonicalPath="/contact-us"
      />
      <AppLayout>
        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Contact Us</h1>
            <p className="text-sm text-muted-foreground">
              Have a question, found a bug, or want to suggest a feature? Send us a message.
            </p>
          </div>
          <ContactUsForm />
        </div>
      </AppLayout>
    </>
  );
};

export default ContactUs;
