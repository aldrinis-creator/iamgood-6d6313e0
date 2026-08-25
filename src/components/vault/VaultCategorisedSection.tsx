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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Eye, EyeOff, Loader2, ShieldCheck, Pencil, IdCard, Mail,
  Landmark, ShieldAlert, Scroll, ExternalLink, Paperclip, Camera, CreditCard, Download,
  TrendingUp, Share2,
} from "lucide-react";


import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { encrypt, decrypt, encryptBytes, decryptBytes } from "@/lib/encryption";
import {
  VAULT_CATEGORIES, type VaultCategory,
  type EmailEntry, type BankEntry, type InsuranceEntry, type WillEntry, type IdentityEntry,
  type InvestmentEntry, type SocialEntry,
  type InsuranceCategory, type VaultAttachment, computeInsuranceReminderTier, computeWillReviewFireAt,
  formatReminderLabel,
} from "@/lib/vaultCategories";
import VaultAttachmentField from "./VaultAttachmentField";

type AnyEntry = IdentityEntry | EmailEntry | BankEntry | InvestmentEntry | SocialEntry | InsuranceEntry | WillEntry;


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
  investment: TrendingUp,
  social: Share2,
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
  const [activeCategory, setActiveCategory] = useState<VaultCategory>("identity");
  const [pendingIdentityFiles, setPendingIdentityFiles] = useState<File[]>([]);
  const [pendingCardFile, setPendingCardFile] = useState<File | null>(null);
  const [cardOcrLoading, setCardOcrLoading] = useState(false);


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
      identity: [], email: [], bank: [], investment: [], social: [], insurance: [], will: [],
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
    setPendingFile(null);
    setRemoveAttachment(false);
    setPendingIdentityFiles([]);
    setPendingCardFile(null);
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
    setPendingFile(null);
    setRemoveAttachment(false);
    setPendingIdentityFiles([]);
    setPendingCardFile(null);
    setDialogOpen(true);
  };


  const closeDialog = () => {
    setDialogOpen(false);
    setDraft(null);
    setEditingDoc(null);
    setPendingFile(null);
    setRemoveAttachment(false);
    setPendingIdentityFiles([]);
    setPendingCardFile(null);
    setCardOcrLoading(false);
  };

  // ---------- Card OCR (server-side vision via `scan-card` edge function) ----------
  const runCardOcr = async (file: File) => {
    setCardOcrLoading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("scan-card", {
        body: { imageBase64: `data:${file.type || "image/jpeg"};base64,${base64}` },
      });
      if (error) throw error;
      const parsed = data?.card;
      if (!parsed) {
        toast.info("Could not auto-read card — please fill in manually");
        return;
      }
      setDraft((prev) => ({
        ...(prev as BankEntry),
        card_number: parsed.card_number ?? (prev as BankEntry)?.card_number ?? "",
        card_expiry: parsed.card_expiry ?? (prev as BankEntry)?.card_expiry ?? "",
        card_name: parsed.card_name ?? (prev as BankEntry)?.card_name ?? "",
        card_type: parsed.card_type ?? (prev as BankEntry)?.card_type,
      } as BankEntry));
      toast.success("Card details extracted — please verify before saving");
    } catch {
      toast.error("Card scan failed");
    } finally {
      setCardOcrLoading(false);
    }
  };


  // ---------- Save ----------
  const saveEntry = async () => {
    if (!draft || !userId) return;
    if (!validateDraft(dialogCategory, draft)) return;
    setSaving(true);
    try {
      const finalDraft: AnyEntry = { ...(draft as any) };
      const existingAttachment = (draft as any).attachment as VaultAttachment | undefined;

      const docType = `${dialogCategory}_${(draft as any).label?.toLowerCase().replace(/\s+/g, "_") || Date.now()}`;
      const label = (draft as any).label || dialogCategory;

      // Step 1: ensure row exists so we have a docId for the storage path.
      let docId: string;
      if (editingDoc) {
        docId = editingDoc.id;
      } else {
        const placeholder = await encrypt(JSON.stringify({ ...finalDraft, attachment: undefined }), pin);
        const { data, error } = await supabase
          .from("encrypted_documents")
          .insert({
            user_id: userId, doc_type: docType,
            encrypted_value: placeholder.ciphertext, iv: placeholder.iv, salt: placeholder.salt,
            label, category: dialogCategory,
          })
          .select("id")
          .single();
        if (error) throw error;
        docId = data!.id;
      }

      // Step 2: resolve attachment changes
      if (pendingFile) {
        const bytes = await pendingFile.arrayBuffer();
        const enc = await encryptBytes(bytes, pin);
        const path = `${userId}/${docId}.bin`;
        const blob = new Blob([enc.ciphertext], { type: "text/plain" });
        const { error: upErr } = await supabase.storage
          .from("vault-attachments")
          .upload(path, blob, { upsert: true, contentType: "text/plain" });
        if (upErr) throw upErr;
        (finalDraft as any).attachment = {
          path,
          file_name: pendingFile.name,
          mime_type: pendingFile.type || "application/octet-stream",
          iv: enc.iv,
          salt: enc.salt,
          size: pendingFile.size,
        } as VaultAttachment;
      } else if (removeAttachment && existingAttachment) {
        await supabase.storage.from("vault-attachments").remove([existingAttachment.path]);
        (finalDraft as any).attachment = undefined;
      }

      // Step 2b: identity multi-photo attachments (up to 5, each encrypted)
      if (dialogCategory === "identity") {
        const kept = ((draft as IdentityEntry).attachments ?? []) as VaultAttachment[];
        const removedPaths = (((decryptedById[docId] as IdentityEntry)?.attachments ?? []) as VaultAttachment[])
          .filter((a) => !kept.some((k) => k.path === a.path))
          .map((a) => a.path);
        if (removedPaths.length) {
          await supabase.storage.from("vault-attachments").remove(removedPaths);
        }
        const added: VaultAttachment[] = [];
        for (let i = 0; i < pendingIdentityFiles.length && kept.length + added.length < 5; i++) {
          const f = pendingIdentityFiles[i];
          const enc = await encryptBytes(await f.arrayBuffer(), pin);
          const path = `${userId}/identity_${Date.now()}_${i}.bin`;
          const { error: upErr } = await supabase.storage
            .from("vault-attachments")
            .upload(path, new Blob([enc.ciphertext], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
          if (upErr) throw upErr;
          added.push({
            path, file_name: f.name, mime_type: f.type || "image/jpeg",
            iv: enc.iv, salt: enc.salt, size: f.size,
          });
        }
        (finalDraft as IdentityEntry).attachments = [...kept, ...added].slice(0, 5);
      }

      // Step 2c: bank card photo (encrypted)
      if (dialogCategory === "bank" && pendingCardFile) {
        const enc = await encryptBytes(await pendingCardFile.arrayBuffer(), pin);
        const path = `${userId}/card_${docId}.bin`;
        const { error: upErr } = await supabase.storage
          .from("vault-attachments")
          .upload(path, new Blob([enc.ciphertext], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
        if (upErr) throw upErr;
        (finalDraft as BankEntry).card_attachment = {
          path, file_name: pendingCardFile.name,
          mime_type: pendingCardFile.type || "image/jpeg",
          iv: enc.iv, salt: enc.salt, size: pendingCardFile.size,
        };
      }


      // Step 3: re-encrypt with final draft (including attachment metadata).
      const { ciphertext, iv, salt } = await encrypt(JSON.stringify(finalDraft), pin);
      const { error: updErr } = await supabase
        .from("encrypted_documents")
        .update({
          encrypted_value: ciphertext, iv, salt,
          label, category: dialogCategory,
        })
        .eq("id", docId);
      if (updErr) throw updErr;

      await syncReminders(userId, docId, dialogCategory, finalDraft);

      toast.success(editingDoc ? "Entry updated" : "Entry encrypted & saved");
      closeDialog();
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
    const entry = decryptedById[doc.id] as any;
    const att = entry?.attachment as VaultAttachment | undefined;
    if (att?.path) {
      await supabase.storage.from("vault-attachments").remove([att.path]);
    }
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
      <div className="space-y-3">
        {/* Row-wise scrollable category tabs */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-2 pb-1 min-w-max">
            {VAULT_CATEGORIES.map(({ key, label }) => {
              const Icon = CATEGORY_ICONS[key];
              const count = grouped[key]?.length ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-colors
                    ${activeCategory === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {count > 0 && (
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold
                      ${activeCategory === key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active category content */}
        {VAULT_CATEGORIES.filter((c) => c.key === activeCategory).map(({ key, label, emptyHint }) => {
          const items = grouped[key];
          return (
            <div key={key} className="space-y-2">
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
                              <>
                                <EntryPreview category={(doc.category as VaultCategory) || "identity"} entry={entry} reveal={isOpen} pin={pin} />
                                <AttachmentBadge entry={entry} />
                              </>
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
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 mt-3">
        <ShieldCheck className="w-3 h-3" /> Zero-knowledge AES-256-GCM encryption
      </p>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
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
              pin={pin}
              pendingFile={pendingFile}
              onSelectFile={setPendingFile}
              removeAttachment={removeAttachment}
              onToggleRemoveAttachment={setRemoveAttachment}
              pendingIdentityFiles={pendingIdentityFiles}
              onIdentityFilesChange={setPendingIdentityFiles}
              pendingCardFile={pendingCardFile}
              onCardFileSelect={(f) => { setPendingCardFile(f); runCardOcr(f); }}
              cardOcrLoading={cardOcrLoading}
            />
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
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
    case "identity": return { label: "", value: "", notes: "", attachments: [] };
    case "email":    return { label: "", email: "", password: "", recovery_email: "", notes: "" };
    case "bank":     return { label: "", bank_name: "", account_number: "", ifsc: "", account_type: "savings",
                              nominee_name: "", nominee_relation: "", nominee_phone: "", branch: "", notes: "" };
    case "investment": return { label: "", platform: "", account_id: "", demat_number: "", linked_pan: "",
                               login_id: "", password: "", notes: "" };
    case "social":   return { label: "", platform: "", username_email: "", phone_number: "",
                              password: "", recovery_email: "", notes: "" };
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

function IdentityPhotoChips({ attachments, pin }: { attachments: VaultAttachment[]; pin: string }) {
  const download = async (att: VaultAttachment) => {
    try {
      const { data, error } = await supabase.storage.from("vault-attachments").download(att.path);
      if (error || !data) throw error || new Error("not found");
      const b64 = await data.text();
      const bytes = await decryptBytes(b64, att.iv, att.salt, pin);
      const url = URL.createObjectURL(new Blob([bytes], { type: att.mime_type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = att.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not decrypt photo");
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((att, i) => (
        <button key={i} type="button" onClick={() => download(att)}
          className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted">
          <Camera className="w-3 h-3 text-primary" />
          <span className="max-w-[90px] truncate">{att.file_name}</span>
          <Download className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}

function EntryPreview({ category, entry, reveal, pin }: { category: VaultCategory; entry: AnyEntry; reveal: boolean; pin: string }) {
  if (category === "identity") {
    const e = entry as IdentityEntry;
    const photos = e.attachments ?? [];
    return (
      <div className="text-xs text-muted-foreground mt-0.5">
        <Mask value={e.value} reveal={reveal} />
        {reveal && photos.length > 0 && <IdentityPhotoChips attachments={photos} pin={pin} />}
      </div>
    );
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
    const networkLabel = e.card_network_label
      || (e.card_type ? ({ visa: "VISA", mastercard: "Mastercard", rupay: "RuPay", amex: "Amex", other: "Card" } as Record<string, string>)[e.card_type] : "");
    const last4 = e.card_number ? e.card_number.slice(-4) : "";
    return (
      <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
        <div>{e.bank_name} · {e.account_type}</div>
        <div>A/c: <Mask value={e.account_number} reveal={reveal} /></div>
        <div>IFSC: {e.ifsc}</div>
        {e.nominee_name && <div>Nominee: {e.nominee_name} ({e.nominee_relation})</div>}
        {(networkLabel || last4) && (
          <div className="inline-flex items-center gap-1 mt-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
            <CreditCard className="w-3 h-3 text-primary" />
            {networkLabel}
            {last4 && <span className="font-mono">•••• {last4}</span>}
          </div>
        )}
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

function AttachmentBadge({ entry }: { entry: AnyEntry }) {
  const a = (entry as any).attachment as VaultAttachment | undefined;
  const photos = ((entry as IdentityEntry).attachments ?? []) as VaultAttachment[];
  const cardAtt = (entry as BankEntry).card_attachment;
  if (!a && photos.length === 0 && !cardAtt) return null;
  return (
    <div className="text-[10px] text-primary mt-0.5 flex items-center gap-2">
      {(a || cardAtt) && (
        <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> Attachment</span>
      )}
      {photos.length > 0 && (
        <span className="flex items-center gap-1">
          <Camera className="w-3 h-3" /> {photos.length} photo{photos.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}


// ===================================================================
// Entry form
// ===================================================================

function EntryForm({
  category, draft, onChange, pin,
  pendingFile, onSelectFile, removeAttachment, onToggleRemoveAttachment,
  pendingIdentityFiles, onIdentityFilesChange,
  pendingCardFile, onCardFileSelect, cardOcrLoading,
}: {
  category: VaultCategory;
  draft: AnyEntry;
  onChange: (d: AnyEntry) => void;
  pin: string;
  pendingFile: File | null;
  onSelectFile: (f: File | null) => void;
  removeAttachment: boolean;
  onToggleRemoveAttachment: (r: boolean) => void;
  pendingIdentityFiles: File[];
  onIdentityFilesChange: (files: File[]) => void;
  pendingCardFile: File | null;
  onCardFileSelect: (f: File) => void;
  cardOcrLoading: boolean;
}) {
  const set = (patch: Partial<AnyEntry>) => onChange({ ...draft, ...patch } as AnyEntry);
  const existingAttachment = (draft as any).attachment as VaultAttachment | undefined;
  const identityAttachments = ((draft as IdentityEntry).attachments ?? []) as VaultAttachment[];

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

          <div className="space-y-2">
            <Label>Document Photos (up to 5)</Label>
            <div className="grid grid-cols-3 gap-2">
              {identityAttachments.map((att, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  <span className="text-[10px] text-muted-foreground text-center px-1 truncate">{att.file_name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const atts = [...identityAttachments];
                      atts.splice(idx, 1);
                      set({ attachments: atts } as any);
                    }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]"
                  >×</button>
                </div>
              ))}
              {identityAttachments.length + pendingIdentityFiles.length < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.multiple = true;
                    input.onchange = (e) => {
                      const files = Array.from((e.target as HTMLInputElement).files ?? []);
                      const room = 5 - identityAttachments.length - pendingIdentityFiles.length;
                      onIdentityFilesChange([...pendingIdentityFiles, ...files.slice(0, Math.max(room, 0))]);
                    };
                    input.click();
                  }}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px]">Add photo</span>
                </button>
              )}
            </div>
            {pendingIdentityFiles.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {pendingIdentityFiles.length} photo(s) ready to encrypt &amp; save
              </p>
            )}
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

            {/* Debit / Credit card */}
            <div className="space-y-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Debit / Credit Card (optional)
              </p>

              <Button type="button" variant="outline" className="w-full gap-2" size="sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file"; input.accept = "image/*";
                  (input as any).capture = "environment";
                  input.onchange = (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (file) onCardFileSelect(file);
                  };
                  input.click();
                }}>
                <Camera className="w-4 h-4" /> Scan Card with Camera
              </Button>

              {cardOcrLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading card details...
                </div>
              )}
              {pendingCardFile && !cardOcrLoading && (
                <p className="text-[11px] text-muted-foreground">
                  Card photo ready to encrypt &amp; save ({pendingCardFile.name})
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Card Number</Label>
                  <Input
                    value={e.card_number ?? ""}
                    onChange={(ev) => set({ card_number: ev.target.value.replace(/\D/g, "").slice(0, 16) } as any)}
                    placeholder="1234 5678 9012 3456" maxLength={19}
                    inputMode="numeric" className="font-mono text-base"
                  />
                </div>
                <div>
                  <Label className="text-xs">Expiry (MM/YY)</Label>
                  <Input
                    value={e.card_expiry ?? ""}
                    onChange={(ev) => set({ card_expiry: ev.target.value } as any)}
                    placeholder="MM/YY" maxLength={5} className="text-base"
                  />
                </div>
                <div>
                  <Label className="text-xs">CVV</Label>
                  <Input
                    value={e.card_cvv ?? ""}
                    onChange={(ev) => set({ card_cvv: ev.target.value.replace(/\D/g, "").slice(0, 4) } as any)}
                    placeholder="•••" maxLength={4} type="password" className="text-base"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Name on Card</Label>
                  <Input
                    value={e.card_name ?? ""}
                    onChange={(ev) => set({ card_name: ev.target.value } as any)}
                    placeholder="As printed on card" className="text-base"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Card Network</Label>
                  <Select value={e.card_type ?? ""}
                    onValueChange={(v) => set({ card_type: v as BankEntry["card_type"] } as any)}>
                    <SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visa">VISA</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                      <SelectItem value="rupay">RuPay</SelectItem>
                      <SelectItem value="amex">Amex</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
            <p className="text-[11px] text-muted-foreground -mt-1">Reminders fire 7d / 3d / 24h before renewal &amp; expiry.</p>
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

      {category !== "identity" && (
        <VaultAttachmentField
          existing={existingAttachment}
          pendingFile={pendingFile}
          onSelectFile={onSelectFile}
          removed={removeAttachment}
          onToggleRemove={onToggleRemoveAttachment}
          pin={pin}
        />
      )}

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={(draft as any).notes || ""} onChange={(e) => set({ notes: e.target.value } as any)} />
      </div>
    </div>
  );
}


export default VaultCategorisedSection;
