import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ShoppingCart, Camera, Package } from "lucide-react";
import { toast } from "sonner";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  remaining_quantity: number;
  total_quantity: number;
  low_stock_threshold: number;
}

const RefillOrder = () => {
  const { session } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [allMeds, setAllMeds] = useState<Medication[]>([]);
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

      {/* Scan Prescription */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-success" />
          Scan Prescription
        </h3>
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 text-center space-y-3">
            <Camera className="w-12 h-12 text-success mx-auto" />
            <p className="text-sm text-muted-foreground">
              Upload or scan your prescription to compare prices and find savings.
            </p>
            <Input type="file" accept="image/*" className="max-w-xs mx-auto" />
            <Button className="w-full bg-success text-success-foreground hover:bg-success/90">
              Upload Prescription
            </Button>
            <p className="text-xs text-muted-foreground">Coming soon in Phase 2</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RefillOrder;
