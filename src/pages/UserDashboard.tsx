import { CalendarDays, ChevronRight, Droplets, AlertTriangle } from "lucide-react";
import EmailPromptBanner from "@/components/EmailPromptBanner";
import VaultClaimCancelBanner from "@/components/vault/VaultClaimCancelBanner";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import CheckInCard from "@/components/CheckInCard";
import NeedHelpButton from "@/components/NeedHelpButton";
import AppLayout from "@/components/AppLayout";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import OnboardingWizard from "@/components/OnboardingWizard";
import VoiceAgentButton from "@/components/VoiceAgentButton";
import SOSDialog from "@/components/SOSDialog";

const UserDashboard = () => {
  const todayAppointments = useTodayAppointments();
  const navigate = useNavigate();

  const { settings } = useUserSettings();

  const { session } = useAuth();
  const signupDateStr = session?.user?.created_at;
  const isNewUser = signupDateStr ? (Date.now() - new Date(signupDateStr).getTime()) < 30 * 24 * 60 * 60 * 1000 : true;

  

  const [showPracticeDialog, setShowPracticeDialog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("onboarding_complete");
  });

  // Hydration high-risk banner state
  const [hydration, setHydration] = useState<{ humidity?: number; temp?: number; level: string } | null>(null);
  const [hydrationDismissed, setHydrationDismissed] = useState(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    return localStorage.getItem("hydration_banner_dismissed_date") === today;
  });
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setHydration(d);
    };
    window.addEventListener("hydration-level", handler);
    return () => window.removeEventListener("hydration-level", handler);
  }, []);
  const dismissHydrationBanner = () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    localStorage.setItem("hydration_banner_dismissed_date", today);
    setHydrationDismissed(true);
  };
  const showHydrationBanner = settings.hydrationNudges && (hydration?.level === "high_risk" || hydration?.level === "reminder") && !hydrationDismissed;
  const isHighRisk = hydration?.level === "high_risk";

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <VaultClaimCancelBanner />
        <EmailPromptBanner userEmail={session?.user?.email} />
        

        {/* Hydration High-Risk Banner */}
        {showHydrationBanner && (
          <Card className={isHighRisk ? "border-orange-500/50 bg-orange-500/10" : "border-amber-500/40 bg-amber-500/10"}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${isHighRisk ? "bg-orange-500/20" : "bg-amber-500/20"}`}>
                  <Droplets className={`w-8 h-8 ${isHighRisk ? "text-orange-600" : "text-amber-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-1">
                    {isHighRisk ? "🥵 Hot & humid today" : "💧 Stay hydrated"}
                  </h3>
                  <p className="text-base text-foreground leading-relaxed">
                    {isHighRisk
                      ? `It's ${Math.round(hydration!.temp!)}°C with ${Math.round(hydration!.humidity!)}% humidity. Please sip water often.`
                      : "It's humid today — drink a glass of water now."}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="lg" className="w-full text-base" onClick={dismissHydrationBanner}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Check-In Card */}
        <CheckInCard />

        {/* I NEED HELP */}
        <NeedHelpButton />

        {/* Practice SOS */}
        {isNewUser && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-sos/30 bg-sos/5" onClick={() => setShowPracticeDialog(true)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sos/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-sos" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-t1">Practice SOS Mode</h3>
                <p className="text-xs text-t2">Test the alarm safely without notifying anyone</p>
              </div>
              <ChevronRight className="w-4 h-4 text-t2 shrink-0" />
            </CardContent>
          </Card>
        )}

        {/* Today's Appointments */}
        {todayAppointments > 0 && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20" onClick={() => navigate("/appointments")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Today's Appointments</h3>
                <p className="text-xs text-muted-foreground">You have {todayAppointments} appointment{todayAppointments > 1 ? "s" : ""} today</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        )}

      </div>

      <SOSDialog open={showPracticeDialog} onClose={() => setShowPracticeDialog(false)} isPracticeMode={true} />

      {showOnboarding && (
        <OnboardingWizard
          open={showOnboarding}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <VoiceAgentButton persona="user" />
    </AppLayout>
  );
};

export default UserDashboard;
