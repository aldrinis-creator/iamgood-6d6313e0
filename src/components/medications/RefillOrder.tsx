import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, ShoppingCart, Package, ShieldAlert, Loader2,
  CheckCircle, MessageCircle, FileText, Share2, Pencil, X, Camera
} from "lucide-react";
import { toast } from "sonner";
import type { SelectedAlternative } from "./MedicationManager";

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

interface OrderItem {
  med: Medication;
  qty: number;
}

const PHARMACY_STORAGE_KEY = "checkin_pharmacy_whatsapp";

interface RefillOrderProps {
  onScanAlternative?: (medId: string, medName: string) => void;
  selectedAlternative?: SelectedAlternative | null;
  onClearSelectedAlternative?: () => void;
}

const RefillOrder = ({ onScanAlternative, selectedAlternative, onClearSelectedAlternative }: RefillOrderProps) => {
  const { session } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [allMeds, setAllMeds] = useState<Medication[]>([]);
  const [bannedMap, setBannedMap] = useState<Record<string, BannedStatus>>({});
  const [checkingBanned, setCheckingBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  // Order flow state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [pharmacyNumber, setPharmacyNumber] = useState(() =>
    localStorage.getItem(PHARMACY_STORAGE_KEY) || ""
  );
  const [editingPharmacy, setEditingPharmacy] = useState(() => !localStorage.getItem(PHARMACY_STORAGE_KEY));
  const orderRef = useRef<HTMLDivElement>(null);

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

  // Handle selected alternative from Scan tab
  useEffect(() => {
    if (!selectedAlternative) return;
    setOrderItems((prev) => prev.map((item) =>
      item.med.id === selectedAlternative.forMedId
        ? { ...item, med: { ...item.med, name: selectedAlternative.name, dosage: selectedAlternative.dosage } }
        : item
    ));
    toast.success(`Replaced with ${selectedAlternative.name}`);
    onClearSelectedAlternative?.();
  }, [selectedAlternative, onClearSelectedAlternative]);

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

  // Order flow
  const addToOrder = (med: Medication) => {
    setOrderItems((prev) => {
      if (prev.find((o) => o.med.id === med.id)) return prev;
      return [...prev, { med, qty: med.total_quantity }];
    });
    toast.success(`${med.name} added to order`);
  };

  const removeFromOrder = (id: string) => {
    setOrderItems((prev) => prev.filter((o) => o.med.id !== id));
  };

  const confirmOrder = () => {
    if (orderItems.length === 0) {
      toast.error("Add medications to your order first");
      return;
    }
    setOrderConfirmed(true);
    setTimeout(() => orderRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const editOrder = () => {
    setOrderConfirmed(false);
  };

  const buildOrderText = () => {
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    let text = `🏥 *Medication Order*\n📅 ${date}\n\n`;
    orderItems.forEach((item, i) => {
      text += `${i + 1}. *${item.med.name}* — ${item.med.dosage}\n   Qty: ${item.qty}\n`;
    });
    text += `\n_Order from Check-iN App_`;
    return text;
  };

  const sendWhatsApp = () => {
    const num = pharmacyNumber.replace(/\s+/g, "").replace(/^\+/, "");
    if (!num || num.length < 10) {
      toast.error("Enter a valid WhatsApp number with country code");
      return;
    }
    localStorage.setItem(PHARMACY_STORAGE_KEY, pharmacyNumber);
    const text = encodeURIComponent(buildOrderText());
    window.open(`https://wa.me/${num}?text=${text}`, "_blank");
  };

  const saveAsPdf = () => {
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups"); return; }
    printWindow.document.write(`
      <html><head><title>Medication Order — ${date}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:32px;max-width:600px;margin:0 auto}
        h1{font-size:20px;margin-bottom:4px}
        .date{color:#666;margin-bottom:20px;font-size:14px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #ddd;font-size:14px}
        th{background:#f5f5f5;font-weight:600}
        .footer{margin-top:24px;font-size:12px;color:#999;text-align:center}
      </style></head><body>
      <h1>🏥 Medication Order</h1>
      <p class="date">${date}</p>
      <table>
        <tr><th>#</th><th>Medication</th><th>Dosage</th><th>Qty</th></tr>
        ${orderItems.map((item, i) => `<tr><td>${i + 1}</td><td>${item.med.name}</td><td>${item.med.dosage}</td><td>${item.qty}</td></tr>`).join("")}
      </table>
      <p class="footer">Generated by Check-iN App</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const shareOrder = async () => {
    const text = buildOrderText().replace(/\*/g, "");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Medication Order", text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Order copied to clipboard");
    }
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
                  <Button size="sm" onClick={() => addToOrder(med)}>
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
            {allMeds.map((med) => {
              const inOrder = orderItems.some((o) => o.med.id === med.id);
              return (
                <div key={med.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm">{med.name}</p>
                    <p className="text-xs text-muted-foreground">{med.dosage}</p>
                  </div>
                  {inOrder ? (
                    <Button size="sm" variant="outline" onClick={() => removeFromOrder(med.id)}>
                      <X className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => addToOrder(med)}>
                      <ShoppingCart className="w-3 h-3 mr-1" /> Order
                    </Button>
                  )}
                </div>
              );
            })}
            {allMeds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Add medications first.</p>
            )}

            {/* Order Cart Summary */}
            {orderItems.length > 0 && !orderConfirmed && (
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Order ({orderItems.length} items)</p>
                {orderItems.map((item) => (
                  <div key={item.med.id} className="flex items-center justify-between text-sm">
                    <span>{item.med.name} — {item.med.dosage}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => removeFromOrder(item.med.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button className="w-full" onClick={confirmOrder}>
                  <ShoppingCart className="w-4 h-4 mr-2" /> Confirm Order
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Confirmation */}
      {orderConfirmed && (
        <div ref={orderRef} className="space-y-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-primary mx-auto" />
              <h3 className="text-lg font-bold text-primary">Order Confirmed!</h3>
              <p className="text-sm text-muted-foreground">Choose how to share or save your order.</p>
            </CardContent>
          </Card>

          {/* WhatsApp to Pharmacy */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-foreground" />
                  <h4 className="text-sm font-semibold">Pharmacy WhatsApp Number</h4>
                </div>
                {!editingPharmacy && pharmacyNumber && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPharmacy(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {editingPharmacy ? (
                <>
                  <Input
                    placeholder="+91 98765 43210"
                    value={pharmacyNumber}
                    onChange={(e) => setPharmacyNumber(e.target.value)}
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +91 for India).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!pharmacyNumber.trim()}
                    onClick={() => {
                      localStorage.setItem(PHARMACY_STORAGE_KEY, pharmacyNumber);
                      setEditingPharmacy(false);
                      toast.success("Pharmacy number saved");
                    }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Save Number
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                  <span className="text-base font-medium">{pharmacyNumber}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">Saved</Badge>
                </div>
              )}

              <Button
                className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white"
                onClick={sendWhatsApp}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Send to Pharmacy via WhatsApp
              </Button>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Button variant="outline" className="w-full" onClick={editOrder}>
            <Pencil className="w-4 h-4 mr-2" /> Edit Order
          </Button>

          <Button
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary/10"
            onClick={saveAsPdf}
          >
            <FileText className="w-4 h-4 mr-2" /> Save as PDF
          </Button>

          <Button className="w-full" onClick={shareOrder}>
            <Share2 className="w-4 h-4 mr-2" /> Share Order
          </Button>
        </div>
      )}
    </div>
  );
};

export default RefillOrder;
