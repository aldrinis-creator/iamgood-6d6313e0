import { useState } from "react";
import { Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const DISMISS_KEY = "email_prompt_dismissed";

interface EmailPromptBannerProps {
  userEmail?: string | null;
}

const EmailPromptBanner = ({ userEmail }: EmailPromptBannerProps) => {
  const [dismissed, setDismissed] = useState(() => !!sessionStorage.getItem(DISMISS_KEY));
  const navigate = useNavigate();

  // Don't show if user has a real email (not a placeholder)
  if (!userEmail || !userEmail.endsWith("@phone.checkin.app")) return null;
  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 mb-4">
      <Mail className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Add your email</p>
        <p className="text-xs text-muted-foreground">Get important alerts and recover your account easily.</p>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate("/profile")}>
        Add
      </Button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => { sessionStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default EmailPromptBanner;
