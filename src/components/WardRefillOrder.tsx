import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { normalizeWhatsAppNumber, buildWhatsAppUrl, PREPARING_WHATSAPP_HTML } from "@/lib/whatsapp";

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
  const { session } = useAuth();
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
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [markingReceived, setMarkingReceived] = useState(false);

  // Persistent pending orders (DB-backed)
  interface PendingOrder {
    id: string;
    items: { med_id: string; name: string; dosage: string; qty: number; total_quantity?: number }[];
    pharmacy_phone: string | null;
    send_method: string | null;
    created_at: string;
    ordered_by: string;
    orderer_name?: string | null;
  }
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [pendingReceivedQtys, setPendingReceivedQtys] = useState<Record<string, Record<string, number>>>({});
  const [markingPendingReceived, setMarkingPendingReceived] = useState<string | null>(null);
  const [dismissingOrder, setDismissingOrder] = useState<string | null>(null);
  const [lastSendInfo, setLastSendInfo] = useState<{
    via: "msg91" | "browser"; pharmacyNumber: string; itemCount: number;
  } | null>(null);
  const [sending, setSending] = useState(false);

  const loadPendingOrders = useCallback(async () => {
    const { data } = await supabase
      .from("medication_orders" as any)
      .select("*")
      .eq("user_id", wardUserId)
      .eq("status", "pending_receipt")
      .order("created_at", { ascending: false });
    if (!data) return;
    const enriched = await Promise.all((data as any[]).map(async (order: any) => {
      let orderer_name: string | null = null;
      if (order.ordered_by !== wardUserId) {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("id", order.ordered_by).single();
        orderer_name = profile?.full_name || null;
      }
      return { ...order, orderer_name };
    }));
    setPendingOrders(enriched as PendingOrder[]);
    setPendingReceivedQtys((prev) => {
      const next = { ...prev };
      for (const o of enriched) {
        if (!next[o.id]) {
          next[o.id] = Object.fromEntries(
            (o.items as any[])
              .filter((it: any) => it.med_id)
              .map((it: any) => [it.med_id, it.total_quantity ?? it.qty])
          );
        }
      }
      return next;
    });
  }, [wardUserId]);

  useEffect(() => {
    loadPendingOrders();
    const channel = supabase
      .channel(`med-orders-ward-${wardUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_orders", filter: `user_id=eq.${wardUserId}` },
        () => loadPendingOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPendingOrders, wardUserId]);

  const markReceived = async () => {
    setMarkingReceived(true);
    try {
      for (const item of orderItems) {
        const qty = receivedQtys[item.med.id] ?? item.med.total_quantity;
        await supabase
          .from("medications")
          .update({ remaining_quantity: qty })
          .eq("id", item.med.id);
      }
      toast.success("Stock updated successfully!");
      setOrderConfirmed(false);
      setOrderItems([]);
      setReceivedQtys({});
      load();
    } catch {
      toast.error("Failed to update stock");
    }
    setMarkingReceived(false);
  };

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

  const confirmOrder = async () => {
    if (orderItems.length === 0) {
      toast.error("Add medications to your order first");
      return;
    }
    // Persist order to medication_orders table
    if (session?.user?.id) {
      try {
        const items = orderItems.map(item => ({
          name: item.med.name,
          dosage: item.med.dosage,
          qty: item.qty,
          med_id: item.med.id,
        }));
        await supabase.from("medication_orders" as any).insert({
          user_id: wardUserId,
          ordered_by: session.user.id,
          items,
          status: "ordered",
        });
      } catch (e) {
        console.error("Failed to persist order", e);
      }
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

  const sendWhatsApp = async () => {
    const num = normalizeWhatsAppNumber(pharmacyNumber);
    if (!num || num.length < 11) {
      toast.error("Enter a valid WhatsApp number with country code");
      return;
    }
    localStorage.setItem(PHARMACY_STORAGE_KEY, pharmacyNumber);

    // Open blank window synchronously so popup blockers don't kill the fallback.
    const popup = window.open("", "_blank");
    if (popup) {
      try { popup.document.write(PREPARING_WHATSAPP_HTML); popup.document.close(); } catch {}
    }

    const orderDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const itemsText = orderItems
      .map((item, i) => `${i + 1}. ${item.med.name} - ${item.med.dosage} (Qty: ${item.qty})`)
      .join("\n");
    const waUrl = buildWhatsAppUrl(num, buildOrderText());
    const itemsSnapshot = [...orderItems];

    const persistOrder = async (via: "msg91" | "browser") => {
      if (!session?.user?.id) return;
      try {
        const items = itemsSnapshot.map((it) => ({
          med_id: it.med.id,
          name: it.med.name,
          dosage: it.med.dosage,
          qty: it.qty,
          total_quantity: it.med.total_quantity,
        }));
        await supabase.from("medication_orders" as any).insert({
          user_id: wardUserId,
          ordered_by: session.user.id,
          items,
          status: "pending_receipt",
          pharmacy_phone: pharmacyNumber,
          send_method: via,
        });
        loadPendingOrders();
      } catch (err) {
        console.error("Failed to persist medication order", err);
      }
    };

    const finalize = (via: "msg91" | "browser") => {
      persistOrder(via);
      setLastSendInfo({ via, pharmacyNumber, itemCount: itemsSnapshot.length });
      setOrderItems([]);
      setOrderConfirmed(false);
      setTimeout(() => setLastSendInfo(null), 6000);
    };

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-pharmacy-order", {
        body: {
          pharmacy_phone: num,
          patient_name: wardName,
          doctor_name: "—",
          hospital_name: "—",
          order_date: orderDate,
          items_text: itemsText,
        },
      });
      console.log("[send-pharmacy-order] ward client verdict:", JSON.stringify({ data, error }));

      if (error || !data?.success) {
        console.warn("[send-pharmacy-order] MSG91 failed, opening fallback:", JSON.stringify({ error, data }));
        if (popup) popup.location.href = waUrl;
        else window.open(waUrl, "_blank");
        toast.warning("MSG91 unavailable — WhatsApp opened, please tap Send");
        finalize("browser");
      } else {
        if (popup) popup.close();
        toast.success("Order sent to pharmacy via WhatsApp ✓");
        finalize("msg91");
      }
    } catch (e) {
      console.warn("[send-pharmacy-order] invoke error, falling back:", JSON.stringify({ message: (e as Error)?.message, e: String(e) }));
      if (popup) popup.location.href = waUrl;
      else window.open(waUrl, "_blank");
      toast.info("WhatsApp opened — please tap Send");
      finalize("browser");
    }
    setSending(false);
  };

  const markPendingReceived = async (order: PendingOrder) => {
    setMarkingPendingReceived(order.id);
    try {
      const qtys = pendingReceivedQtys[order.id] || {};
      for (const item of order.items) {
        if (!item.med_id) continue;
        const qty = qtys[item.med_id] ?? item.total_quantity ?? item.qty;
        await supabase.from("medications").update({ remaining_quantity: qty }).eq("id", item.med_id);
      }
      await supabase.from("medication_orders" as any)
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", order.id);
      toast.success("Stock updated — order marked received");
      load();
      loadPendingOrders();
    } catch {
      toast.error("Failed to update stock");
    }
    setMarkingPendingReceived(null);
  };

  const dismissPendingOrder = async (order: PendingOrder) => {
    setDismissingOrder(order.id);
    try {
      await supabase.from("medication_orders" as any)
        .update({ status: "dismissed" }).eq("id", order.id);
      loadPendingOrders();
    } catch { toast.error("Failed to dismiss"); }
    setDismissingOrder(null);
  };

  const resendOrder = (order: PendingOrder) => {
    if (!order.pharmacy_phone) { toast.error("No pharmacy number on this order"); return; }
    const text = `🏥 *Medication Order Resend for ${wardName}*\n\n` +
      order.items.map((it, i) => `${i + 1}. ${it.name} — ${it.dosage} (Qty: ${it.qty})`).join("\n");
    window.open(buildWhatsAppUrl(order.pharmacy_phone, text), "_blank");
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
  if (meds.length === 0 && pendingOrders.length === 0 && !lastSendInfo) return null;

  return (
    <div className="space-y-3">
      {/* Send confirmation banner */}
      {lastSendInfo && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-success shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-success">Order sent to pharmacy</h4>
                <p className="text-xs text-muted-foreground">
                  via WhatsApp ({lastSendInfo.via === "msg91" ? "MSG91" : "browser link"}) · {lastSendInfo.itemCount} item{lastSendInfo.itemCount === 1 ? "" : "s"} · To: {lastSendInfo.pharmacyNumber}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setLastSendInfo(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Persistent pending orders (DB-backed) */}
      {pendingOrders.map((order) => {
        const qtys = pendingReceivedQtys[order.id] || {};
        return (
          <Card key={order.id} className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  {order.orderer_name ? `Order from ${order.orderer_name}` : "Order sent — pending receipt"}
                </h4>
                {order.pharmacy_phone && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => resendOrder(order)}>
                    <MessageCircle className="w-3 h-3 mr-1" /> Send again
                  </Button>
                )}
              </div>
              {order.pharmacy_phone && (
                <p className="text-xs text-muted-foreground">
                  Sent to {order.pharmacy_phone} via {order.send_method === "msg91" ? "MSG91 WhatsApp" : "WhatsApp link"}.
                </p>
              )}
              {order.items.filter((it) => it.med_id).map((item) => (
                <div key={item.med_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 truncate">{item.name}</span>
                  <Input
                    type="number"
                    min={1}
                    className="w-20 h-8 text-center text-sm"
                    value={qtys[item.med_id] ?? item.total_quantity ?? item.qty}
                    onChange={(e) => setPendingReceivedQtys(prev => ({
                      ...prev,
                      [order.id]: { ...(prev[order.id] || {}), [item.med_id]: parseInt(e.target.value) || 0 }
                    }))}
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" disabled={dismissingOrder === order.id} onClick={() => dismissPendingOrder(order)}>
                  Dismiss
                </Button>
                <Button size="sm" className="flex-1" disabled={markingPendingReceived === order.id} onClick={() => markPendingReceived(order)}>
                  {markingPendingReceived === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Medications Received
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {meds.length > 0 && <>
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
        lowStockMeds
          .filter((m) => !orderItems.some((o) => o.med.id === m.id))
          .filter((m) => !pendingOrders.some((o) => o.items.some((p) => p.med_id === m.id)))
          .map((med) => (
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
          {meds
            .filter((m) => !pendingOrders.some((o) => o.items.some((p) => p.med_id === m.id)))
            .map((med) => {
            const inOrder = orderItems.some((o) => o.med.id === med.id);
            if (inOrder) return null;
            return (
              <div key={med.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm">{med.name}</p>
                  <p className="text-xs text-muted-foreground">{med.dosage}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => addToOrder(med)}>
                  <ShoppingCart className="w-3 h-3 mr-1" /> Order
                </Button>
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
              <Button className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white" onClick={sendWhatsApp} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                {sending ? "Sending..." : "Send to Pharmacy via WhatsApp"}
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

          {/* Mark as Received */}
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Received Medications — Update Stock
              </h4>
              <p className="text-xs text-muted-foreground">
                Once medicines are received, update the stock. Edit quantities if needed.
              </p>
              {orderItems.map((item) => (
                <div key={item.med.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 truncate">{item.med.name}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      className="w-20 h-8 text-center text-sm"
                      value={receivedQtys[item.med.id] ?? item.med.total_quantity}
                      onChange={(e) => setReceivedQtys(prev => ({ ...prev, [item.med.id]: parseInt(e.target.value) || 0 }))}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReceivedQtys(prev => ({ ...prev, [item.med.id]: item.med.total_quantity }))}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                className="w-full"
                disabled={markingReceived}
                onClick={markReceived}
              >
                {markingReceived ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                ✓ Received — Update Stock
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      </>}
    </div>
  );
};

export default WardRefillOrder;
