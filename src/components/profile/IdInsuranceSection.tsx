import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Eye, FileText, BriefcaseMedical, IdCard, ShieldCheck, ImageIcon, Loader2, Link2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import IdMultiPageField, { type CaptureMode } from "./IdMultiPageField";
import { resolveSlotRows } from "@/lib/hospitalKitSlots";

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
  { key: "aadhaar", label: "Aadhaar Card", hint: "Capture front & back — combined into one PDF", icon: IdCard, recordType: "ID - Aadhaar", mode: "front-back", baseFileName: "aadhaar" },
  { key: "pan", label: "PAN Card", hint: "Capture front & back — combined into one PDF", icon: IdCard, recordType: "ID - PAN", mode: "front-back", baseFileName: "pan" },
  { key: "insurance_primary", label: "Health Insurance — Primary", hint: "Add all policy pages — combined into one PDF", icon: ShieldCheck, recordType: "Insurance - Primary", mode: "pages", baseFileName: "insurance-primary", maxPages: 15 },
  { key: "insurance_secondary", label: "Health Insurance — Secondary", hint: "Optional second policy — add all pages", icon: ShieldCheck, recordType: "Insurance - Secondary", mode: "pages", baseFileName: "insurance-secondary", maxPages: 15 },
  { key: "id_photo", label: "Passport Photo", hint: "Recent passport-style photo", icon: ImageIcon, recordType: "ID - Photo", mode: "single", baseFileName: "passport-photo" },
];

interface SlotRecord {
  id: string;
  record_slot: string;
  file_url: string | null;
  file_name: string | null;
  updated_at: string;
}

const IdInsuranceSection = () => {
  const { session } = useAuth();
  const [records, setRecords] = useState<Record<string, SlotRecord>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<SlotKey | null>(null);
  const [captureSlot, setCaptureSlot] = useState<SlotDef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlotDef | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewIsPdf, setPreviewIsPdf] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("medical_records")
      .select("id, record_slot, file_url, file_name, updated_at")
      .eq("user_id", session.user.id)
      .not("record_slot", "is", null);
    const map: Record<string, SlotRecord> = {};
    (data || []).forEach((r: any) => { if (r.record_slot) map[r.record_slot] = r; });
    setRecords(map);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const uploadFile = async (slot: SlotDef, file: File) => {
    if (!session?.user?.id) return;
    setUploadingSlot(slot.key);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${session.user.id}/slots/${slot.key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("medical-documents").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const existing = records[slot.key];
      if (existing) {
        if (existing.file_url) {
          await supabase.storage.from("medical-documents").remove([existing.file_url]);
        }
        await supabase.from("medical_records").update({
          file_url: path,
          file_name: file.name,
          record_type: slot.recordType,
          title: slot.label,
        }).eq("id", existing.id);
      } else {
        await supabase.from("medical_records").insert({
          user_id: session.user.id,
          title: slot.label,
          record_type: slot.recordType,
          record_slot: slot.key,
          file_url: path,
          file_name: file.name,
          record_date: new Date().toISOString().split("T")[0],
        });
      }
      toast.success(`${slot.label} saved`);
      await fetchRecords();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
      throw e;
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDelete = async (slot: SlotDef) => {
    const r = records[slot.key];
    if (!r) return;
    if (r.file_url) await supabase.storage.from("medical-documents").remove([r.file_url]);
    await supabase.from("medical_records").delete().eq("id", r.id);
    toast.success(`${slot.label} removed`);
    fetchRecords();
  };

  const openPreview = async (slot: SlotDef) => {
    const r = records[slot.key];
    if (!r?.file_url) return;
    const { data, error } = await supabase.storage.from("medical-documents").createSignedUrl(r.file_url, 3600);
    if (error || !data) { toast.error("Preview failed"); return; }
    setPreviewUrl(data.signedUrl);
    setPreviewName(r.file_name || slot.label);
    setPreviewIsPdf((r.file_name || "").toLowerCase().endsWith(".pdf"));
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
          Upload these once. Your guardians instantly see them in their app under Reports → Hospital Visit and can share with the hospital in one tap.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : SLOTS.map((slot) => {
          const r = records[slot.key];
          const Icon = slot.icon;
          const isUploading = uploadingSlot === slot.key;
          return (
            <div key={slot.key} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="text-[11px] text-muted-foreground">{slot.hint}</p>
                </div>
                {r ? (
                  <Badge variant="default" className="text-[10px] shrink-0">Saved</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-yellow-500 text-yellow-700 dark:text-yellow-400">Missing</Badge>
                )}
              </div>

              {r ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">{r.file_name}</span>
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
          onComplete={async (file) => {
            await uploadFile(captureSlot, file);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the saved file. You can re-upload it later.
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

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewIsPdf ? (
              <iframe src={previewUrl} className="w-full h-[60vh] rounded" title={previewName} />
            ) : (
              <img src={previewUrl} alt={previewName} className="w-full h-auto rounded" />
            )
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default IdInsuranceSection;
