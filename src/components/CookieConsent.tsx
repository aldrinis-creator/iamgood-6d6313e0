import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) {
      setIsVisible(true);
    }
  }, []);

  const handleChoice = (choice: "accepted" | "rejected") => {
    localStorage.setItem("cookie-consent", choice);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            We use cookies to improve your experience. By continuing, you agree to our use of cookies.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => handleChoice("rejected")}>
            Reject
          </Button>
          <Button size="sm" className="bg-success hover:bg-success/90 text-white" onClick={() => handleChoice("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
