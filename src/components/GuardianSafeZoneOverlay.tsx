import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Button } from "@/components/ui/button";
import { MapPin, CheckCircle2, X } from "lucide-react";
import { playChime } from "@/lib/audioAlerts";

type ZoneAlert = {
  id: string;
  type: "zone_far" | "zone_far_return";
  title: string;
  message: string;
};

const AUTO_DISMISS_RETURN_MS = 8000;

const GuardianSafeZoneOverlay = () => {
  const { session } = useAuth();
  const { settings } = useUserSettings();
  const [alert, setAlert] = useState<ZoneAlert | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(async () => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    if (alert) {
      await supabase.from("notifications").update({ read: true }).eq("id", alert.id);
    }
    setAlert(null);
  }, [alert]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (settings.guardianSafeZoneAlerts === false) return;

    const channel = supabase
      .channel("guardian-safezone-overlay")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: any) => {
          const n = payload.new as any;
          if (n?.type !== "zone_far" && n?.type !== "zone_far_return") return;

          setAlert({
            id: n.id,
            type: n.type,
            title: n.title || (n.type === "zone_far" ? "Ward far from safe zone" : "Ward back in safe zone"),
            message: n.message || "",
          });
          playChime();
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

          if (n.type === "zone_far_return") {
            if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
            autoDismissRef.current = setTimeout(() => {
              supabase.from("notifications").update({ read: true }).eq("id", n.id);
              setAlert(null);
            }, AUTO_DISMISS_RETURN_MS);
          }
        }
      )
      .subscribe();

    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, settings.guardianSafeZoneAlerts]);

  if (!alert) return null;

  const isReturn = alert.type === "zone_far_return";

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative mx-6 max-w-sm w-full rounded-2xl bg-card border-2 p-6 shadow-2xl text-center space-y-4"
        style={{ borderColor: isReturn ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            isReturn ? "bg-primary/10" : "bg-destructive/10"
          }`}
        >
          {isReturn ? (
            <CheckCircle2 className="w-8 h-8 text-primary" />
          ) : (
            <MapPin className="w-8 h-8 text-destructive" />
          )}
        </div>

        <h2 className="text-lg font-semibold text-foreground">
          {isReturn ? "✅ Ward back in safe zone" : "🚨 Ward far from safe zone"}
        </h2>
        <p className="text-base text-muted-foreground">{alert.message}</p>

        <Button
          onClick={dismiss}
          className="w-full"
          variant={isReturn ? "default" : "destructive"}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

export default GuardianSafeZoneOverlay;
