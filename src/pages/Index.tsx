import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Heart, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SeoMeta from "@/components/SeoMeta";

const Index = () => {
  const { isLoggedIn, role } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate(role === "user" ? "/dashboard" : "/guardian");
    }
  }, [isLoggedIn, role, navigate]);

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-primary-foreground">
      <SeoMeta
        title="Check-iN — Medication Reminder & Senior Safety App for India"
        description="India's medication reminder, elderly care & emergency alert app for seniors. One-tap SOS, guardian alerts, medical vault & health tracking."
        keywords="medication reminder app, elderly care app, senior safety app, emergency alert app, personal emergency response system, senior health app India, guardian alert app, fall detection, medical vault, pill reminder"
        canonicalPath="/"
      />
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-24 h-24 rounded-full bg-success mx-auto flex items-center justify-center">
            <Heart className="w-12 h-12 text-success-foreground fill-current" />
          </div>
          <h1 className="text-4xl font-bold">Check-iN</h1>
          <p className="text-lg opacity-90">
            Your AI-Powered Personal Emergency Response System
          </p>
        </div>

        <div className="space-y-3 text-left">
          {[
            { icon: "💓", text: "Scheduled safety check-ins with auto-alerts" },
            { icon: "🚨", text: "One-tap SOS with live location sharing" },
            { icon: "🛡️", text: "Guardian dashboard with real-time tracking" },
            { icon: "🏥", text: "Medical vault & priority ambulance" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3 bg-primary-foreground/10 rounded-lg p-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-sm">{f.text}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-4">
          <Button
            size="lg"
            className="w-full bg-success text-success-foreground hover:bg-success/90 text-lg py-6"
            onClick={() => navigate("/register")}
          >
            Get Started <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full border-primary-foreground/50 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 text-lg py-6"
            onClick={() => navigate("/login")}
          >
            Sign In
          </Button>
        </div>

        <p className="text-xs opacity-60">
          Protecting seniors & lone dwellers across India 🇮🇳
        </p>
      </div>
    </div>
  );
};

export default Index;
