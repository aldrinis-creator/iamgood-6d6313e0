import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BriefcaseMedical, Download, Eye, Bell, Share2, FileText, IdCard, ShieldCheck, ImageIcon, Loader2, ChevronLeft, ChevronRight, Stethoscope } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { buildAdmissionKitPdf, type AdmissionKitDoc, type AdmissionKitPage } from "@/lib/admissionKitPdf";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { resolveSlotPages } from "@/lib/hospitalKitSlots";

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

interface SlotPageRow {
  id: string;
  record_slot: string | null;
  file_url: string | null;
  file_name: string | null;
  page_index: number;
}
interface SlotEntry {
  pages: SlotPageRow[];
  source: "slot" | "vault";
}

const HospitalVisitTab = ({ wardUserId, wardName }: Props) => {
  const { session } = useAuth();
  const [records, setRecords] = useState<Record<string, SlotEntry>>({});
  const [loading, setLoading] = useState(true);
  const [previewPages, setPreviewPages] = useState<{ url: string; name: string; isPdf: boolean }[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewTitle, setPreviewTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [sharing, setSharing] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [doctorReport, setDoctorReport] = useState<{ id: string; title: string; description: string | null; record_date: string | null } | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [nudgingReport, setNudgingReport] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("medical_records")
      .select("id, record_slot, record_type, file_url, file_name, page_index")
      .eq("user_id", wardUserId);
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
        })),
      };
    });
    setRecords(map);
    setLoading(false);
  }, [wardUserId]);

  const fetchDoctorReport = useCallback(async () => {
    const { data } = await supabase
      .from("medical_records")
      .select("id, title, description, record_date")
      .eq("user_id", wardUserId)
      .eq("record_type", "Doctor's Diagnosis")
      .order("record_date", { ascending: false })
      .limit(1);
    setDoctorReport((data && data[0]) ? (data[0] as any) : null);
  }, [wardUserId]);

  useEffect(() => { fetchRecords(); fetchDoctorReport(); }, [fetchRecords, fetchDoctorReport]);

  useEffect(() => {
    if (!wardUserId) return;
    const channel = supabase
      .channel(`hospital-visit-${wardUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medical_records", filter: `user_id=eq.${wardUserId}` },
        () => { fetchRecords(); fetchDoctorReport(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [wardUserId, fetchRecords, fetchDoctorReport]);

  const openPreview = async (entry: SlotEntry, label: string) => {
    const out: { url: string; name: string; isPdf: boolean }[] = [];
    for (const p of entry.pages) {
      if (!p.file_url) continue;
      const { data } = await supabase.storage.from("medical-documents").createSignedUrl(p.file_url, 3600);
      if (data) out.push({
        url: data.signedUrl,
        name: p.file_name || label,
        isPdf: (p.file_name || "").toLowerCase().endsWith(".pdf"),
      });
    }
    if (!out.length) { toast.error("Preview failed"); return; }
    setPreviewPages(out);
    setPreviewIdx(0);
    setPreviewTitle(label);
  };

  const downloadFirst = async (entry: SlotEntry) => {
    const p = entry.pages[0];
    if (!p?.file_url) return;
    const { data } = await supabase.storage.from("medical-documents").download(p.file_url);
    if (!data) { toast.error("Download failed"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = p.file_name || "document";
    a.click();
  };

  const buildKit = async (): Promise<Blob | null> => {
    const [profileRes, healthRes, guardianRes] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, date_of_birth").eq("id", wardUserId).maybeSingle(),
      supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, emergency_notes").eq("user_id", wardUserId).maybeSingle(),
      supabase.from("guardians").select("guardian_name, guardian_phone").eq("user_id", wardUserId).eq("is_primary", true).eq("status", "accepted").maybeSingle(),
    ]);

    const docs: AdmissionKitDoc[] = [];
    for (const def of SLOT_DEFS) {
      const entry = records[def.key];
      const pages: AdmissionKitPage[] = [];
      if (entry) {
        for (const p of entry.pages) {
          if (!p.file_url) continue;
          const { data } = await supabase.storage.from("medical-documents").createSignedUrl(p.file_url, 3600);
          if (!data) continue;
          pages.push({
            signedUrl: data.signedUrl,
            fileName: p.file_name,
            isPdf: (p.file_name || p.file_url || "").toLowerCase().endsWith(".pdf"),
          });
        }
      }
      docs.push({ slot: def.key, label: def.label, pages });
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
      doctorVisitReport: doctorReport?.description
        ? { dateISO: doctorReport.record_date || new Date().toISOString(), markdown: doctorReport.description }
        : null,
    });
  };

  const handleNudgeReport = async () => {
    setNudgingReport(true);
    try {
      const { error } = await supabase.rpc("insert_notification_deduped", {
        p_user_id: wardUserId,
        p_title: "Doctor Visit Report needed",
        p_message: "Your guardian would like an up-to-date Doctor Visit Report for the Hospital Admission Kit. Open Health Tools → Doctor Visit Report and tap Generate, then Save to Vault.",
        p_type: "doctor_report_missing",
      });
      if (error) throw error;
      toast.success(`${wardName} notified`);
    } catch (e: any) {
      toast.error(e?.message || "Nudge failed");
    } finally {
      setNudgingReport(false);
    }
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
      const msg = `Hospital Admission Kit for ${wardName}.\nAll documents are embedded as images inside the PDF.\nSecure link (valid 24h): ${signed.signedUrl}`;
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

      {SLOT_DEFS.map((def) => {
        const entry = records[def.key];
        const Icon = def.icon;
        const pageCount = entry?.pages.length || 0;
        return (
          <Card key={def.key}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{def.label}</p>
                  {entry?.pages[0]?.file_name && (
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {entry.pages[0].file_name}{pageCount > 1 ? ` (+${pageCount - 1} more)` : ""}
                    </p>
                  )}
                  {entry?.source === "vault" && (
                    <p className="text-[10px] text-muted-foreground italic">linked from Medical Vault</p>
                  )}
                </div>
                {entry ? (
                  <Badge variant="default" className="text-[10px] shrink-0">
                    {pageCount} page{pageCount > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-yellow-500 text-yellow-700 dark:text-yellow-400">Missing</Badge>
                )}
              </div>
              {entry && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => openPreview(entry, def.label)}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => downloadFirst(entry)}>
                    <Download className="w-3 h-3 mr-1" /> Save
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={previewPages.length > 0} onOpenChange={(o) => !o && setPreviewPages([])}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base truncate">
              {previewTitle}{previewPages.length > 1 ? ` — Page ${previewIdx + 1}/${previewPages.length}` : ""}
            </DialogTitle>
          </DialogHeader>
          {previewPages[previewIdx] && (previewPages[previewIdx].isPdf
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

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Share Admission Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              We'll generate a single PDF with all images embedded, upload it securely, and open WhatsApp with a 24-hour link.
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
