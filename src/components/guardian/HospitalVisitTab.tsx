import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BriefcaseMedical, Download, Eye, Bell, Share2, FileText, IdCard, ShieldCheck, ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { buildAdmissionKitPdf, type AdmissionKitDoc } from "@/lib/admissionKitPdf";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface Props {
  wardUserId: string;
  wardName: string;
}

const SLOT_DEFS = [
  { key: "aadhaar", label: "Aadhaar Card", icon: IdCard },
  { key: "pan", label: "PAN Card", icon: IdCard },
  { key: "insurance_primary", label: "Health Insurance — Primary", icon: ShieldCheck },
  { key: "insurance_secondary", label: "Health Insurance — Secondary", icon: ShieldCheck },
  { key: "id_photo", label: "Passport Photo", icon: ImageIcon },
] as const;

interface SlotRecord {
  id: string;
  record_slot: string;
  file_url: string | null;
  file_name: string | null;
}

const HospitalVisitTab = ({ wardUserId, wardName }: Props) => {
  const { session } = useAuth();
  const [records, setRecords] = useState<Record<string, SlotRecord>>({});
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewIsPdf, setPreviewIsPdf] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [sharing, setSharing] = useState(false);
  const [nudging, setNudging] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("medical_records")
      .select("id, record_slot, file_url, file_name")
      .eq("user_id", wardUserId)
      .not("record_slot", "is", null);
    const map: Record<string, SlotRecord> = {};
    (data || []).forEach((r: any) => { if (r.record_slot) map[r.record_slot] = r; });
    setRecords(map);
    setLoading(false);
  }, [wardUserId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    if (!wardUserId) return;
    const channel = supabase
      .channel(`hospital-visit-${wardUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medical_records", filter: `user_id=eq.${wardUserId}` },
        () => fetchRecords()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [wardUserId, fetchRecords]);

  const openPreview = async (r: SlotRecord, label: string) => {
    if (!r.file_url) return;
    const { data, error } = await supabase.storage.from("medical-documents").createSignedUrl(r.file_url, 3600);
    if (error || !data) { toast.error("Preview failed"); return; }
    setPreviewUrl(data.signedUrl);
    setPreviewName(r.file_name || label);
    setPreviewIsPdf((r.file_name || "").toLowerCase().endsWith(".pdf"));
  };

  const downloadOne = async (r: SlotRecord) => {
    if (!r.file_url) return;
    const { data } = await supabase.storage.from("medical-documents").download(r.file_url);
    if (!data) { toast.error("Download failed"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = r.file_name || "document";
    a.click();
  };

  const buildKit = async (): Promise<Blob | null> => {
    // Fetch ward profile + health profile + primary guardian
    const [profileRes, healthRes, guardianRes] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, date_of_birth").eq("id", wardUserId).maybeSingle(),
      supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, emergency_notes").eq("user_id", wardUserId).maybeSingle(),
      supabase.from("guardians").select("guardian_name, guardian_phone").eq("user_id", wardUserId).eq("is_primary", true).eq("status", "accepted").maybeSingle(),
    ]);

    const docs: AdmissionKitDoc[] = [];
    for (const def of SLOT_DEFS) {
      const r = records[def.key];
      if (!r?.file_url) {
        docs.push({ slot: def.key, label: def.label, fileName: null, signedUrl: null, isPdf: false, isImage: false });
        continue;
      }
      const { data } = await supabase.storage.from("medical-documents").createSignedUrl(r.file_url, 3600);
      const isPdf = (r.file_name || r.file_url || "").toLowerCase().endsWith(".pdf");
      docs.push({
        slot: def.key,
        label: def.label,
        fileName: r.file_name,
        signedUrl: data?.signedUrl || null,
        isPdf,
        isImage: !isPdf,
      });
    }

    return buildAdmissionKitPdf({
      wardName: profileRes.data?.full_name || wardName,
      wardDob: profileRes.data?.date_of_birth || null,
      wardPhone: profileRes.data?.phone || null,
      bloodGroup: healthRes.data?.blood_group || null,
      allergies: healthRes.data?.allergies || null,
      chronicConditions: healthRes.data?.chronic_conditions || null,
      primaryGuardianName: guardianRes.data?.guardian_name || null,
      primaryGuardianPhone: guardianRes.data?.guardian_phone || null,
      emergencyNotes: healthRes.data?.emergency_notes || null,
      docs,
    });
  };

  const handleDownloadKit = async () => {
    setGenerating(true);
    try {
      const blob = await buildKit();
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Admission-Kit-${wardName.replace(/\s+/g, "_")}.pdf`;
      a.click();
      toast.success("Admission Kit downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to build kit");
    } finally {
      setGenerating(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!sharePhone.trim()) { toast.error("Enter a phone number"); return; }
    if (!session?.user?.id) return;
    setSharing(true);
    try {
      const blob = await buildKit();
      if (!blob) throw new Error("Build failed");
      const path = `${session.user.id}/${wardUserId}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("admission-kits").upload(path, blob, {
        contentType: "application/pdf",
      });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("admission-kits").createSignedUrl(path, 60 * 60 * 24);
      if (signErr || !signed) throw signErr || new Error("sign failed");
      const msg = `Hospital Admission Kit for ${wardName}.\nDocuments included: Aadhaar, PAN, Insurance, Photo (where available).\nSecure link (valid 24h): ${signed.signedUrl}`;
      window.open(buildWhatsAppUrl(sharePhone, msg), "_blank");
      setShareOpen(false);
      setSharePhone("");
      toast.success("WhatsApp opened with secure link");
    } catch (e: any) {
      toast.error(e?.message || "Share failed");
    } finally {
      setSharing(false);
    }
  };

  const handleNudge = async () => {
    setNudging(true);
    try {
      const missing = SLOT_DEFS.filter(s => !records[s.key]).map(s => s.label);
      const msg = `Your guardian needs these for hospital admission: ${missing.join(", ")}. Please upload them in My Profile → ID & Insurance.`;
      const { error } = await supabase.rpc("insert_notification_deduped", {
        p_user_id: wardUserId,
        p_title: "Hospital ID docs needed",
        p_message: msg,
        p_type: "id_doc_missing",
      });
      if (error) throw error;
      toast.success(`${wardName} notified`);
    } catch (e: any) {
      toast.error(e?.message || "Nudge failed");
    } finally {
      setNudging(false);
    }
  };

  const filledCount = Object.keys(records).length;
  const allMissing = filledCount === 0;
  const anyMissing = filledCount < SLOT_DEFS.length;

  if (loading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Loading…</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BriefcaseMedical className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold flex-1">Admission Kit</p>
            <Badge variant={filledCount === SLOT_DEFS.length ? "default" : "outline"} className="text-[10px]">
              {filledCount}/{SLOT_DEFS.length} ready
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={handleDownloadKit} disabled={generating || allMissing}>
              {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
              Download PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} disabled={allMissing}>
              <Share2 className="w-3 h-3 mr-1" /> Share WhatsApp
            </Button>
          </div>
          {anyMissing && (
            <Button size="sm" variant="outline" className="w-full" onClick={handleNudge} disabled={nudging}>
              <Bell className="w-3 h-3 mr-1" /> Nudge {wardName} for missing docs
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Doc cards */}
      {SLOT_DEFS.map((def) => {
        const r = records[def.key];
        const Icon = def.icon;
        return (
          <Card key={def.key}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{def.label}</p>
                  {r?.file_name && (
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {r.file_name}
                    </p>
                  )}
                </div>
                {r ? (
                  <Badge variant="default" className="text-[10px] shrink-0">Available</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-yellow-500 text-yellow-700 dark:text-yellow-400">Missing</Badge>
                )}
              </div>
              {r && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => openPreview(r, def.label)}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => downloadOne(r)}>
                    <Download className="w-3 h-3 mr-1" /> Save
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {previewUrl && (previewIsPdf
            ? <iframe src={previewUrl} className="w-full h-[60vh] rounded" title={previewName} />
            : <img src={previewUrl} alt={previewName} className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Share Admission Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              We'll generate a PDF, upload it securely, and open WhatsApp with a 24-hour link.
            </p>
            <Input
              placeholder="Recipient phone (e.g. 9876543210)"
              value={sharePhone}
              onChange={(e) => setSharePhone(e.target.value)}
              inputMode="tel"
            />
            <Button onClick={handleShareWhatsApp} disabled={sharing} className="w-full">
              {sharing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Share2 className="w-3 h-3 mr-1" />}
              Open WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HospitalVisitTab;
