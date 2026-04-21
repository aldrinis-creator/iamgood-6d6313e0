import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, ShoppingCart, Package, ShieldAlert, Loader2,
  CheckCircle, MessageCircle, FileText, Share2, Pencil, X, Camera, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildLetterheadHtml } from "@/lib/reportPdf";
import type { SelectedAlternative } from "./MedicationManager";
import JanAushadhiAlternatives from "./JanAushadhiAlternatives";
import { normalizeWhatsAppNumber, buildWhatsAppUrl, PREPARING_WHATSAPP_HTML } from "@/lib/whatsapp";

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

export interface OrderItem {
  med: Medication;
  qty: number;
}

const PHARMACY_STORAGE_KEY = "checkin_pharmacy_whatsapp";
const DOCTOR_INFO_KEY = "checkin_order_doctor_info";

interface DoctorInfo {
  doctorName: string;
  hospitalName: string;
}

interface RefillOrderProps {
  onScanAlternative?: (medId: string, medName: string) => void;
  selectedAlternative?: SelectedAlternative | null;
  onClearSelectedAlternative?: () => void;
  orderItems: OrderItem[];
  setOrderItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  onRefillDone?: () => void;
}

const RefillOrder = ({ onScanAlternative, selectedAlternative, onClearSelectedAlternative, orderItems, setOrderItems, onRefillDone }: RefillOrderProps) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [allMeds, setAllMeds] = useState<Medication[]>([]);
  const [bannedMap, setBannedMap] = useState<Record<string, BannedStatus>>({});
  const [checkingBanned, setCheckingBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  // Guardian orders state
  const [guardianOrders, setGuardianOrders] = useState<any[]>([]);
  const [markingOrderReceived, setMarkingOrderReceived] = useState<string | null>(null);

  // Order flow state
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo>(() => {
    try {
      const saved = localStorage.getItem(DOCTOR_INFO_KEY);
      return saved ? JSON.parse(saved) : { doctorName: "", hospitalName: "" };
    } catch { return { doctorName: "", hospitalName: "" }; }
  });
  const [editingDoctor, setEditingDoctor] = useState(false);
  const [pharmacyNumber, setPharmacyNumber] = useState(() =>
    localStorage.getItem(PHARMACY_STORAGE_KEY) || ""
  );
  const [editingPharmacy, setEditingPharmacy] = useState(() => !localStorage.getItem(PHARMACY_STORAGE_KEY));
  const orderRef = useRef<HTMLDivElement>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [markingReceived, setMarkingReceived] = useState(false);

  // Persistent pending orders (DB-backed; survives reloads + syncs across devices)
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
  // Last send info (for the dedicated confirmation card, auto-hides after 6s)
  const [lastSendInfo, setLastSendInfo] = useState<{
    via: "msg91" | "browser";
    pharmacyNumber: string;
    itemCount: number;
  } | null>(null);
  const [sending, setSending] = useState(false);

  // Load all pending-receipt orders for this user (self + guardian-placed) + realtime
  const loadPendingOrders = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("medication_orders" as any)
      .select("*")
      .eq("user_id", session.user.id)
      .eq("status", "pending_receipt")
      .order("created_at", { ascending: false });
    if (!data) return;
    const enriched = await Promise.all((data as any[]).map(async (order: any) => {
      let orderer_name: string | null = null;
      if (order.ordered_by !== session.user.id) {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("id", order.ordered_by).single();
        orderer_name = profile?.full_name || "Guardian";
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
              .filter((it: any) => it.med_id && !String(it.med_id).startsWith("ja-"))
              .map((it: any) => [it.med_id, it.total_quantity ?? it.qty])
          );
        }
      }
      return next;
    });
    setGuardianOrders([]);
  }, [session?.user?.id]);

  useEffect(() => {
    loadPendingOrders();
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`med-orders-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_orders", filter: `user_id=eq.${session.user.id}` },
        () => loadPendingOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPendingOrders, session?.user?.id]);

  const markReceived = async () => {
    setMarkingReceived(true);
    try {
      for (const item of orderItems) {
        if (item.med.id.startsWith("ja-")) continue;
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
      onRefillDone?.();
    } catch {
      toast.error("Failed to update stock");
    }
    setMarkingReceived(false);
  };

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
    onRefillDone?.();
  };

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
    // Show doctor form step first
    setShowDoctorForm(true);
    setTimeout(() => orderRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const proceedAfterDoctor = () => {
    if (!doctorInfo.doctorName.trim()) {
      toast.error("Doctor name is required");
      return;
    }
    if (!doctorInfo.hospitalName.trim()) {
      toast.error("Hospital / Clinic name is required");
      return;
    }
    localStorage.setItem(DOCTOR_INFO_KEY, JSON.stringify(doctorInfo));
    setShowDoctorForm(false);
    setOrderConfirmed(true);
    setEditingDoctor(false);
    setTimeout(() => orderRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const editOrder = () => {
    setOrderConfirmed(false);
    setShowDoctorForm(false);
  };

  const buildOrderText = () => {
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    let text = `🏥 *Medication Order*\n📅 ${date}\n`;
    if (doctorInfo.doctorName) text += `👨‍⚕️ Dr. ${doctorInfo.doctorName}\n`;
    if (doctorInfo.hospitalName) text += `🏨 ${doctorInfo.hospitalName}\n`;
    text += `\n`;
    orderItems.forEach((item, i) => {
      text += `${i + 1}. *${item.med.name}* — ${item.med.dosage}\n   Qty: ${item.qty}\n`;
    });
    text += `\n_Order from Check-iN App_`;
    return text;
  };

  const sendWhatsApp = async () => {
    const num = normalizeWhatsAppNumber(pharmacyNumber);
    if (!num || num.length < 11) {
      toast.error("Enter a valid WhatsApp number with country code");
      return;
    }
    localStorage.setItem(PHARMACY_STORAGE_KEY, pharmacyNumber);

    // CRITICAL: open a blank window SYNCHRONOUSLY (within the click event) so
    // popup blockers don't kill the WhatsApp fallback after the await below.
    const popup = window.open("", "_blank");
    if (popup) {
      try { popup.document.write(PREPARING_WHATSAPP_HTML); popup.document.close(); } catch {}
    }

    const patientName =
      session?.user?.user_metadata?.full_name ||
      session?.user?.email?.split("@")[0] ||
      "Patient";
    const orderDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const itemsText = orderItems
      .map((item, i) => `${i + 1}. ${item.med.name} - ${item.med.dosage} (Qty: ${item.qty})`)
      .join("\n");

    const waUrl = buildWhatsAppUrl(num, buildOrderText());
    const itemsSnapshot = [...orderItems];

    // Persist the order to DB so the pending-receipt card survives reloads / cross-device
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
          user_id: session.user.id,
          ordered_by: session.user.id,
          items,
          status: "pending_receipt",
          pharmacy_phone: pharmacyNumber,
          send_method: via,
          doctor_name: doctorInfo.doctorName || null,
          hospital_name: doctorInfo.hospitalName || null,
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
      setShowDoctorForm(false);
      setTimeout(() => setLastSendInfo(null), 6000);
    };

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-pharmacy-order", {
        body: {
          pharmacy_phone: num,
          patient_name: patientName,
          doctor_name: doctorInfo.doctorName || "—",
          hospital_name: doctorInfo.hospitalName || "—",
          order_date: orderDate,
          items_text: itemsText,
        },
      });
      if (error || !data?.success) {
        console.warn("[send-pharmacy-order] MSG91 failed, falling back to WhatsApp link:", JSON.stringify({ error, data }));
        if (popup) popup.location.href = waUrl;
        else window.open(waUrl, "_blank");
        toast.info("WhatsApp opened — please tap Send");
        finalize("browser");
      } else {
        if (popup) popup.close();
        toast.success("Order sent to pharmacy via MSG91 WhatsApp ✓");
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

  // Mark a specific persisted order as received -> update stock + status
  const markPendingReceived = async (order: PendingOrder) => {
    setMarkingPendingReceived(order.id);
    try {
      const qtys = pendingReceivedQtys[order.id] || {};
      for (const item of order.items) {
        if (!item.med_id || String(item.med_id).startsWith("ja-")) continue;
        const qty = qtys[item.med_id] ?? item.total_quantity ?? item.qty;
        await supabase.from("medications").update({ remaining_quantity: qty }).eq("id", item.med_id);
      }
      await supabase.from("medication_orders" as any)
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", order.id);
      toast.success("Stock updated — order marked received");
      load();
      loadPendingOrders();
      onRefillDone?.();
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
    } catch {
      toast.error("Failed to dismiss");
    }
    setDismissingOrder(null);
  };

  const resendOrder = (order: PendingOrder) => {
    if (!order.pharmacy_phone) { toast.error("No pharmacy number on this order"); return; }
    const text = `🏥 *Medication Order Resend*\n\n` +
      order.items.map((it, i) => `${i + 1}. ${it.name} — ${it.dosage} (Qty: ${it.qty})`).join("\n");
    window.open(buildWhatsAppUrl(order.pharmacy_phone, text), "_blank");
  };

  const saveAsPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups"); return; }
    const doctorRow = doctorInfo.doctorName ? `<p><strong>Doctor:</strong> Dr. ${doctorInfo.doctorName}</p>` : "";
    const hospitalRow = doctorInfo.hospitalName ? `<p><strong>Hospital/Clinic:</strong> ${doctorInfo.hospitalName}</p>` : "";
    const tableHtml = `${doctorRow}${hospitalRow}<table><tr><th>#</th><th>Medication</th><th>Dosage</th><th>Qty</th></tr>${orderItems.map((item, i) => `<tr><td>${i + 1}</td><td>${item.med.name}</td><td>${item.med.dosage}</td><td>${item.qty}</td></tr>`).join("")}</table>`;
    const html = buildLetterheadHtml({
      title: "Medication Order",
      bodyHtml: tableHtml,
    });
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
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

  const markGuardianOrderReceived = async (order: any) => {
    setMarkingOrderReceived(order.id);
    try {
      await supabase
        .from("medication_orders" as any)
        .update({ status: "received" })
        .eq("id", order.id);
      // Update stock for items that have valid med_ids
      const items = order.items as any[];
      for (const item of items) {
        if (item.med_id && !item.med_id.startsWith("ja-")) {
          const med = allMeds.find(m => m.id === item.med_id);
          if (med) {
            await supabase
              .from("medications")
              .update({ remaining_quantity: med.total_quantity })
              .eq("id", med.id);
          }
        }
      }
      setGuardianOrders(prev => prev.filter(o => o.id !== order.id));
      toast.success("Marked as received & stock updated!");
      load();
      onRefillDone?.();
    } catch {
      toast.error("Failed to update");
    }
    setMarkingOrderReceived(null);
  };

  return (
    <div className="space-y-4">
      {/* Send confirmation banner (auto-hides after 6s) */}
      {lastSendInfo && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-success shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-success">Order sent to pharmacy</h4>
                <p className="text-xs text-muted-foreground">
                  via WhatsApp ({lastSendInfo.via === "msg91" ? "MSG91" : "browser link"}) · {lastSendInfo.itemCount} item{lastSendInfo.itemCount === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">To: {lastSendInfo.pharmacyNumber}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setLastSendInfo(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Persistent pending orders (DB-backed; survives reloads + cross-device) */}
      {pendingOrders.map((order) => {
        const filteredItems = order.items.filter((it) => it.med_id && !String(it.med_id).startsWith("ja-"));
        const qtys = pendingReceivedQtys[order.id] || {};
        return (
          <Card key={order.id} className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  {order.orderer_name ? <UserCheck className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-primary" />}
                  {order.orderer_name ? `Guardian Order from ${order.orderer_name}` : "Order sent — pending receipt"}
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
              {filteredItems.map((item) => (
                <div key={item.med_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 truncate">{item.name} <span className="text-muted-foreground">— {item.dosage}</span></span>
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
              <p className="text-[10px] text-muted-foreground">
                Ordered on {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={dismissingOrder === order.id}
                  onClick={() => dismissPendingOrder(order)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={markingPendingReceived === order.id}
                  onClick={() => markPendingReceived(order)}
                >
                  {markingPendingReceived === order.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Medications Received
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
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

      {/* Jan Aushadhi Alternatives */}
      {allMeds.length > 0 && (
        <JanAushadhiAlternatives
          medicationNames={allMeds.map((m) => m.name)}
          onFindKendra={() => navigate("/my-health?tool=Services&facility=janaushadhi")}
          onOrderFromKendra={(medName, genericName, unitSize, mrp) => {
            const med = allMeds.find((m) => m.name === medName);
            const jaMed: Medication = {
              id: `ja-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: `${genericName} (Jan Aushadhi)`,
              dosage: unitSize || med?.dosage || "",
              remaining_quantity: 0,
              total_quantity: 1,
              low_stock_threshold: 0,
            };
            setOrderItems((prev) => [...prev, { med: jaMed, qty: 1 }]);
            toast.success(`Added ${genericName} to order`);
          }}
        />
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
          meds
            .filter((m) => !orderItems.some((o) => o.med.id === m.id))
            .filter((m) => !pendingOrders.some((o) => o.items.some((p) => p.med_id === m.id)))
            .map((med) => (
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
            {allMeds
              .filter((m) => !pendingOrders.some((o) => o.items.some((p) => p.med_id === m.id)))
              .map((med) => {
              const inOrder = orderItems.some((o) => o.med.id === med.id);
              if (inOrder) return null;
              return (
                <div key={med.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
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
            {allMeds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Add medications first.</p>
            )}

            {/* Order Cart Summary */}
            {orderItems.length > 0 && !orderConfirmed && !showDoctorForm && (
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Order ({orderItems.length} items)</p>
                {orderItems.map((item) => (
                  <div key={item.med.id} className="flex items-center justify-between text-sm gap-1">
                    <span className="flex-1 truncate">
                      {item.med.name} — {item.med.dosage}
                      {item.med.id.startsWith("ja-") && (
                        <Badge variant="secondary" className="ml-1 text-[9px] bg-[hsl(142,70%,45%)]/10 text-[hsl(142,70%,45%)]">Jan Aushadhi</Badge>
                      )}
                    </span>
                    {onScanAlternative && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary" onClick={() => onScanAlternative(item.med.id, item.med.name)}>
                        <Camera className="w-3 h-3 mr-1" /> Alt
                      </Button>
                    )}
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

      {/* Doctor / Hospital Form Step */}
      {showDoctorForm && (
        <div ref={orderRef} className="space-y-3">
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                Doctor & Hospital Details
              </h3>
              <p className="text-xs text-muted-foreground">Required before confirming order.</p>
              <div>
                <Label htmlFor="doc-name">Doctor Name *</Label>
                <Input
                  id="doc-name"
                  placeholder="e.g. Dr. Sharma"
                  value={doctorInfo.doctorName}
                  onChange={(e) => setDoctorInfo(prev => ({ ...prev, doctorName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="hosp-name">Hospital / Clinic Name *</Label>
                <Input
                  id="hosp-name"
                  placeholder="e.g. City Hospital"
                  value={doctorInfo.hospitalName}
                  onChange={(e) => setDoctorInfo(prev => ({ ...prev, hospitalName: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDoctorForm(false)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={proceedAfterDoctor}>
                  <CheckCircle className="w-4 h-4 mr-2" /> Proceed
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Order Confirmation */}
      {orderConfirmed && (
        <div ref={orderRef} className="space-y-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-primary mx-auto" />
              <h3 className="text-lg font-bold text-primary">Order Confirmed!</h3>
              <p className="text-sm text-muted-foreground">Choose how to share or save your order.</p>
              {/* Show doctor info */}
              <div className="text-left bg-card rounded-md p-3 text-sm space-y-1 border">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Doctor & Hospital</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditingDoctor(!editingDoctor)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
                {editingDoctor ? (
                  <div className="space-y-2 pt-1">
                    <Input
                      placeholder="Doctor Name"
                      value={doctorInfo.doctorName}
                      onChange={(e) => setDoctorInfo(prev => ({ ...prev, doctorName: e.target.value }))}
                    />
                    <Input
                      placeholder="Hospital / Clinic"
                      value={doctorInfo.hospitalName}
                      onChange={(e) => setDoctorInfo(prev => ({ ...prev, hospitalName: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" className="w-full" onClick={() => {
                      localStorage.setItem(DOCTOR_INFO_KEY, JSON.stringify(doctorInfo));
                      setEditingDoctor(false);
                      toast.success("Doctor info saved");
                    }}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <p>👨‍⚕️ Dr. {doctorInfo.doctorName}</p>
                    <p>🏨 {doctorInfo.hospitalName}</p>
                  </>
                )}
              </div>
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
                disabled={sending}
              >
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                {sending ? "Sending..." : "Send to Pharmacy via WhatsApp"}
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

          {/* Mark as Received */}
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Received Medications — Update Stock
              </h4>
              <p className="text-xs text-muted-foreground">
                Once you receive the medicines, tap the button below to update stock levels. Edit quantities if needed.
              </p>
              {orderItems.filter(item => !item.med.id.startsWith("ja-")).map((item) => (
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
    </div>
  );
};

export default RefillOrder;
