import { MessageCircle, Phone, Mail, Clock, HelpCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import SeoMeta from "@/components/SeoMeta";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import ContactUsForm from "@/components/ContactUsForm";

const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string) || "917045868482";
const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE as string) || "+917045868482";
const SUPPORT_HOURS = "Mon–Sat, 9 AM – 6 PM IST";

const CustomerService = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const prefilledText = encodeURIComponent(
    `Hi Check-iN Support,\n\nI need help.\n\nName: ${profile?.full_name || ""}\nPhone: ${profile?.phone || ""}\nRole: ${profile?.role || ""}\n\nQuestion: `
  );
  const waUrl = `https://wa.me/${SUPPORT_WHATSAPP.replace(/[^\d]/g, "")}?text=${prefilledText}`;
  const telUrl = `tel:${SUPPORT_PHONE.replace(/\s/g, "")}`;

  return (
    <AppLayout>
      <SeoMeta
        title="Customer Service"
        description="Reach Check-iN customer service via WhatsApp, phone or email. Mon–Sat 9 AM–6 PM IST support for medication, check-in, SOS and Guardian queries."
        canonicalPath="/support"
      />
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Customer Service</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5" /> {SUPPORT_HOURS}
          </p>
        </div>

        {/* WhatsApp */}
        <Card className="border-success/30 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-foreground">Chat on WhatsApp</h3>
                <p className="text-xs text-muted-foreground">Fastest reply. Your details pre-filled.</p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Phone */}
        <Card className="border-primary/30 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <a href={telUrl} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-foreground">Call Support</h3>
                <p className="text-xs text-muted-foreground">{SUPPORT_PHONE} · {SUPPORT_HOURS}</p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* FAQ link */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(profile?.role === "guardian" ? "/guardian-help" : "/help")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              <HelpCircle className="w-6 h-6 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-foreground">Browse FAQs</h3>
              <p className="text-xs text-muted-foreground">Most questions answered here.</p>
            </div>
          </CardContent>
        </Card>

        {/* Email ticket */}
        <div className="pt-2">
          <h2 className="text-base font-semibold flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-primary" /> Email a ticket
          </h2>
          <ContactUsForm />
        </div>
      </div>
    </AppLayout>
  );
};

export default CustomerService;
