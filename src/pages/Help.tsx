import { useState } from "react";
import { HelpCircle, Mail, Settings as SettingsIcon, Shield, FileText, Download, Heart, Moon, CalendarDays, Users, ShieldCheck, AlertTriangle, CalendarClock, User, Bell, Pill, Utensils, Trophy, ScanLine, Watch, Dumbbell, Lock, Stethoscope, Building2, Ambulance, FileText as FileTextIcon, Rocket, Globe, BookOpen, AlertCircle, ShieldAlert, LogOut } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { faqSections, FAQ_VERSION } from "@/data/faqData";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
};

type HelpTab = "faq" | "contact" | "settings" | "privacy" | "terms";

const Help = () => {
  const [activeTab, setActiveTab] = useState<HelpTab>("faq");
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    { id: "faq", label: "FAQ", icon: <HelpCircle className="w-4 h-4" /> },
    { id: "contact", label: "Contact Us", icon: <Mail className="w-4 h-4" /> },
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

  return (
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Learn about all the features and how to use My Health Companion effectively.
              </p>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>

            {faqSections.map((section) => (
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

        {activeTab === "contact" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Contact Us
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Have questions, feedback, or need assistance? We'd love to hear from you.
                </p>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Email Support</p>
                    <p className="text-sm text-primary">support@myhealthcompanion.in</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">WhatsApp Support</p>
                    <p className="text-sm text-primary">+91 98765 43210</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Response Time</p>
                    <p className="text-xs text-muted-foreground">We typically respond within 24 hours on business days.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
  );
};

export default Help;
