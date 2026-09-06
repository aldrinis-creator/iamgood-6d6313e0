import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Pill } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useGuardianWard } from "@/contexts/GuardianWardContext";
import WardHealthScoreRing from "@/components/WardHealthScoreRing";
import WardMedicationStatus from "@/components/WardMedicationStatus";
import WardVitalsSummary from "@/components/WardVitalsSummary";
import useRefillDue from "@/hooks/useRefillDue";
import { formatISTTime } from "@/lib/istTime";

const GuardianActivity = () => {
  const { selectedWard, loading } = useGuardianWard();
  const wardUserId = selectedWard?.userId || "";
  const wardName = selectedWard?.name || "Your ward";
  const refillDue = useRefillDue(wardUserId || undefined);
  const [checkIns, setCheckIns] = useState<any[]>([]);

  useEffect(() => {
    if (!wardUserId) return;
    const load = async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from("check_ins")
        .select("id, scheduled_at, responded_at, status")
        .eq("user_id", wardUserId)
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at");
      setCheckIns(data || []);
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [wardUserId]);

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
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> {wardName}'s Activity
        </h1>

        {/* 1. Check-ins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checkIns.length ? checkIns.map((ci) => (
              <div key={ci.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5">
                <span>{formatISTTime(ci.scheduled_at)}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {ci.status}{ci.responded_at ? ` · ${formatISTTime(ci.responded_at)}` : ""}
                </span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No check-ins recorded today</p>}
          </CardContent>
        </Card>

        {/* 2. Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Health</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <WardHealthScoreRing wardUserId={wardUserId} />
            <p className="text-sm text-muted-foreground">Today's health score for {wardName}</p>
          </CardContent>
        </Card>

        {/* 3. Meds */}
        <Card className={refillDue ? "border-destructive/50 bg-destructive/10" : "border-primary/30 bg-primary/10"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className={`w-4 h-4 ${refillDue ? "text-destructive" : "text-primary"}`} /> Meds
              {refillDue && (
                <>
                  <span className="min-w-[18px] h-[18px] px-1 text-[11px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center animate-pulse">!</span>
                  <span className="text-xs font-semibold text-destructive">Refill running low</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WardMedicationStatus wardUserId={wardUserId} wardName={wardName} />
          </CardContent>
        </Card>

        {/* 4. Vitals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vitals</CardTitle>
          </CardHeader>
          <CardContent>
            <WardVitalsSummary wardUserId={wardUserId} wardName={wardName} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GuardianActivity;
