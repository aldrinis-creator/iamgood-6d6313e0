import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ShoppingCart, Camera, Package, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  remaining_quantity: number;
  total_quantity: number;
  low_stock_threshold: number;
}

interface BannedStatus {
  status: "banned" | "restricted" | "warning" | "safe" | "unknown";
  details: string;
}

const RefillOrder = () => {
  const { session } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [allMeds, setAllMeds] = useState<Medication[]>([]);
  const [bannedMap, setBannedMap] = useState<Record<string, BannedStatus>>({});
  const [checkingBanned, setCheckingBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("medications")
      .select("id, name, dosage, remaining_quantity, total_quantity, low_stock_threshold")
      .eq("user_id", session.user.id)
      .order("remaining_quantity", { ascending: true });

    const all = (data as Medication[]) || [];
    setAllMeds(all);
    setMeds(all.filter((m) => m.remaining_quantity <= m.low_stock_threshold));
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  // Check all meds for banned status
  const checkBannedMeds = useCallback(async (meds: Medication[]) => {
    if (meds.length === 0) return;
    setCheckingBanned(true);
    const results: Record<string, BannedStatus> = {};
    for (const med of meds) {
      try {
        const { data } = await supabase.functions.invoke("health-tools", {
          body: { type: "banned_check", payload: med.name },
        });
        if (data?.response) {
          try {
            const parsed = JSON.parse(data.response);
            if (parsed.status === "banned" || parsed.status === "restricted" || parsed.status === "warning") {
              results[med.id] = parsed;
            }
          } catch {}
        }
      } catch {}
    }
    setBannedMap(results);
    setCheckingBanned(false);
  }, []);

  useEffect(() => {
    if (allMeds.length > 0 && Object.keys(bannedMap).length === 0) {
      checkBannedMeds(allMeds);
    }
  }, [allMeds, checkBannedMeds, bannedMap]);

  const handleRefill = async (med: Medication) => {
    await supabase
      .from("medications")
      .update({ remaining_quantity: med.total_quantity })
      .eq("id", med.id);
    toast.success(`${med.name} refilled to ${med.total_quantity}`);
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Banned Warnings */}
      {Object.keys(bannedMap).length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">Banned/Restricted Medication Alert</h3>
            </div>
            {allMeds.filter((m) => bannedMap[m.id]).map((med) => (
              <div key={med.id} className="p-2 rounded bg-card border border-destructive/20 text-xs">
                <p className="font-medium">{med.name} — <span className="text-destructive uppercase">{bannedMap[med.id].status}</span></p>
                <p className="text-muted-foreground">{bannedMap[med.id].details}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {checkingBanned && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking medications against banned list...
        </div>
      )}
      {/* Low Stock Alerts */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Low Stock Alerts
        </h3>
        {meds.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All medications are well-stocked!</p>
            </CardContent>
          </Card>
        ) : (
          meds.map((med) => (
            <Card key={med.id} className="border-destructive/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{med.name}</p>
                  <p className="text-xs text-muted-foreground">{med.dosage}</p>
                  <Badge variant="destructive" className="text-[10px] mt-1">
                    {med.remaining_quantity} left
                  </Badge>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleRefill(med)}>
                    Refill
                  </Button>
                  <Button size="sm">
                    <ShoppingCart className="w-3 h-3 mr-1" /> Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Order Medications */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          Order Medications
        </h3>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Order medications from partner pharmacies with doorstep delivery.
            </p>
            {allMeds.map((med) => (
              <div key={med.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm">{med.name}</p>
                  <p className="text-xs text-muted-foreground">{med.dosage}</p>
                </div>
                <Button size="sm" variant="outline">
                  <ShoppingCart className="w-3 h-3 mr-1" /> Order
                </Button>
              </div>
            ))}
            {allMeds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Add medications first.</p>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default RefillOrder;
