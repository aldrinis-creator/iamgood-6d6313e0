import { useState, useMemo, useEffect } from "react";
import { HelpCircle, Mail, Settings as SettingsIcon, Shield, FileText, Download, Heart, Moon, CalendarDays, Users, ShieldCheck, AlertTriangle, CalendarClock, User, Bell, Pill, Utensils, Trophy, ScanLine, Watch, Dumbbell, Lock, Stethoscope, Building2, Ambulance, FileText as FileTextIcon, Rocket, Globe, BookOpen, AlertCircle, ShieldAlert, LogOut, Search, Crown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { faqSections, FAQ_VERSION } from "@/data/faqData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SeoMeta from "@/components/SeoMeta";

const iconMap: Record<string, React.ReactNode> = {
  heart: <Heart className="w-5 h-5 text-destructive" />,
  moon: <Moon className="w-5 h-5 text-primary" />,
  calendar: <CalendarDays className="w-5 h-5 text-success" />,
  shield: <Users className="w-5 h-5 text-primary" />,
  "shield-check": <ShieldCheck className="w-5 h-5 text-success" />,
  "alert-triangle": <AlertTriangle className="w-5 h-5 text-destructive" />,
  "calendar-clock": <CalendarClock className="w-5 h-5 text-primary" />,
  user: <User className="w-5 h-5 text-primary" />,
  bell: <Bell className="w-5 h-5 text-warning" />,
  pill: <Pill className="w-5 h-5 text-success" />,
  utensils: <Utensils className="w-5 h-5 text-primary" />,
  trophy: <Trophy className="w-5 h-5 text-warning" />,
  scan: <ScanLine className="w-5 h-5 text-primary" />,
  watch: <Watch className="w-5 h-5 text-primary" />,
  dumbbell: <Dumbbell className="w-5 h-5 text-success" />,
  lock: <Lock className="w-5 h-5 text-destructive" />,
  stethoscope: <Stethoscope className="w-5 h-5 text-primary" />,
  hospital: <Building2 className="w-5 h-5 text-primary" />,
  ambulance: <Ambulance className="w-5 h-5 text-destructive" />,
  "file-text": <FileTextIcon className="w-5 h-5 text-primary" />,
  rocket: <Rocket className="w-5 h-5 text-success" />,
  globe: <Globe className="w-5 h-5 text-primary" />,
  "book-open": <BookOpen className="w-5 h-5 text-primary" />,
  "alert-circle": <AlertCircle className="w-5 h-5 text-destructive" />,
  "shield-lock": <ShieldAlert className="w-5 h-5 text-primary" />,
  crown: <Crown className="w-5 h-5 text-warning" />,
};

type HelpTab = "faq" | "settings" | "privacy" | "terms";

const Help = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as HelpTab) || "faq";
  const [activeTab, setActiveTab] = useState<HelpTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    const t = searchParams.get("tab") as HelpTab | null;
    if (t && ["faq", "settings", "privacy", "terms"].includes(t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    { id: "faq", label: "FAQ", icon: <HelpCircle className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="w-4 h-4" /> },
    { id: "privacy", label: "Privacy", icon: <Shield className="w-4 h-4" /> },
    { id: "terms", label: "Terms", icon: <FileText className="w-4 h-4" /> },
  ];

  const handleTabClick = (tab: HelpTab) => {
    setActiveTab(tab);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleDownloadFaq = () => {
    const lines: string[] = [];
    lines.push(`# Check-iN FAQ — v${FAQ_VERSION}`);
    lines.push("");
    lines.push(`_Generated ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}_`);
    lines.push("");
    lines.push("---");
    lines.push("");
    for (const section of faqSections) {
      lines.push(`## ${section.title}`);
      lines.push("");
      for (const item of section.items) {
        lines.push(`### Q: ${item.question}`);
        lines.push("");
        lines.push(item.answer);
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }
    lines.push("");
    lines.push("> This document is for informational purposes only and does not constitute medical advice. For emergencies, always call your local emergency number (112 in India).");
    lines.push("");
    lines.push(`_Check-iN by Future Wave · checkin_support@futurewave.in_`);

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Check-iN-FAQ-${FAQ_VERSION}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("FAQ downloaded");
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return faqSections;
    const q = searchQuery.toLowerCase();
    return faqSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) ||
            item.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery]);

  return (
    <>
      <SeoMeta
        title="Help & Settings"
        description="Check-iN Help Centre — FAQs, settings, privacy policy, and terms of service for India's medication reminder, elderly care & emergency alert app."
        canonicalPath="/help"
      />
      <AppLayout>
        <div className="p-4 space-y-4">
        {/* Tab bar */}
        <nav className="flex gap-1 overflow-x-auto bg-muted rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "faq" && (
          <div className="space-y-4">
            {/* How Check-iN Works */}
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-destructive" />
                  How Check-iN Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground pt-0">
                <div className="flex gap-3 items-start">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <p><strong className="text-foreground">Set Your Schedule:</strong> Choose your daily Check-iN times (default: 7AM, 12PM, 7PM).</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <p><strong className="text-foreground">Tap the Heart:</strong> When prompted, tap the pulsing heart to confirm you're okay.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <p><strong className="text-foreground">Automatic Alerts:</strong> If you miss a Check-iN, your guardians are notified automatically.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold shrink-0">!</span>
                  <p><strong className="text-foreground">SOS Anytime:</strong> Press the SOS button for immediate emergency alert with live location sharing.</p>
                </div>
              </CardContent>
            </Card>

            {/* AI Health Companion */}
            <Card className="bg-gradient-to-r from-primary/10 to-success/10 border-0">
              <CardContent className="p-4">
                <h3 className="text-base font-semibold mb-2">🤖 AI Health Companion</h3>
                <p className="text-sm text-muted-foreground">
                  Check-iN uses AI to learn your daily patterns and detect unusual inactivity.
                  Combined with phone-based fall detection, it provides a proactive safety net — even without wearable hardware.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Learn about all the features and how to use My Health Companion effectively.
              </p>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleDownloadFaq}>
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredSections.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No FAQs match "{searchQuery}"</p>
            )}

            {filteredSections.map((section) => (
              <Card key={section.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {iconMap[section.icon] || <HelpCircle className="w-5 h-5 text-primary" />}
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item, idx) => (
                      <AccordionItem key={idx} value={`${section.title}-${idx}`} className="border-border/50">
                        <AccordionTrigger className="text-sm text-left py-3 hover:no-underline">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground pb-3">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}

            <p className="text-xs text-center text-muted-foreground pt-2">
              FAQ version: {FAQ_VERSION} · This document is for informational purposes only.
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Manage your app preferences and configurations.</p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/settings")}>
              <SettingsIcon className="w-4 h-4 mr-2" />
              Open Full Settings
            </Button>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Privacy Policy</h2>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            {[
              { heading: "Information We Collect", content: "We collect personal information you provide, including your name, phone number, emergency contacts, health data, and location when using emergency features. We also collect device information and usage data to improve our services." },
              { heading: "Use of Cookies", content: "We use cookies and similar technologies to remember your preferences, maintain your session, and analyse how our app is used. You can manage your cookie preferences via the Cookie Settings option in the app footer." },
              { heading: "How We Use Your Data", content: "Your data is used to provide emergency response services, notify your guardians during emergencies, store your medical records securely, and improve our services. We do not sell your personal information to third parties." },
              { heading: "Data Sharing", content: "We share your information only with your designated guardians, emergency services when you trigger an SOS, and service providers who assist in delivering our services. All third parties are bound by confidentiality agreements." },
              { heading: "Data Security", content: "We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal and medical data. Your medical vault data is encrypted at rest and in transit." },
              { heading: "Your Rights", content: "You have the right to access, correct, or delete your personal data. You can export your data or request account deletion through the Settings page. We will respond to your requests within 30 days." },
              { heading: "Contact Us", content: "If you have questions about this Privacy Policy, please contact us at checkin_support@futurewave.in." },
            ].map((s) => (
              <section key={s.heading} className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">{s.heading}</h3>
                <p className="text-sm text-muted-foreground">{s.content}</p>
              </section>
            ))}
          </div>
        )}

        {activeTab === "terms" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Terms of Service</h2>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            {[
              { heading: "Acceptance of Terms", content: "By accessing or using Check-iN, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services." },
              { heading: "Description of Service", content: "Check-iN is a Personal Emergency Response System (PERS) that provides health check-ins, emergency SOS alerts, guardian notifications, medical vault storage, and related services." },
              { heading: "User Accounts", content: "You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate and complete information during registration." },
              { heading: "Emergency Services Disclaimer", content: "Check-iN is not an emergency service provider. In case of a medical emergency, always call your local emergency number (112 in India) immediately. Our SOS feature notifies your designated guardians but does not guarantee emergency response." },
              { heading: "Subscription & Payments", content: "Certain features require a paid subscription. All prices are listed in Indian Rupees (₹). Subscriptions auto-renew unless cancelled before the renewal date. Ambulance services are charged separately at ₹1,500 for the first 5 km and ₹300 per km thereafter." },
              { heading: "Limitation of Liability", content: "To the maximum extent permitted by law, Check-iN and its affiliates shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service." },
              { heading: "Termination", content: "We reserve the right to suspend or terminate your account if you violate these terms. You may delete your account at any time through the Settings page." },
              { heading: "Governing Law", content: "These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in India." },
              { heading: "Contact Us", content: "If you have questions about these Terms of Service, please contact us at checkin_support@futurewave.in." },
            ].map((s) => (
              <section key={s.heading} className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">{s.heading}</h3>
                <p className="text-sm text-muted-foreground">{s.content}</p>
              </section>
            ))}
          </div>
        )}

        {/* Logout button */}
        <div className="pt-4 pb-2">
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </div>
      </div>
    </AppLayout>
  </>
  );
};

export default Help;
