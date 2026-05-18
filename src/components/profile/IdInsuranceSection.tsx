import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Eye, FileText, BriefcaseMedical, IdCard, ShieldCheck, ImageIcon, Loader2, Link2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import IdMultiPageField, { type CaptureMode } from "./IdMultiPageField";
import { resolveSlotPages } from "@/lib/hospitalKitSlots";

type SlotKey = "aadhaar" | "pan" | "insurance_primary" | "insurance_secondary" | "id_photo";

interface SlotDef {
  key: SlotKey;
  label: string;
  hint: string;
  icon: any;
  recordType: string;
  mode: CaptureMode;
  baseFileName: string;
  maxPages?: number;
}

const SLOTS: SlotDef[] = [
  { key: "aadhaar", label: "Aadhaar Card", hint: "Front & back — stored as images, combined into PDF on download", icon: IdCard, recordType: "ID - Aadhaar", mode: "front-back", baseFileName: "aadhaar" },
  { key: "pan", label: "PAN Card", hint: "Front & back — stored as images, combined into PDF on download", icon: IdCard, recordType: "ID - PAN", mode: "front-back", baseFileName: "pan" },
  { key: "insurance_primary", label: "Health Insurance — Primary", hint: "Add all policy pages as images", icon: ShieldCheck, recordType: "Insurance - Primary", mode: "pages", baseFileName: "insurance-primary", maxPages: 15 },
  { key: "insurance_secondary", label: "Health Insurance — Secondary", hint: "Optional second policy", icon: ShieldCheck, recordType: "Insurance - Secondary", mode: "pages", baseFileName: "insurance-secondary", maxPages: 15 },
  { key: "id_photo", label: "Passport Photo", hint: "Recent passport-style photo", icon: ImageIcon, recordType: "ID - Photo", mode: "single", baseFileName: "passport-photo" },
];

interface SlotPageRow {
  id: string;
  record_slot: string | null;
  file_url: string | null;
  file_name: string | null;
  page_index: number;
  updated_at: string;
}
interface SlotEntry {
  pages: SlotPageRow[];
  source: "slot" | "vault";
}

