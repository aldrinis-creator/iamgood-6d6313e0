import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { playChime } from "@/lib/audioAlerts";

export type ZoneApproachDetail = {
  zoneId: string;
  zoneName: string;
  lat: number;
  lng: number;
};

export const ZONE_APPROACH_EVENT = "checkin:zone-approaching-exit";

const SafeZoneExitPrompt = () => {
  const { session } = useAuth();
  const [pending, setPending] = useState<ZoneApproachDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ZoneApproachDetail>).detail;
      if (!detail) return;
      setPending(detail);
      playChime();
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    };
    window.addEventListener(ZONE_APPROACH_EVENT, handler as EventListener);
    return () => window.removeEventListener(ZONE_APPROACH_EVENT, handler as EventListener);
  }, []);

  const userId = session?.user?.id;

  const handleYes = async () => {
    if (!pending || !userId) return;
    setBusy(true);
    try {
      const [{ data: profile }, { data: guardians }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
        supabase
          .from("guardians")
          .select("guardian_user_id")
          .eq("user_id", userId)
          .eq("status", "accepted")
          .eq("is_primary", true)
          .not("guardian_user_id", "is", null)
          .limit(1),
      ]);

      const primary = guardians?.[0]?.guardian_user_id;
      if (primary) {
        const now = new Date();
        const when = now.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        await supabase.from("notifications").insert({
          user_id: primary,
          title: "Ward leaving safe zone",
          message: `${profile?.full_name || "Your ward"} is moving out of the "${pending.zoneName}" safe zone (${when} IST).`,
          type: "zone_approaching_exit",
          read: false,
        });
      }
    } catch (e) {
      console.error("zone approach notify failed", e);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const handleNo = async () => {
    if (!pending || !userId) return;
    setBusy(true);
    try {
      await supabase.from("zone_exit_declines").insert({
        user_id: userId,
        zone_id: pending.zoneId,
        zone_name: pending.zoneName,
        lat: pending.lat,
        lng: pending.lng,
      });
    } catch (e) {
      console.error("zone decline record failed", e);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-6 max-w-sm w-full rounded-2xl bg-card border-2 border-primary p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          You're about to leave {pending.zoneName}
        </h2>
        <p className="text-base text-muted-foreground">
          Let your Primary Guardian know?
        </p>
        <div className="flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={handleYes}>
            Yes
          </Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={handleNo}>
            No
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SafeZoneExitPrompt;
