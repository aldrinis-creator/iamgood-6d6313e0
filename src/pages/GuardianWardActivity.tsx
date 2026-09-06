import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Pill, Bell, MapPin, Activity, BriefcaseMedical, RefreshCw, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import { useIsPrimaryGuardian } from "@/hooks/useIsPrimaryGuardian";
import WardMedicationStatus from "@/components/WardMedicationStatus";
import WardMedicationAdherence from "@/components/WardMedicationAdherence";
import WardRefillOrder from "@/components/WardRefillOrder";
import HospitalKitCard from "@/components/guardian/HospitalKitCard";
import WardLocationMap, { SafeZone } from "@/components/guardian/WardLocationMap";
import { formatISTTime } from "@/lib/istTime";

type TileKey = "checkins" | "medications" | "alerts" | "kit";

const STATUS_LABELS: Record<string, string> = {
  ok: "Done",
  responded: "Done",
  late: "Late",
  missed: "Missed",
  pending: "Pending",
};

const GuardianWardActivity = () => {
  const navigate = useNavigate();
  const { selectedWard, loading } = useGuardianWard();
  const wardUserId = selectedWard?.userId || "";
  const wardName = selectedWard?.name || "Your ward";
  const { isPrimary } = useIsPrimaryGuardian(wardUserId || null);

  const [active, setActive] = useState<TileKey | null>(null);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [medSummary, setMedSummary] = useState<{ taken: number; total: number } | null>(null);
  const [wardLocation, setWardLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState(false);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [activeSOS, setActiveSOS] = useState(false);

  const load = useCallback(async () => {
    if (!wardUserId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [ciRes, notifRes, medRes, settingsRes, zonesRes, sosRes] = await Promise.all([
      supabase.from("check_ins").select("id, scheduled_at, status, responded_at")
        .eq("user_id", wardUserId).gte("scheduled_at", todayStart.toISOString())
        .order("scheduled_at", { ascending: true }),
      supabase.from("notifications").select("*")
        .eq("user_id", wardUserId).order("created_at", { ascending: false }).limit(10),
      supabase.from("medication_logs").select("id, status")
        .eq("user_id", wardUserId).gte("scheduled_at", todayStart.toISOString()),
      supabase.from("user_settings" as any).select("settings").eq("user_id", wardUserId).maybeSingle(),
      supabase.from("safe_zones" as any).select("*").eq("user_id", wardUserId).eq("enabled", true),
      supabase.from("sos_events").select("id, latitude, longitude").eq("user_id", wardUserId)
        .eq("status", "active").order("triggered_at", { ascending: false }).limit(1),
    ]);

    setCheckIns(ciRes.data || []);
    setNotifications(notifRes.data || []);

    const logs = medRes.data || [];
    setMedSummary({
      total: logs.length,
      taken: logs.filter((l: any) => l.status === "taken" || l.status === "taken_late").length,
    });

    const s = (settingsRes.data as any)?.settings;
    const consent = s?.shareLocationWithGuardian !== false && s?.shareLocation !== false;
    setLocationConsent(consent);
    if (consent && s?.lastLocation?.lat && s?.lastLocation?.lng) {
      setWardLocation({ lat: s.lastLocation.lat, lng: s.lastLocation.lng });
      setLocationUpdatedAt(s.lastLocationAt || null);
    } else if (!consent) {
      setWardLocation(null);
      setLocationUpdatedAt(null);
    }

    setSafeZones((zonesRes.data as unknown as SafeZone[]) || []);
    const sos = sosRes.data?.[0];
    setActiveSOS(!!sos);
    if (sos?.latitude && sos?.longitude) setWardLocation({ lat: sos.latitude, lng: sos.longitude });
  }, [wardUserId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const unread = notifications.filter((n) => !n.read);
  const missedCheckIns = checkIns.filter((c) => c.status === "missed").length;

  const tiles: { key: TileKey | "reports"; label: string; icon: any; sub: string; alert?: boolean }[] = [
    { key: "checkins", label: "Today's Check-iNs", icon: CheckCircle2, sub: `${checkIns.filter(c => c.status === "ok" || c.status === "responded" || c.status === "late").length}/${checkIns.length || 0} done`, alert: missedCheckIns > 0 },
    { key: "medications", label: "Medications", icon: Pill, sub: medSummary ? `${medSummary.taken}/${medSummary.total} doses` : "…" },
    { key: "alerts", label: "Alerts", icon: Bell, sub: unread.length ? `${unread.length} unread` : "No active alerts", alert: unread.length > 0 },
    { key: "reports", label: "Data Analysis", icon: Activity, sub: "View reports" },
    ...(isPrimary ? [{ key: "kit" as TileKey, label: "Hospital Admittance Kit", icon: BriefcaseMedical, sub: "Documents" }] : []),
  ];

  if (loading || !wardUserId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-muted-foreground">
          {loading ? "Loading…" : "No ward linked to this account yet."}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/guardian")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">{wardName}'s Activity</h1>
        </div>

        {/* 6-tile grid */}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => (t.key === "reports" ? navigate("/guardian/reports") : setActive(isActive ? null : (t.key as TileKey)))}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  isActive ? "border-primary bg-primary/5" : t.alert ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                }`}
              >
                <t.icon className={`w-6 h-6 mb-2 ${t.alert ? "text-destructive" : "text-primary"}`} />
                <p className="text-sm font-semibold leading-tight">{t.label}</p>
                <p className={`text-xs ${t.alert ? "text-destructive" : "text-muted-foreground"}`}>{t.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Panels */}
        {active === "checkins" && (
          <Card>
            <CardContent className="p-4 space-y-2">
              {checkIns.length ? checkIns.map((ci) => (
                <div key={ci.id} className={`flex items-center justify-between py-2 border-b border-border last:border-0 ${ci.status === "missed" ? "bg-destructive/5 -mx-2 px-2 rounded" : ""}`}>
                  <span className="text-sm">{formatISTTime(ci.scheduled_at)}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ci.status === "ok" || ci.status === "responded" ? "bg-success/10 text-success" :
                    ci.status === "late" ? "bg-amber-500/10 text-amber-600 font-medium" :
                    ci.status === "missed" ? "bg-destructive/10 text-destructive font-semibold" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {STATUS_LABELS[ci.status] || ci.status}
                    {ci.responded_at && <span className="ml-1 opacity-75">· {formatISTTime(ci.responded_at)}</span>}
                  </span>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">No check-ins recorded today</p>}
            </CardContent>
          </Card>
        )}

        {active === "medications" && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {medSummary && medSummary.total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{medSummary.taken} of {medSummary.total} doses taken</span>
                    <span className="font-medium">{Math.round((medSummary.taken / medSummary.total) * 100)}%</span>
                  </div>
                  <Progress value={Math.round((medSummary.taken / medSummary.total) * 100)} className="h-2" />
                </div>
              )}
              <WardMedicationStatus wardUserId={wardUserId} wardName={wardName} />
              <WardMedicationAdherence wardUserId={wardUserId} wardName={wardName} />
              <WardRefillOrder wardUserId={wardUserId} wardName={wardName} />
            </CardContent>
          </Card>
        )}

        {active === "alerts" && (
          <Card className={unread.length ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardContent className="p-4 space-y-2">
              {unread.length ? unread.slice(0, 5).map((n) => (
                <div key={n.id} className="p-3 rounded-lg bg-card border border-destructive/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="text-[10px] text-muted-foreground">{formatISTTime(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => markAsRead(n.id)}>Dismiss</Button>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center">No active alerts</p>}
            </CardContent>
          </Card>
        )}

        {active === "kit" && isPrimary && (
          <HospitalKitCard wardUserId={wardUserId} wardName={wardName} />
        )}

        {missedCheckIns > 0 && (
          <Badge variant="destructive" className="text-[11px]">
            {wardName} missed {missedCheckIns} check-in{missedCheckIns > 1 ? "s" : ""} today
          </Badge>
        )}
      </div>
    </AppLayout>
  );
};

export default GuardianWardActivity;
