import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import usePwaInstall from "@/hooks/usePwaInstall";

const DISMISSED_KEY = "pwa-install-dismissed";

const PwaInstallBanner = () => {
  const { canInstall, installApp } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");

  if (!canInstall || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleInstall = async () => {
    const accepted = await installApp();
    if (accepted) handleDismiss();
  };

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Download className="w-4 h-4 shrink-0" />
        <p className="text-xs font-medium truncate">Install Check-iN for quick access & offline use</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" variant="secondary" className="h-7 text-xs px-3" onClick={handleInstall}>
          Install
        </Button>
        <button onClick={handleDismiss} className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
