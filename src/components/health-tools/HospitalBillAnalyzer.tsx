import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Receipt, Upload, X, Loader2, Save, Check, FileText, AlertTriangle, Copy, Layers, HelpCircle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import ReportShareButtons from "@/components/ReportShareButtons";
import { isPDF, isDOCX, isDocument, extractTextFromPDF, renderPDFPageToImage, extractTextFromDOCX } from "@/lib/documentExtractor";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 15000;
const ACCEPT_STRING = "image/*,.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Verdict = "fair" | "slightly_high" | "significantly_high" | "suspicious" | "insufficient_data";

interface BillReport {
  summary: {
    total_billed: number | null;
    currency: string;
    fair_range_min: number | null;
    fair_range_max: number | null;
    verdict: Verdict;
    verdict_reason: string;
  };
  duplicates: { item: string; times_billed: number; suspected_reason: string }[];
  pricing_flags: { item: string; billed_amount: number; typical_range: string; severity: "low" | "medium" | "high" }[];
  bundling_flags: { item: string; note: string }[];
  missing_details: { item: string; missing_fields: string[] }[];
  category_breakdown: { category: string; amount: number; percent: number }[];
  questions_to_ask: string[];
  disclaimer: string;
}

const verdictMeta: Record<Verdict, { label: string; cls: string; icon: typeof Check }> = {
  fair: { label: "Appears Fair", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: Check },
  slightly_high: { label: "Slightly High", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: AlertTriangle },
  significantly_high: { label: "Significantly High", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30", icon: AlertTriangle },
  suspicious: { label: "Needs Review", cls: "bg-red-500/10 text-red-700 border-red-500/30", icon: AlertTriangle },
  insufficient_data: { label: "Insufficient Data", cls: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

const fmtINR = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const MAX_PAGES = 8;
const MAX_DIMENSION = 1600;

async function downscaleImageToBase64(file: File): Promise<{ dataUrl: string; previewUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("blob fail"));
          resolve({ dataUrl, previewUrl: URL.createObjectURL(blob), blob });
        }, "image/jpeg", 0.8);
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface PageItem {
  id: string;
  fileName: string;
  previewUrl: string;
  base64: string;
  blob: Blob;
}

const HospitalBillAnalyzer = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [originalDocFile, setOriginalDocFile] = useState<File | null>(null);
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [hospitalName, setHospitalName] = useState("");
  const [city, setCity] = useState("");
  const [billDate, setBillDate] = useState("");
  const [admissionDays, setAdmissionDays] = useState("");

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<BillReport | null>(null);
  const [rawResponse, setRawResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) { setProgress(0); return; }
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(95, (elapsed / (elapsed + 7000)) * 100));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  const clearAll = () => {
    pages.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setPages([]);
    setOriginalDocFile(null);
    setDocFileName(null);
    setExtractedText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const removePage = (id: string) => {
    setPages(prev => {
      const removed = prev.find(p => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  };

  const handleImagesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";

    if (originalDocFile || extractedText) {
      setOriginalDocFile(null);
      setDocFileName(null);
      setExtractedText(null);
    }

    const remaining = MAX_PAGES - pages.length;
    if (remaining <= 0) { toast.error(`Max ${MAX_PAGES} pages`); return; }
    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) toast.error(`Only ${remaining} more page(s) allowed`);

    setExtracting(true);
    try {
      const newPages: PageItem[] = [];
      for (const f of toProcess) {
        if (!f.type.startsWith("image/")) { toast.error(`${f.name} is not an image`); continue; }
        if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} exceeds 10MB`); continue; }
        const { dataUrl, previewUrl, blob } = await downscaleImageToBase64(f);
        newPages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: f.name, previewUrl, base64: dataUrl, blob,
        });
      }
      setPages(prev => [...prev, ...newPages]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to read images");
    } finally {
      setExtracting(false);
    }
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    e.target.value = "";

    if (selected.size > MAX_FILE_SIZE) { toast.error("File must be under 10MB"); return; }
    if (!isDocument(selected)) { toast.error("Please choose a PDF or Word file"); return; }

    if (pages.length) {
      pages.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setPages([]);
    }
    setOriginalDocFile(selected);
    setDocFileName(selected.name);
    setExtracting(true);
    try {
      if (isPDF(selected)) {
        const { text, hasText } = await extractTextFromPDF(selected);
        if (hasText) setExtractedText(text);
        else {
          const img = await renderPDFPageToImage(selected);
          const blobRes = await (await fetch(img)).blob();
          setPages([{ id: `${Date.now()}-pdf`, fileName: selected.name, previewUrl: img, base64: img, blob: blobRes }]);
          setOriginalDocFile(null);
          setDocFileName(null);
          setExtractedText(null);
        }
      } else {
        const text = await extractTextFromDOCX(selected);
        if (text.trim().length > 10) setExtractedText(text);
        else { toast.error("Could not extract text"); clearAll(); return; }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to read document");
      clearAll();
    } finally {
      setExtracting(false);
    }
  };

  const analyze = async () => {
    if (!pages.length && !extractedText) {
      toast.error("Please upload at least one bill page");
      return;
    }
    setLoading(true);
    setReport(null);
    setRawResponse("");
    try {
      const context = {
        hospital_name: hospitalName.trim() || undefined,
        city: city.trim() || undefined,
        bill_date: billDate || undefined,
        admission_days: admissionDays ? Number(admissionDays) : undefined,
      };
      let payload: any;
      if (extractedText) {
        const ctxLines = [
          context.hospital_name && `Hospital: ${context.hospital_name}`,
          context.city && `City: ${context.city}`,
          context.bill_date && `Bill date: ${context.bill_date}`,
          context.admission_days && `Admission days: ${context.admission_days}`,
        ].filter(Boolean).join("\n");
        const content = extractedText.substring(0, MAX_TEXT_LENGTH);
        payload = `${ctxLines || "(no extra context)"}\n\nBill content:\n${content}`;
      } else {
        payload = { images: pages.map(p => p.base64), context };
      }

      const result = await Promise.race([
        supabase.functions.invoke("health-tools", {
          body: { type: "hospital_bill_analysis", payload },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 120000)),
      ]);
      const { data, error } = result;
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const text: string = data.response || "";
      setRawResponse(text);
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      try {
        const parsed = JSON.parse(cleaned) as BillReport;
        setReport(parsed);
      } catch {
        toast.error("Could not parse the analysis. Please try again.");
      }
    } catch (err: any) {
      toast.error(err?.message === "timeout" ? "Analysis timed out. Try fewer/smaller pages." : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const buildShareableMarkdown = (r: BillReport) => {
    const lines: string[] = [];
    lines.push(`## Bill Analysis Summary`);
    lines.push(`- **Total billed:** ${fmtINR(r.summary.total_billed)}`);
    lines.push(`- **Estimated fair range:** ${fmtINR(r.summary.fair_range_min)} – ${fmtINR(r.summary.fair_range_max)}`);
    lines.push(`- **Verdict:** ${verdictMeta[r.summary.verdict]?.label || r.summary.verdict}`);
    lines.push(`- ${r.summary.verdict_reason}`);
    if (r.duplicates?.length) {
      lines.push(`\n## Possible Duplicate Charges`);
      r.duplicates.forEach(d => lines.push(`- ${d.item} — billed ${d.times_billed}× (${d.suspected_reason})`));
    }
    if (r.pricing_flags?.length) {
      lines.push(`\n## Pricing Flags`);
      r.pricing_flags.forEach(p => lines.push(`- ${p.item} — billed ${fmtINR(p.billed_amount)} vs typical ${p.typical_range} (${p.severity})`));
    }
    if (r.bundling_flags?.length) {
      lines.push(`\n## Bundling Concerns`);
      r.bundling_flags.forEach(b => lines.push(`- ${b.item} — ${b.note}`));
    }
    if (r.missing_details?.length) {
      lines.push(`\n## Missing Details`);
      r.missing_details.forEach(m => lines.push(`- ${m.item} — missing: ${m.missing_fields.join(", ")}`));
    }
    if (r.category_breakdown?.length) {
      lines.push(`\n## Category Breakdown`);
      r.category_breakdown.forEach(c => lines.push(`- ${c.category}: ${fmtINR(c.amount)} (${c.percent}%)`));
    }
    if (r.questions_to_ask?.length) {
      lines.push(`\n## Questions to Ask the Hospital`);
      r.questions_to_ask.forEach(q => lines.push(`- ${q}`));
    }
    lines.push(`\n---\n_${r.disclaimer}_`);
    return lines.join("\n");
  };

  const saveToVault = async () => {
    if (!user || !report) { toast.error("Please log in to save"); return; }
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = docFileName;
      const extraPaths: string[] = [];

      if (originalDocFile) {
        fileName = fileName || originalDocFile.name;
        const storagePath = `${user.id}/${Date.now()}-${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("medical-documents")
          .upload(storagePath, originalDocFile, { contentType: originalDocFile.type });
        if (!upErr) fileUrl = storagePath;
      } else if (pages.length) {
        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          const path = `${user.id}/${Date.now()}-page-${i + 1}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("medical-documents")
            .upload(path, p.blob, { contentType: "image/jpeg" });
          if (!upErr) {
            if (!fileUrl) { fileUrl = path; fileName = `Bill (${pages.length} page${pages.length > 1 ? "s" : ""})`; }
            else extraPaths.push(path);
          }
        }
      }

      const md = buildShareableMarkdown(report);
      const extraNote = extraPaths.length ? `\n\n_Additional pages: ${extraPaths.join(", ")}_` : "";
      const title = `Hospital Bill — ${hospitalName.trim() || new Date().toLocaleDateString("en-IN")}`.substring(0, 80);
      const { error } = await supabase.from("medical_records").insert({
        user_id: user.id,
        title,
        record_type: "Hospital Bill",
        description: (md + extraNote).substring(0, 50000),
        file_name: fileName,
        file_url: fileUrl,
        record_date: billDate || new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Saved to Medical Vault");
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save: ${err?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ----- Loading -----
  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-amber-500" style={{ width: `${progress}%`, transition: "width .3s" }} />
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold">Auditing your bill…</h3>
                <p className="text-xs text-muted-foreground">Checking duplicates, pricing, and missing details.</p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
        <p className="text-xs text-center text-muted-foreground">This usually takes 20–45 seconds.</p>
      </div>
    );
  }

  // ----- Result -----
  if (report) {
    const v = verdictMeta[report.summary.verdict];
    const VIcon = v.icon;
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setReport(null); setRawResponse(""); setSaved(false); }}>← Back</Button>

        {(imagePreview || extractedText) && (
          <Collapsible className="border border-border rounded-xl overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 hover:bg-muted/50">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <FileText className="w-4 h-4 text-primary" /> Original Bill
                {docFileName && <span className="text-xs font-normal text-muted-foreground">— {docFileName}</span>}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-[300px]">
                <div className="p-4">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Bill" className="w-full rounded-lg border object-contain bg-muted" />
                  ) : (
                    <pre className="text-xs whitespace-pre-wrap text-foreground/80">{extractedText}</pre>
                  )}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Summary */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" /> Bill Summary
              </h3>
              <Badge className={`border ${v.cls}`}>
                <VIcon className="w-3 h-3 mr-1" /> {v.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Total billed</p>
                <p className="font-bold text-lg">{fmtINR(report.summary.total_billed)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Estimated fair range</p>
                <p className="font-semibold">{fmtINR(report.summary.fair_range_min)} – {fmtINR(report.summary.fair_range_max)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{report.summary.verdict_reason}</p>
          </CardContent>
        </Card>

        {/* Duplicates */}
        {report.duplicates?.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm"><Copy className="w-4 h-4 text-orange-600" /> Possible Duplicates ({report.duplicates.length})</h4>
              {report.duplicates.map((d, i) => (
                <div key={i} className="p-2 rounded-md bg-orange-500/5 border border-orange-500/20 text-sm">
                  <p className="font-medium">{d.item} <span className="text-xs text-muted-foreground">× {d.times_billed}</span></p>
                  <p className="text-xs text-muted-foreground">{d.suspected_reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pricing flags */}
        {report.pricing_flags?.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4 text-amber-600" /> Pricing Flags ({report.pricing_flags.length})</h4>
              {report.pricing_flags.map((p, i) => (
                <div key={i} className="p-2 rounded-md bg-amber-500/5 border border-amber-500/20 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{p.item}</p>
                    <Badge variant="outline" className="text-[10px]">{p.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Billed {fmtINR(p.billed_amount)} · typical {p.typical_range}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Bundling */}
        {report.bundling_flags?.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm"><Layers className="w-4 h-4 text-blue-600" /> Bundling Concerns ({report.bundling_flags.length})</h4>
              {report.bundling_flags.map((b, i) => (
                <div key={i} className="p-2 rounded-md bg-blue-500/5 border border-blue-500/20 text-sm">
                  <p className="font-medium">{b.item}</p>
                  <p className="text-xs text-muted-foreground">{b.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Missing details */}
        {report.missing_details?.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm"><HelpCircle className="w-4 h-4 text-muted-foreground" /> Missing Details ({report.missing_details.length})</h4>
              {report.missing_details.map((m, i) => (
                <div key={i} className="p-2 rounded-md bg-muted/40 text-sm">
                  <p className="font-medium">{m.item}</p>
                  <p className="text-xs text-muted-foreground">Missing: {m.missing_fields.join(", ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Category breakdown */}
        {report.category_breakdown?.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold text-sm">Category Breakdown</h4>
              {report.category_breakdown.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="font-medium">{fmtINR(c.amount)} <span className="text-xs text-muted-foreground">({c.percent}%)</span></span>
                  </div>
                  <Progress value={c.percent} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        {report.questions_to_ask?.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold text-sm">Questions to Ask the Hospital</h4>
              <ul className="space-y-1.5">
                {report.questions_to_ask.map((q, i) => (
                  <li key={i} className="text-sm flex gap-2"><span className="text-primary font-bold">{i + 1}.</span><span>{q}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <ReportShareButtons
          title="Hospital Bill Analysis"
          subtitle={hospitalName.trim() || "AI-powered bill audit"}
          content={buildShareableMarkdown(report)}
          category="Hospital Bill"
        />

        <Button onClick={saveToVault} disabled={saving || saved} className="w-full" variant={saved ? "outline" : "default"}>
          {saved ? <><Check className="w-4 h-4 mr-2" /> Saved to Medical Vault</>
            : saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4 mr-2" /> Save to Medical Vault</>}
        </Button>

        <p className="text-xs text-muted-foreground text-center px-4">
          {report.disclaimer}
        </p>
      </div>
    );
  }

  // ----- Input -----
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-amber-500" />
        <CardContent className="p-5 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Hospital Bill Analyzer</h3>
          <p className="text-sm text-muted-foreground">
            Upload a hospital, pharmacy, or diagnostic bill. AI checks for duplicate charges, overcharging, missing details, and gives you questions to ask the billing desk.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          {extracting ? (
            <div className="flex flex-col items-center gap-2 p-8 border-2 border-dashed rounded-xl border-primary/30 bg-primary/5">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm font-medium">Reading the bill…</span>
            </div>
          ) : imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Bill preview" className="w-full rounded-lg border max-h-64 object-contain bg-muted" />
              <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={clearFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : docFileName ? (
            <div className="flex items-center gap-3 p-4 border-2 border-dashed rounded-xl border-primary/30 bg-primary/5">
              <FileText className="w-10 h-10 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{docFileName}</p>
                <p className="text-xs text-muted-foreground">{extractedText ? "Text extracted ✓" : "Rendered as image ✓"}</p>
              </div>
              <Button size="icon" variant="destructive" className="h-7 w-7 shrink-0" onClick={clearFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 bg-gradient-to-b from-muted/30 to-transparent border-border/60">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium">Tap to upload bill or take photo</span>
              <span className="text-xs text-muted-foreground">JPG, PNG, PDF, DOCX — max 10MB</span>
              <input ref={fileInputRef} type="file" accept={ACCEPT_STRING} onChange={handleFileSelect} className="hidden" />
            </label>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Input placeholder="Hospital (optional)" value={hospitalName} onChange={(e) => setHospitalName(e.target.value.substring(0, 80))} />
            <Input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value.substring(0, 50))} />
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            <Input type="number" min={0} max={365} placeholder="Admission days" value={admissionDays} onChange={(e) => setAdmissionDays(e.target.value)} />
          </div>

          <Button onClick={analyze} disabled={loading || extracting || (!imageBase64 && !extractedText)} className="w-full">
            <Receipt className="w-4 h-4 mr-2" /> Analyze Bill
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center px-4">
        ⚠️ AI analysis is indicative only. Verify with the hospital billing desk before drawing conclusions.
      </p>
    </div>
  );
};

export default HospitalBillAnalyzer;