const IdInsuranceSection = () => {
  const { session } = useAuth();
  const [records, setRecords] = useState<Record<string, SlotEntry>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<SlotKey | null>(null);
  const [promotingSlot, setPromotingSlot] = useState<SlotKey | null>(null);
  const [captureSlot, setCaptureSlot] = useState<SlotDef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotDef | null>(null);
  const [previewPages, setPreviewPages] = useState<{ url: string; name: string; isPdf: boolean }[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewTitle, setPreviewTitle] = useState("");

  const fetchRecords = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("medical_records")
      .select("id, record_slot, record_type, file_url, file_name, updated_at, page_index")
      .eq("user_id", session.user.id);
    const resolved = resolveSlotPages((data || []) as any);
    const map: Record<string, SlotEntry> = {};
    Object.entries(resolved).forEach(([slot, { rows, source }]) => {
      map[slot] = {
        source,
        pages: rows.map((r: any) => ({
          id: r.id,
          record_slot: r.record_slot,
          file_url: r.file_url,
          file_name: r.file_name,
          page_index: r.page_index ?? 0,
          updated_at: r.updated_at || "",
        })),
      };
    });
    setRecords(map);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const promoteVaultRecord = async (slot: SlotDef) => {
    const entry = records[slot.key];
    if (!entry || entry.source !== "vault") return;
    setPromotingSlot(slot.key);
    try {
      const { error } = await supabase
        .from("medical_records")
        .update({ record_slot: slot.key, page_index: 0 })
        .eq("id", entry.pages[0].id);
      if (error) throw error;
      toast.success(`${slot.label} linked — guardians can now see it`);
      await fetchRecords();
    } catch (e: any) {
      toast.error(e?.message || "Link failed");
    } finally {
      setPromotingSlot(null);
    }
  };

  const uploadPages = async (slot: SlotDef, files: File[]) => {
    if (!session?.user?.id || files.length === 0) return;
    setUploadingSlot(slot.key);
    const userId = session.user.id;
    const uploadedPaths: string[] = [];
    try {
      // 1) Upload all new files first
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/slots/${slot.key}-${i}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("medical-documents")
          .upload(path, f, { contentType: f.type || "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        uploadedPaths.push(path);
      }

      // 2) Delete existing slot-owned rows + their storage files
      const existing = records[slot.key];
      const oldPaths: string[] = [];
      const oldIds: string[] = [];
      if (existing && existing.source === "slot") {
        existing.pages.forEach((p) => {
          if (p.file_url) oldPaths.push(p.file_url);
          oldIds.push(p.id);
        });
      }
      if (oldIds.length) {
        await supabase.from("medical_records").delete().in("id", oldIds);
      }
      if (oldPaths.length) {
        await supabase.storage.from("medical-documents").remove(oldPaths);
      }

      // 3) Insert one row per page
      const rows = files.map((f, i) => ({
        user_id: userId,
        title: files.length > 1 ? `${slot.label} — Page ${i + 1}` : slot.label,
        record_type: slot.recordType,
        record_slot: slot.key,
        page_index: i,
        file_url: uploadedPaths[i],
        file_name: f.name,
        record_date: new Date().toISOString().split("T")[0],
      }));
      const { error: insErr } = await supabase.from("medical_records").insert(rows);
      if (insErr) throw insErr;

      toast.success(`${slot.label} saved — guardians can now see ${files.length} page${files.length > 1 ? "s" : ""}`);
      await fetchRecords();
    } catch (e: any) {
      if (uploadedPaths.length) {
        try { await supabase.storage.from("medical-documents").remove(uploadedPaths); } catch { /* ignore */ }
      }
      toast.error(e?.message || "Save failed — please try again");
      throw e;
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDelete = async (slot: SlotDef) => {
    const entry = records[slot.key];
    if (!entry) return;
    if (entry.source === "vault") {
      toast.success(`${slot.label} unlinked from Hospital Kit`);
      fetchRecords();
      return;
    }
    const paths = entry.pages.map((p) => p.file_url).filter(Boolean) as string[];
    const ids = entry.pages.map((p) => p.id);
    if (paths.length) await supabase.storage.from("medical-documents").remove(paths);
    if (ids.length) await supabase.from("medical_records").delete().in("id", ids);
    toast.success(`${slot.label} removed`);
    fetchRecords();
  };

  const openPreview = async (slot: SlotDef) => {
    const entry = records[slot.key];
    if (!entry?.pages.length) return;
    const out: { url: string; name: string; isPdf: boolean }[] = [];
    for (const p of entry.pages) {
      if (!p.file_url) continue;
      const { data } = await supabase.storage.from("medical-documents").createSignedUrl(p.file_url, 3600);
      if (data) out.push({
        url: data.signedUrl,
        name: p.file_name || slot.label,
        isPdf: (p.file_name || "").toLowerCase().endsWith(".pdf"),
      });
    }
    if (!out.length) { toast.error("Preview failed"); return; }
    setPreviewPages(out);
    setPreviewIdx(0);
    setPreviewTitle(slot.label);
  };

  const filledCount = Object.keys(records).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BriefcaseMedical className="w-4 h-4 text-primary" />
          ID & Insurance — Hospital Kit
          <Badge variant={filledCount === SLOTS.length ? "default" : "outline"} className="ml-auto text-[10px]">
            {filledCount}/{SLOTS.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Upload images once. When your guardian taps "Download PDF" in their Admission Kit, all pages are stitched into a single PDF with images embedded.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : SLOTS.map((slot) => {
          const entry = records[slot.key];
          const Icon = slot.icon;
          const isUploading = uploadingSlot === slot.key;
          const pageCount = entry?.pages.length || 0;
          return (
            <div key={slot.key} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="text-[11px] text-muted-foreground">{slot.hint}</p>
                </div>
                {entry ? (
                  <Badge variant={entry.source === "vault" ? "outline" : "default"} className="text-[10px] shrink-0">
                    {entry.source === "vault" ? "From Vault" : `${pageCount} page${pageCount > 1 ? "s" : ""}`}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-yellow-500 text-yellow-700 dark:text-yellow-400">Missing</Badge>
                )}
              </div>

              {entry ? (
                <>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">
                      {entry.pages[0].file_name}{pageCount > 1 ? ` (+${pageCount - 1} more)` : ""}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openPreview(slot)}>
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCaptureSlot(slot)}>
                      <Upload className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => setDeleteTarget(slot)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {entry.source === "vault" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[11px]"
                      disabled={promotingSlot === slot.key}
                      onClick={() => promoteVaultRecord(slot)}
                    >
                      {promotingSlot === slot.key ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Linking…</>
                      ) : (
                        <><Link2 className="w-3 h-3 mr-1" /> Use this Vault doc for Hospital Kit</>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => setCaptureSlot(slot)}
                >
                  {isUploading ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="w-3 h-3 mr-1" /> Capture / Upload</>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>

      {captureSlot && (
        <IdMultiPageField
          open={!!captureSlot}
          onOpenChange={(o) => { if (!o) setCaptureSlot(null); }}
          mode={captureSlot.mode}
          slotLabel={captureSlot.label}
          baseFileName={captureSlot.baseFileName}
          maxPages={captureSlot.maxPages}
          uploading={uploadingSlot === captureSlot.key}
          onComplete={async (files) => {
            await uploadPages(captureSlot, files);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the saved pages. You can re-upload later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewPages.length > 0} onOpenChange={(o) => !o && setPreviewPages([])}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base truncate">
              {previewTitle}{previewPages.length > 1 ? ` — Page ${previewIdx + 1}/${previewPages.length}` : ""}
            </DialogTitle>
          </DialogHeader>
          {previewPages[previewIdx] && (
            previewPages[previewIdx].isPdf
              ? <iframe src={previewPages[previewIdx].url} className="w-full h-[60vh] rounded" title={previewPages[previewIdx].name} />
              : <img src={previewPages[previewIdx].url} alt={previewPages[previewIdx].name} className="w-full h-auto rounded" />
          )}
          {previewPages.length > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" variant="outline" disabled={previewIdx === 0}
                onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="w-3 h-3 mr-1" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={previewIdx >= previewPages.length - 1}
                onClick={() => setPreviewIdx((i) => Math.min(previewPages.length - 1, i + 1))}>
                Next <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default IdInsuranceSection;
