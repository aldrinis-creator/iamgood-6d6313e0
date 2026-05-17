/**
 * VaultCategorisedSection
 *
 * Renders the unlocked Vault content as a 5-category accordion:
 *   Identity Docs · Email Accounts · Bank Accounts · Insurance · Legal Will
 *
 * Each entry is a JSON blob encrypted with the user's vault PIN
 * (AES-256-GCM, see src/lib/encryption.ts) and stored in
 * `encrypted_documents` keyed by `(user_id, category)`.
 *
 * Insurance and Will entries also write a non-sensitive shadow row to
 * `vault_reminder_meta` so the daily scheduler can fire reminders without
 * needing the vault PIN.
 *
 * The PIN is held in component state ONLY for the duration of an unlock
 * session — never persisted, never sent to the server.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Eye, EyeOff, Loader2, ShieldCheck, Pencil, IdCard, Mail,
  Landmark, ShieldAlert, Scroll, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { encrypt, decrypt, encryptBytes } from "@/lib/encryption";
import {
  VAULT_CATEGORIES, type VaultCategory,
  type EmailEntry, type BankEntry, type InsuranceEntry, type WillEntry, type IdentityEntry,
  type InsuranceCategory, type VaultAttachment, computeInsuranceReminderTier, computeWillReviewFireAt,
  formatReminderLabel,
} from "@/lib/vaultCategories";
import VaultAttachmentField from "./VaultAttachmentField";

type AnyEntry = IdentityEntry | EmailEntry | BankEntry | InsuranceEntry | WillEntry;

interface DocRow {
  id: string;
  doc_type: string;
  category: string | null;
  label: string | null;
  encrypted_value: string;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

interface VaultCategorisedSectionProps {
  userId: string;
  pin: string;
}

const CATEGORY_ICONS: Record<VaultCategory, React.ComponentType<{ className?: string }>> = {
  identity: IdCard,
  email: Mail,
  bank: Landmark,
  insurance: ShieldAlert,
  will: Scroll,
};

const VaultCategorisedSection = ({ userId, pin }: VaultCategorisedSectionProps) => {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [decryptedById, setDecryptedById] = useState<Record<string, AnyEntry>>({});
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<VaultCategory>("identity");
  const [editingDoc, setEditingDoc] = useState<DocRow | null>(null);
  const [draft, setDraft] = useState<AnyEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  // ---------- Load + decrypt ----------
  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("encrypted_documents")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load vault");
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as DocRow[];
    setDocs(rows);
    // decrypt each
    const decrypted: Record<string, AnyEntry> = {};
    for (const r of rows) {
      try {
        const plain = await decrypt(r.encrypted_value, r.iv, r.salt, pin);
        // Try JSON; fall back to legacy plain string for old identity rows.
        try {
          decrypted[r.id] = JSON.parse(plain) as AnyEntry;
        } catch {
          decrypted[r.id] = { label: r.label || r.doc_type, value: plain } as IdentityEntry;
        }
      } catch {
        // skip undecryptable row
      }
    }
    setDecryptedById(decrypted);
    setLoading(false);
  }, [userId, pin]);

  useEffect(() => { reload(); }, [reload]);

  // ---------- Group by category (legacy rows with NULL category fall under "identity") ----------
  const grouped = useMemo(() => {
    const out: Record<VaultCategory, DocRow[]> = {
      identity: [], email: [], bank: [], insurance: [], will: [],
    };
    for (const d of docs) {
      const cat = (d.category as VaultCategory) || "identity";
      if (cat in out) out[cat].push(d);
    }
    return out;
  }, [docs]);

  // ---------- Open Add / Edit dialog ----------
  const openAdd = (category: VaultCategory) => {
    setDialogCategory(category);
    setEditingDoc(null);
    setDraft(blankDraft(category));
    setDialogOpen(true);
  };
  const openEdit = (doc: DocRow) => {
    const entry = decryptedById[doc.id];
    if (!entry) {
      toast.error("Entry could not be decrypted");
      return;
    }
    setDialogCategory((doc.category as VaultCategory) || "identity");
    setEditingDoc(doc);
    setDraft({ ...entry });
    setDialogOpen(true);
  };

  // ---------- Save ----------
  const saveEntry = async () => {
    if (!draft || !userId) return;
    if (!validateDraft(dialogCategory, draft)) return;
    setSaving(true);
    try {
      const { ciphertext, iv, salt } = await encrypt(JSON.stringify(draft), pin);
      const docType = `${dialogCategory}_${(draft as any).label?.toLowerCase().replace(/\s+/g, "_") || Date.now()}`;
      const label = (draft as any).label || dialogCategory;

      let docId: string;
      if (editingDoc) {
        const { error } = await supabase
          .from("encrypted_documents")
          .update({
            encrypted_value: ciphertext, iv, salt,
            label, category: dialogCategory,
          })
          .eq("id", editingDoc.id);
        if (error) throw error;
        docId = editingDoc.id;
      } else {
        const { data, error } = await supabase
          .from("encrypted_documents")
          .insert({
            user_id: userId, doc_type: docType,
            encrypted_value: ciphertext, iv, salt,
            label, category: dialogCategory,
          })
          .select("id")
          .single();
        if (error) throw error;
        docId = data!.id;
      }

      // Sync reminders for insurance & will
      await syncReminders(userId, docId, dialogCategory, draft);

      toast.success(editingDoc ? "Entry updated" : "Entry encrypted & saved");
      setDialogOpen(false);
      setDraft(null);
      setEditingDoc(null);
      await reload();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete ----------
  const removeEntry = async (doc: DocRow) => {
    if (!confirm("Delete this vault entry? This cannot be undone.")) return;
    await supabase.from("vault_reminder_meta" as any).delete().eq("doc_id", doc.id);
    const { error } = await supabase.from("encrypted_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Entry deleted");
    await reload();
  };

  return (
    <>
      <Accordion type="multiple" defaultValue={["identity"]} className="space-y-2">
        {VAULT_CATEGORIES.map(({ key, label, emptyHint }) => {
          const Icon = CATEGORY_ICONS[key];
          const items = grouped[key];
          return (
            <AccordionItem key={key} value={key} className="border rounded-lg px-3 bg-card">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant="secondary" className="ml-1 text-[10px]">{items.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-1">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">{emptyHint}</p>
                ) : (
                  items.map((doc) => {
                    const entry = decryptedById[doc.id];
                    const isOpen = revealed[doc.id];
                    return (
                      <Card key={doc.id} className="bg-muted/40">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.label || (entry as any)?.label || doc.doc_type}
                              </p>
                              {entry && (
                                <EntryPreview category={(doc.category as VaultCategory) || "identity"} entry={entry} reveal={isOpen} />
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => setRevealed((r) => ({ ...r, [doc.id]: !r[doc.id] }))}
                                title={isOpen ? "Hide" : "Reveal"}>
                                {isOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => openEdit(doc)} title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => removeEntry(doc)} title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => openAdd(key)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add {label.replace(/s$/, "")}
                </Button>
                {key === "will" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={async () => {
                      const { data, error } = await supabase.functions.invoke("legal-will-partner", {
                        body: { user_id: userId, action: "create" },
                      });
                      if (error || !data?.url) {
                        toast.info("Will partner integration coming soon");
                        return;
                      }
                      window.open(data.url, "_blank", "noopener,noreferrer");
                    }}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Create / Update Will via Partner
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 mt-3">
        <ShieldCheck className="w-3 h-3" /> Zero-knowledge AES-256-GCM encryption
      </p>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setDraft(null); setEditingDoc(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDoc ? "Edit" : "Add"} {VAULT_CATEGORIES.find((c) => c.key === dialogCategory)?.label.replace(/s$/, "")}
            </DialogTitle>
            <DialogDescription>
              Encrypted with AES-256-GCM before storage. Only your PIN can decrypt.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <EntryForm
              category={dialogCategory}
              draft={draft}
              onChange={setDraft}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving</>
                : <><ShieldCheck className="w-4 h-4 mr-1" /> Encrypt & Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ===================================================================
// Helpers
// ===================================================================

function blankDraft(category: VaultCategory): AnyEntry {
  switch (category) {
    case "identity": return { label: "", value: "", notes: "" };
    case "email":    return { label: "", email: "", password: "", recovery_email: "", notes: "" };
    case "bank":     return { label: "", bank_name: "", account_number: "", ifsc: "", account_type: "savings",
                              nominee_name: "", nominee_relation: "", nominee_phone: "", branch: "", notes: "" };
    case "insurance":return { label: "", category: "health", company: "", policy_number: "", sum_assured: "",
                              nominee_name: "", nominee_relation: "", nominee_phone: "",
                              premium_amount: "", premium_frequency: "yearly",
                              start_date: "", renewal_date: "", expiry_date: "", notes: "" };
    case "will":     return { label: "My Will", status: "none", partner: "self",
                              created_on: "", last_reviewed: "", document_ref: "",
                              nominee_name: "", nominee_phone: "", notes: "" };
  }
}

function validateDraft(category: VaultCategory, draft: AnyEntry): boolean {
  if (!(draft as any).label?.trim()) {
    toast.error("Label is required");
    return false;
  }
  switch (category) {
    case "identity":
      if (!(draft as IdentityEntry).value?.trim()) { toast.error("Value is required"); return false; }
      break;
    case "email": {
      const e = draft as EmailEntry;
      if (!e.email?.trim() || !e.password) { toast.error("Email and password required"); return false; }
      break;
    }
    case "bank": {
      const b = draft as BankEntry;
      if (!b.bank_name?.trim() || !b.account_number?.trim()) { toast.error("Bank & account required"); return false; }
      break;
    }
    case "insurance": {
      const i = draft as InsuranceEntry;
      if (!i.company?.trim() || !i.policy_number?.trim()) { toast.error("Company & policy number required"); return false; }
      break;
    }
  }
  return true;
}

async function syncReminders(userId: string, docId: string, category: VaultCategory, draft: AnyEntry) {
  // Wipe any prior reminders for this doc
  await supabase.from("vault_reminder_meta" as any).delete().eq("doc_id", docId);

  if (category === "insurance") {
    const ins = draft as InsuranceEntry;
    const label = formatReminderLabel(ins.category, ins.company);
    const inserts: any[] = [];
    if (ins.renewal_date) {
      const target = new Date(ins.renewal_date);
      const { tier, fireAt } = computeInsuranceReminderTier(target);
      inserts.push({
        user_id: userId, doc_id: docId,
        kind: "insurance_renewal", display_label: label,
        tier, next_reminder_at: fireAt.toISOString(),
        target_date: ins.renewal_date,
      });
    }
    if (ins.expiry_date) {
      const target = new Date(ins.expiry_date);
      const { tier, fireAt } = computeInsuranceReminderTier(target);
      inserts.push({
        user_id: userId, doc_id: docId,
        kind: "insurance_expiry", display_label: label,
        tier, next_reminder_at: fireAt.toISOString(),
        target_date: ins.expiry_date,
      });
    }
    if (inserts.length) await supabase.from("vault_reminder_meta" as any).insert(inserts);
  }

  if (category === "will") {
    const w = draft as WillEntry;
    const last = w.last_reviewed ? new Date(w.last_reviewed) : new Date();
    const fireAt = computeWillReviewFireAt(last);
    await supabase.from("vault_reminder_meta" as any).insert({
      user_id: userId, doc_id: docId,
      kind: "will_review", display_label: w.label || "My Will",
      tier: "quarterly",
      next_reminder_at: fireAt.toISOString(),
      target_date: last.toISOString().slice(0, 10),
    });
  }
}

// ===================================================================
// Entry preview (compact)
// ===================================================================

const Mask = ({ value, reveal }: { value?: string; reveal: boolean }) => (
  <span className="font-mono">{reveal ? (value || "—") : (value ? "•".repeat(Math.min(value.length, 12)) : "—")}</span>
);

function EntryPreview({ category, entry, reveal }: { category: VaultCategory; entry: AnyEntry; reveal: boolean }) {
  if (category === "identity") {
    const e = entry as IdentityEntry;
    return <p className="text-xs text-muted-foreground mt-0.5"><Mask value={e.value} reveal={reveal} /></p>;
  }
  if (category === "email") {
    const e = entry as EmailEntry;
    return (
      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
        <div>{e.email}</div>
        <div>Pwd: <Mask value={e.password} reveal={reveal} /></div>
      </div>
    );
  }
  if (category === "bank") {
    const e = entry as BankEntry;
    return (
      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
        <div>{e.bank_name} · {e.account_type}</div>
        <div>A/c: <Mask value={e.account_number} reveal={reveal} /></div>
        <div>IFSC: {e.ifsc}</div>
        {e.nominee_name && <div>Nominee: {e.nominee_name} ({e.nominee_relation})</div>}
      </div>
    );
  }
  if (category === "insurance") {
    const e = entry as InsuranceEntry;
    return (
      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
        <div className="capitalize">{e.category} · {e.company}</div>
        <div>Policy: <Mask value={e.policy_number} reveal={reveal} /></div>
        {e.renewal_date && <div>Renewal: {new Date(e.renewal_date).toLocaleDateString("en-IN")}</div>}
        {e.expiry_date && <div>Expiry: {new Date(e.expiry_date).toLocaleDateString("en-IN")}</div>}
        {e.nominee_name && <div>Nominee: {e.nominee_name}</div>}
      </div>
    );
  }
  if (category === "will") {
    const e = entry as WillEntry;
    return (
      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
        <div className="capitalize">Status: {e.status} · via {e.partner}</div>
        {e.last_reviewed && <div>Last reviewed: {new Date(e.last_reviewed).toLocaleDateString("en-IN")}</div>}
        {e.nominee_name && <div>Nominee: {e.nominee_name}</div>}
      </div>
    );
  }
  return null;
}

// ===================================================================
// Entry form
// ===================================================================

function EntryForm({
  category, draft, onChange,
}: { category: VaultCategory; draft: AnyEntry; onChange: (d: AnyEntry) => void }) {
  const set = (patch: Partial<AnyEntry>) => onChange({ ...draft, ...patch } as AnyEntry);

  return (
    <div className="space-y-3 py-2">
      <div>
        <Label>Label *</Label>
        <Input value={(draft as any).label || ""} onChange={(e) => set({ label: e.target.value } as any)}
          placeholder="A short nickname e.g. Personal Gmail" />
      </div>

      {category === "identity" && (
        <>
          <div>
            <Label>Value *</Label>
            <Input value={(draft as IdentityEntry).value} onChange={(e) => set({ value: e.target.value } as any)}
              placeholder="Aadhaar / PAN / Passport number" />
          </div>
        </>
      )}

      {category === "email" && (() => {
        const e = draft as EmailEntry;
        return (
          <>
            <div><Label>Email *</Label><Input type="email" value={e.email} onChange={(ev) => set({ email: ev.target.value } as any)} /></div>
            <div><Label>Password *</Label><Input type="text" value={e.password} onChange={(ev) => set({ password: ev.target.value } as any)} /></div>
            <div><Label>Recovery email</Label><Input value={e.recovery_email || ""} onChange={(ev) => set({ recovery_email: ev.target.value } as any)} /></div>
          </>
        );
      })()}

      {category === "bank" && (() => {
        const e = draft as BankEntry;
        return (
          <>
            <div><Label>Bank name *</Label><Input value={e.bank_name} onChange={(ev) => set({ bank_name: ev.target.value } as any)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Account number *</Label><Input value={e.account_number} onChange={(ev) => set({ account_number: ev.target.value } as any)} /></div>
              <div><Label>IFSC</Label><Input value={e.ifsc} onChange={(ev) => set({ ifsc: ev.target.value } as any)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Account type</Label>
                <Select value={e.account_type} onValueChange={(v) => set({ account_type: v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="fd">Fixed Deposit</SelectItem>
                    <SelectItem value="nps">NPS / Pension</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Branch</Label><Input value={e.branch || ""} onChange={(ev) => set({ branch: ev.target.value } as any)} /></div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Nominee details</p>
              <div className="space-y-2">
                <Input placeholder="Nominee name" value={e.nominee_name} onChange={(ev) => set({ nominee_name: ev.target.value } as any)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Relation" value={e.nominee_relation} onChange={(ev) => set({ nominee_relation: ev.target.value } as any)} />
                  <Input placeholder="Phone" value={e.nominee_phone} onChange={(ev) => set({ nominee_phone: ev.target.value } as any)} />
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {category === "insurance" && (() => {
        const e = draft as InsuranceEntry;
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type *</Label>
                <Select value={e.category} onValueChange={(v) => set({ category: v as InsuranceCategory } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="life">Life</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Company *</Label><Input value={e.company} onChange={(ev) => set({ company: ev.target.value } as any)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Policy number *</Label><Input value={e.policy_number} onChange={(ev) => set({ policy_number: ev.target.value } as any)} /></div>
              <div><Label>Sum assured</Label><Input value={e.sum_assured || ""} onChange={(ev) => set({ sum_assured: ev.target.value } as any)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Premium</Label><Input value={e.premium_amount || ""} onChange={(ev) => set({ premium_amount: ev.target.value } as any)} /></div>
              <div>
                <Label>Frequency</Label>
                <Select value={e.premium_frequency || "yearly"} onValueChange={(v) => set({ premium_frequency: v as any } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="half-yearly">Half-yearly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[11px]">Start</Label><Input type="date" value={e.start_date || ""} onChange={(ev) => set({ start_date: ev.target.value } as any)} /></div>
              <div><Label className="text-[11px]">Renewal</Label><Input type="date" value={e.renewal_date || ""} onChange={(ev) => set({ renewal_date: ev.target.value } as any)} /></div>
              <div><Label className="text-[11px]">Expiry</Label><Input type="date" value={e.expiry_date || ""} onChange={(ev) => set({ expiry_date: ev.target.value } as any)} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Reminders fire 7d / 3d / 24h before renewal & expiry.</p>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Nominee details</p>
              <div className="space-y-2">
                <Input placeholder="Nominee name" value={e.nominee_name} onChange={(ev) => set({ nominee_name: ev.target.value } as any)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Relation" value={e.nominee_relation} onChange={(ev) => set({ nominee_relation: ev.target.value } as any)} />
                  <Input placeholder="Phone" value={e.nominee_phone} onChange={(ev) => set({ nominee_phone: ev.target.value } as any)} />
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {category === "will" && (() => {
        const e = draft as WillEntry;
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Status</Label>
                <Select value={e.status} onValueChange={(v) => set({ status: v as any } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not started</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Created via</Label>
                <Select value={e.partner} onValueChange={(v) => set({ partner: v as any } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="willjini">WillJini</SelectItem>
                    <SelectItem value="ezeewill">EzeeWill</SelectItem>
                    <SelectItem value="lawyer">Lawyer</SelectItem>
                    <SelectItem value="self">Self-drafted</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Created on</Label><Input type="date" value={e.created_on || ""} onChange={(ev) => set({ created_on: ev.target.value } as any)} /></div>
              <div><Label>Last reviewed</Label><Input type="date" value={e.last_reviewed || ""} onChange={(ev) => set({ last_reviewed: ev.target.value } as any)} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">Quarterly review reminders begin 90 days from "Last reviewed".</p>
            <div><Label>Document reference</Label><Input value={e.document_ref || ""} placeholder="Will ID, locker, lawyer's office..." onChange={(ev) => set({ document_ref: ev.target.value } as any)} /></div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold mb-2">Nominee / Executor</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={e.nominee_name || ""} onChange={(ev) => set({ nominee_name: ev.target.value } as any)} />
                <Input placeholder="Phone" value={e.nominee_phone || ""} onChange={(ev) => set({ nominee_phone: ev.target.value } as any)} />
              </div>
            </div>
          </>
        );
      })()}

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={(draft as any).notes || ""} onChange={(e) => set({ notes: e.target.value } as any)} />
      </div>
    </div>
  );
}

export default VaultCategorisedSection;
