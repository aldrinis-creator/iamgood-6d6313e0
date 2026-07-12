import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Wallet, TrendingDown, TrendingUp, Lock, Trash2, Loader2, Mic, Camera, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import ReportShareButtons from "@/components/ReportShareButtons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { canAccessFeature } from "@/lib/featureGating";
import {
  ALL_CATEGORIES, CATEGORY_BAR_HSL, CATEGORY_COLOR, CATEGORY_LABEL,
  COMMON_CURRENCIES, ExpenseCategory, formatMoney,
} from "@/lib/healthcareExpense";

interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  merchant: string | null;
  expense_date: string;
  notes: string | null;
  source: "manual" | "voice" | "bill_scan";
  bill_image_path: string | null;
}

type Period = "week" | "month" | "year";

function todayIso() {
  // IST today
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.toISOString().slice(0, 10);
}

function periodStart(p: Period, anchor = new Date()): Date {
  const ist = new Date(anchor.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (p === "week") {
    const d = new Date(ist); d.setDate(ist.getDate() - 6); d.setHours(0, 0, 0, 0); return d;
  }
  if (p === "year") {
    return new Date(ist.getFullYear(), 0, 1);
  }
  return new Date(ist.getFullYear(), ist.getMonth(), 1);
}

function previousPeriod(p: Period): { from: Date; to: Date } {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (p === "month") {
    const from = new Date(ist.getFullYear(), ist.getMonth() - 1, 1);
    const to = new Date(ist.getFullYear(), ist.getMonth(), 0);
    return { from, to };
  }
  if (p === "year") {
    return { from: new Date(ist.getFullYear() - 1, 0, 1), to: new Date(ist.getFullYear() - 1, 11, 31) };
  }
  const to = new Date(ist); to.setDate(ist.getDate() - 7); to.setHours(23, 59, 59, 999);
  const from = new Date(to); from.setDate(to.getDate() - 6); from.setHours(0, 0, 0, 0);
  return { from, to };
}

const PRIVACY_NOTE = "Your healthcare financial logs are private. They are stored encrypted at rest in your account and only you can see them. Share with your Guardian only when you export a PDF below.";

const FinancialHealth = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { plan, loading: planLoading } = useSubscription();

  useEffect(() => {
    if (planLoading) return;
    if (!canAccessFeature(plan, "Financial Healthcare")) {
      toast.info("Financial Healthcare is a Premium Plus feature");
      navigate("/subscription", { replace: true });
    }
  }, [plan, planLoading, navigate]);


  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("healthcare_expenses")
      .select("id, amount, currency, category, merchant, expense_date, notes, source, bill_image_path")
      .eq("user_id", userId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Could not load expenses");
    } else {
      setRows((data || []) as ExpenseRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  // Filter rows for current and previous period
  const { current, previous, byCategory, upcomingPremiums } = useMemo(() => {
    const start = periodStart(period);
    const prev = previousPeriod(period);

    const current = rows.filter((r) => new Date(r.expense_date) >= start);
    const previous = rows.filter((r) => {
      const d = new Date(r.expense_date);
      return d >= prev.from && d <= prev.to;
    });

    const byCat: Record<ExpenseCategory, number> = {
      medication: 0, doctor_fees: 0, insurance: 0, diagnostics: 0, equipment_caregiving: 0, other: 0,
    };
    for (const r of current) byCat[r.category] += Number(r.amount);

    // upcoming premiums: insurance rows in the next 60 days
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(today.getDate() + 60);
    const upcomingPremiums = rows.filter((r) => {
      if (r.category !== "insurance") return false;
      const d = new Date(r.expense_date);
      return d > today && d <= horizon;
    }).slice(0, 5);

    return { current, previous, byCategory: byCat, upcomingPremiums };
  }, [rows, period]);

  const currentTotal = current.reduce((s, r) => s + Number(r.amount), 0);
  const previousTotal = previous.reduce((s, r) => s + Number(r.amount), 0);
  const delta = currentTotal - previousTotal;
  const deltaPct = previousTotal > 0 ? Math.round((delta / previousTotal) * 100) : null;
  const periodLabel = period === "week" ? "This Week" : period === "year" ? "This Year" : "This Month";
  const prevLabel = period === "week" ? "Last Week" : period === "year" ? "Last Year" : "Last Month";

  const maxCat = Math.max(1, ...Object.values(byCategory));

  // PDF content
  const reportContent = useMemo(() => {
    const lines: string[] = [];
    lines.push(`# Healthcare Spend — ${periodLabel}`);
    lines.push("");
    lines.push(`**Total: ${formatMoney(currentTotal)}**`);
    lines.push(`${prevLabel}: ${formatMoney(previousTotal)}  (Δ ${formatMoney(delta)})`);
    lines.push("");
    lines.push(`## By Category`);
    for (const c of ALL_CATEGORIES) {
      if (byCategory[c] > 0) lines.push(`- ${CATEGORY_LABEL[c]}: ${formatMoney(byCategory[c])}`);
    }
    lines.push("");
    lines.push(`## Entries (${current.length})`);
    for (const r of current) {
      lines.push(`- ${r.expense_date} | ${CATEGORY_LABEL[r.category]} | ${formatMoney(Number(r.amount), r.currency)} | ${r.merchant || "—"}${r.notes ? ` — ${r.notes}` : ""}`);
    }
    return lines.join("\n");
  }, [current, periodLabel, currentTotal, previousTotal, prevLabel, delta, byCategory]);

  const handleSaved = () => {
    setSheetOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("healthcare_expenses").delete().eq("id", id);
    if (error) toast.error("Could not delete");
    else { toast.success("Entry deleted"); load(); }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-health")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Financial Healthcare
          </Button>
          <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditing(null); }}>
            <SheetTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Add</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editing ? "Edit expense" : "Add healthcare expense"}</SheetTitle>
              </SheetHeader>
              <AddExpenseTabs onSaved={handleSaved} editing={editing} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground border rounded-lg p-3 bg-muted/40">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{PRIVACY_NOTE}</p>
        </div>

        {/* Period toggle */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Hero card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-success/5">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
            <p className="text-4xl font-bold text-primary mt-1">{formatMoney(currentTotal)}</p>
            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className="text-muted-foreground">{prevLabel}: {formatMoney(previousTotal)}</span>
              {previousTotal > 0 && (
                <Badge variant="outline" className={`gap-1 ${delta <= 0 ? "border-success/40 text-success" : "border-amber-500/40 text-amber-600 dark:text-amber-400"}`}>
                  {delta <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {deltaPct !== null ? `${Math.abs(deltaPct)}%` : formatMoney(Math.abs(delta))}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By category bars */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-base font-semibold">By Category</p>
            {currentTotal === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses logged for {periodLabel.toLowerCase()} yet.</p>
            ) : (
              ALL_CATEGORIES.filter((c) => byCategory[c] > 0).map((c) => {
                const pct = Math.round((byCategory[c] / maxCat) * 100);
                return (
                  <div key={c} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{CATEGORY_LABEL[c]}</span>
                      <span>{formatMoney(byCategory[c])}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: CATEGORY_BAR_HSL[c] }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Upcoming premiums */}
        {upcomingPremiums.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 space-y-2">
              <p className="text-base font-semibold text-amber-700 dark:text-amber-400">Upcoming Premiums</p>
              {upcomingPremiums.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.merchant || "Insurance"} — {r.expense_date}</span>
                  <span className="font-medium">{formatMoney(Number(r.amount), r.currency)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent entries */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">Recent Entries</p>
              <span className="text-xs text-muted-foreground">{current.length} this {period}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tap <b>Add</b> above to log your first expense.</p>
            ) : (
              <ul className="divide-y">
                {rows.slice(0, 10).map((r) => (
                  <li key={r.id} className="py-2 flex items-center gap-3">
                    <Badge variant="secondary" className={`shrink-0 ${CATEGORY_COLOR[r.category]}`}>
                      {CATEGORY_LABEL[r.category]}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.merchant || CATEGORY_LABEL[r.category]}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.expense_date}{r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">{formatMoney(Number(r.amount), r.currency)}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(r); setSheetOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(r.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Ways to save */}
        <Card className="border-success/30">
          <CardContent className="p-4 space-y-2">
            <p className="text-base font-semibold text-success">Ways to save</p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Ask your doctor for Jan Aushadhi generic equivalents — often 50–80% cheaper.</li>
              <li>Annual insurance premiums are usually 5–10% cheaper than monthly.</li>
              <li>Free annual health checkups under most policies — book them; they catch issues early.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Share with guardian */}
        {rows.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-base font-semibold">Share with Guardian</p>
              <p className="text-xs text-muted-foreground">Export the {period} report as a PDF or share via WhatsApp / Email.</p>
              <ReportShareButtons
                title={`Healthcare Spend — ${periodLabel}`}
                subtitle={`Total ${formatMoney(currentTotal)}`}
                content={reportContent}
                category="Financial Healthcare"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

/* ---------- Add / Edit sheet ---------- */

interface AddProps {
  onSaved: () => void;
  editing: ExpenseRow | null;
}

const AddExpenseTabs = ({ onSaved, editing }: AddProps) => {
  const [tab, setTab] = useState<"manual" | "voice" | "scan">("manual");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-4">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="manual">Manual</TabsTrigger>
        <TabsTrigger value="voice"><Mic className="w-4 h-4 mr-1" /> Voice</TabsTrigger>
        <TabsTrigger value="scan"><Camera className="w-4 h-4 mr-1" /> Scan Bill</TabsTrigger>
      </TabsList>
      <TabsContent value="manual" className="pt-3">
        <ManualForm onSaved={onSaved} editing={editing} source="manual" />
      </TabsContent>
      <TabsContent value="voice" className="pt-3">
        <VoicePane onTranscribed={(text) => { /* handled inside ManualForm via key */ }} />
        <ManualForm onSaved={onSaved} editing={editing} source="voice" voiceMode />
      </TabsContent>
      <TabsContent value="scan" className="pt-3">
        <ScanPane onExtracted={() => onSaved()} onSaved={onSaved} />
      </TabsContent>
    </Tabs>
  );
};

interface FormProps extends AddProps {
  source: "manual" | "voice" | "bill_scan";
  prefilled?: Partial<ExpenseRow>;
  voiceMode?: boolean;
}

const ManualForm = ({ onSaved, editing, source, prefilled, voiceMode }: FormProps) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [amount, setAmount] = useState<string>(editing ? String(editing.amount) : prefilled?.amount ? String(prefilled.amount) : "");
  const [currency, setCurrency] = useState<string>(editing?.currency || prefilled?.currency || "INR");
  const [category, setCategory] = useState<ExpenseCategory>(editing?.category || (prefilled?.category as ExpenseCategory) || "medication");
  const [merchant, setMerchant] = useState<string>(editing?.merchant || prefilled?.merchant || "");
  const [date, setDate] = useState<string>(editing?.expense_date || prefilled?.expense_date || todayIso());
  const [notes, setNotes] = useState<string>(editing?.notes || prefilled?.notes || "");
  const [saving, setSaving] = useState(false);

  // Voice transcription support: a sibling pane writes into window event
  useEffect(() => {
    if (!voiceMode) return;
    const handler = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      if (t) setNotes((prev) => (prev ? prev + " " : "") + t);
    };
    window.addEventListener("fh-voice-text", handler as EventListener);
    return () => window.removeEventListener("fh-voice-text", handler as EventListener);
  }, [voiceMode]);

  const save = async () => {
    if (!userId) return;
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt < 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const payload = {
      user_id: userId,
      created_by: userId,
      amount: amt,
      currency,
      category,
      merchant: merchant.trim() || null,
      expense_date: date,
      notes: notes.trim() || null,
      source,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("healthcare_expenses").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("healthcare_expenses").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save");
      return;
    }
    toast.success(editing ? "Expense updated" : "Expense added");
    onSaved();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label>Amount</Label>
          <Input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMMON_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Merchant / Provider</Label>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Apollo Pharmacy" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes {voiceMode && <span className="text-xs text-muted-foreground">(use the mic above)</span>}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details, e.g. 'BP tablets — 30 days'" rows={3} />
      </div>
      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {editing ? "Save changes" : "Save expense"}
      </Button>
    </div>
  );
};

/* ---------- Voice pane: record, transcribe, pipe text into the form ---------- */

const VoicePane = ({ onTranscribed }: { onTranscribed: (t: string) => void }) => {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;
        setBusy(true);
        try {
          const buf = await blob.arrayBuffer();
          // base64 in chunks to avoid stack overflow
          const bytes = new Uint8Array(buf);
          let bin = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
          }
          const b64 = btoa(bin);
          const { data, error } = await supabase.functions.invoke("transcribe-voice", {
            body: { audio: b64, format: "webm" },
          });
          if (error) throw error;
          const text = (data as { text?: string })?.text?.trim();
          if (text) {
            window.dispatchEvent(new CustomEvent("fh-voice-text", { detail: text }));
            onTranscribed(text);
            toast.success("Transcribed");
          } else {
            toast.error("Could not transcribe");
          }
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex items-center gap-2 p-3 mb-2 rounded-lg border bg-muted/40">
      <Button
        type="button"
        variant={recording ? "destructive" : "outline"}
        size="sm"
        onClick={recording ? stop : start}
        disabled={busy}
        className="gap-1"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        {recording ? "Stop & Transcribe" : busy ? "Transcribing…" : "Record voice note"}
      </Button>
      <p className="text-xs text-muted-foreground flex-1">Speak the expense details. Transcription will be added to the Notes field below.</p>
    </div>
  );
};

/* ---------- Scan pane: upload image, call extract-bill, prefill form ---------- */

const ScanPane = ({ onSaved }: { onSaved: () => void; onExtracted: () => void }) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [prefill, setPrefill] = useState<Partial<ExpenseRow> | null>(null);
  const [billPath, setBillPath] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!userId) return;
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("healthcare-bills").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      setBillPath(path);
      const { data, error } = await supabase.functions.invoke("extract-bill", { body: { imagePath: path } });
      if (error) throw error;
      const ex = (data as { extracted?: Record<string, unknown> })?.extracted || {};
      const cat = String(ex.category || "other").toLowerCase();
      const valid = ALL_CATEGORIES.includes(cat as ExpenseCategory) ? (cat as ExpenseCategory) : "other";
      // Sanity-check AI-extracted date: reject if >90 days in the future or >60 days in the past.
      // AI often mis-reads the year on bills (e.g. 2024 vs 2026), which silently drops entries
      // outside the current period so the Financial Healthcare totals never update.
      let expenseDate = todayIso();
      if (typeof ex.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ex.date)) {
        const parsed = new Date(ex.date + "T00:00:00");
        const today = new Date(todayIso() + "T00:00:00");
        const diffDays = (parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= -60 && diffDays <= 90) expenseDate = ex.date;
      }
      setPrefill({
        amount: Number(ex.amount) || 0,
        currency: typeof ex.currency === "string" && ex.currency ? ex.currency : "INR",
        category: valid,
        merchant: typeof ex.merchant === "string" ? ex.merchant : "",
        expense_date: expenseDate,
      });
      toast.success("Bill scanned — review and save");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  // ManualForm save uses prefill via key; we'll embed it with a custom save that includes bill_image_path
  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={busy} className="w-full gap-1">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {busy ? "Scanning…" : prefill ? "Replace bill" : "Take photo or choose bill"}
      </Button>
      {prefill && (
        <ScanReviewForm
          prefill={prefill}
          billPath={billPath}
          onSaved={onSaved}
        />
      )}
    </div>
  );
};

const ScanReviewForm = ({ prefill, billPath, onSaved }: { prefill: Partial<ExpenseRow>; billPath: string | null; onSaved: () => void }) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [amount, setAmount] = useState<string>(prefill.amount ? String(prefill.amount) : "");
  const [currency, setCurrency] = useState<string>(prefill.currency || "INR");
  const [category, setCategory] = useState<ExpenseCategory>((prefill.category as ExpenseCategory) || "other");
  const [merchant, setMerchant] = useState<string>(prefill.merchant || "");
  const [date, setDate] = useState<string>(prefill.expense_date || todayIso());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!userId) return;
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt < 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("healthcare_expenses").insert({
      user_id: userId,
      created_by: userId,
      amount: amt,
      currency,
      category,
      merchant: merchant.trim() || null,
      expense_date: date,
      notes: notes.trim() || null,
      source: "bill_scan",
      bill_image_path: billPath,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Could not save"); return; }
    toast.success("Bill saved");
    onSaved();
  };

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <p className="text-xs text-muted-foreground">Review the extracted values, fix anything wrong, then save.</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label>Amount</Label>
          <Input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{COMMON_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Merchant</Label>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Save expense
      </Button>
    </div>
  );
};

export default FinancialHealth;
export { Wallet };
