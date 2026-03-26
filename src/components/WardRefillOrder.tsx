import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, ShoppingCart, Package, Loader2,
  CheckCircle, MessageCircle, FileText, Share2, Pencil, X
} from "lucide-react";
import { toast } from "sonner";
import { buildLetterheadHtml } from "@/lib/reportPdf";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  remaining_quantity: number;
  total_quantity: number;
  low_stock_threshold: number;
}

interface OrderItem {
  med: Medication;
  qty: number;
}

const PHARMACY_STORAGE_KEY = "checkin_pharmacy_whatsapp";

interface WardRefillOrderProps {
  wardUserId: string;
  wardName: string;
}

const WardRefillOrder = ({ wardUserId, wardName }: WardRefillOrderProps) => {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [lowStockMeds, setLowStockMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [pharmacyNumber, setPharmacyNumber] = useState(() =>
    localStorage.getItem(PHARMACY_STORAGE_KEY) || ""
  );
  const [editingPharmacy, setEditingPharmacy] = useState(() => !localStorage.getItem(PHARMACY_STORAGE_KEY));
  const orderRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("medications")
      .select("id, name, dosage, remaining_quantity, total_quantity, low_stock_threshold")
      .eq("user_id", wardUserId)
      .order("remaining_quantity", { ascending: true });

    const all = (data as Medication[]) || [];
    setMeds(all);
    setLowStockMeds(all.filter((m) => m.remaining_quantity <= m.low_stock_threshold));
    setLoading(false);
  }, [wardUserId]);

  useEffect(() => { load(); }, [load]);

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

  const editOrder = () => setOrderConfirmed(false);

  const buildOrderText = () => {
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    let text = `🏥 *Medication Order for ${wardName}*\n📅 ${date}\n\n`;
    orderItems.forEach((item, i) => {
      text += `${i + 1}. *${item.med.name}* — ${item.med.dosage}\n   Qty: ${item.qty}\n`;
    });
    text += `\n_Order from Check-iN App (by Guardian)_`;
    return text;
  };

  const sendWhatsApp = () => {
    const num = pharmacyNumber.replace(/\s+/g, "").replace(/^\+/, "");
    if (!num || num.length < 10) {
      toast.error("Enter a valid WhatsApp number with country code");
      return;
    }
    localStorage.setItem(PHARMACY_STORAGE_KEY, pharmacyNumber);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(buildOrderText())}`, "_blank");
  };

  const saveAsPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups"); return; }
    const tableHtml = `<table><tr><th>#</th><th>Medication</th><th>Dosage</th><th>Qty</th></tr>${orderItems.map((item, i) => `<tr><td>${i + 1}</td><td>${item.med.name}</td><td>${item.med.dosage}</td><td>${item.qty}</td></tr>`).join("")}</table>`;
    const html = buildLetterheadHtml({
      title: "Medication Order",
      subtitle: `Ward: ${wardName}`,
      bodyHtml: tableHtml,
    });
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  const shareOrder = async () => {
    const text = buildOrderText().replace(/\*/g, "");
    if (navigator.share) {
      try { await navigator.share({ title: `Medication Order for ${wardName}`, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Order copied to clipboard");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>;
  if (meds.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Low Stock Alerts */}
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        Low Stock Alerts
      </h4>
      {lowStockMeds.length === 0 ? (
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="w-6 h-6 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">All medications well-stocked!</p>
          </CardContent>
        </Card>
      ) : (
        lowStockMeds.map((med) => (
          <Card key={med.id} className="border-destructive/30">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{med.name}</p>
                <p className="text-xs text-muted-foreground">{med.dosage}</p>
                <Badge variant="destructive" className="text-[10px] mt-1">{med.remaining_quantity} left</Badge>
              </div>
              <Button size="sm" onClick={() => addToOrder(med)}>
                <ShoppingCart className="w-3 h-3 mr-1" /> Order
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      {/* Order All Medications */}
      <h4 className="text-sm font-semibold flex items-center gap-2 pt-2">
        <ShoppingCart className="w-4 h-4 text-primary" />
        Order Medications
      </h4>
      <Card>
        <CardContent className="p-3 space-y-2">
          {meds.map((med) => {
            const inOrder = orderItems.some((o) => o.med.id === med.id);
            return (
              <div key={med.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
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

          {/* Cart */}
          {orderItems.length > 0 && !orderConfirmed && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Order ({orderItems.length} items)</p>
              {orderItems.map((item) => (
                <div key={item.med.id} className="flex items-center justify-between text-sm">
                  <span className="flex-1 truncate">{item.med.name} — {item.med.dosage}</span>
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

      {/* Confirmation */}
      {orderConfirmed && (
        <div ref={orderRef} className="space-y-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-primary mx-auto" />
              <h3 className="text-base font-bold text-primary">Order Confirmed!</h3>
              <p className="text-xs text-muted-foreground">Choose how to share or save the order.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-foreground" />
                  <h4 className="text-sm font-semibold">Pharmacy WhatsApp</h4>
                </div>
                {!editingPharmacy && pharmacyNumber && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPharmacy(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              {editingPharmacy ? (
                <>
                  <Input placeholder="+91 98765 43210" value={pharmacyNumber} onChange={(e) => setPharmacyNumber(e.target.value)} className="text-base" />
                  <p className="text-xs text-muted-foreground">Include country code (e.g., +91).</p>
                  <Button variant="outline" size="sm" className="w-full" disabled={!pharmacyNumber.trim()} onClick={() => { localStorage.setItem(PHARMACY_STORAGE_KEY, pharmacyNumber); setEditingPharmacy(false); toast.success("Pharmacy number saved"); }}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Save Number
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                  <span className="text-base font-medium">{pharmacyNumber}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">Saved</Badge>
                </div>
              )}
              <Button className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white" onClick={sendWhatsApp}>
                <MessageCircle className="w-4 h-4 mr-2" /> Send to Pharmacy via WhatsApp
              </Button>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full" onClick={editOrder}>
            <Pencil className="w-4 h-4 mr-2" /> Edit Order
          </Button>
          <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" onClick={saveAsPdf}>
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

export default WardRefillOrder;
