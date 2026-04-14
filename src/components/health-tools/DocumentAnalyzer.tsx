import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, FileImage, FlaskConical, FileText, Stethoscope, Loader2, Upload, Camera, X, Type, Save, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ReportShareButtons from "@/components/ReportShareButtons";
import VisualHealthReport, { tryParseVisualReport } from "@/components/health-tools/VisualHealthReport";
import { isPDF, isDOCX, isDocument, extractTextFromPDF, renderPDFPageToImage, extractTextFromDOCX, getFileTypeLabel } from "@/lib/documentExtractor";

const MAX_TEXT_LENGTH = 10000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for documents

const categories = [
  { label: "Medical Images", icon: FileImage, bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600", activeBg: "bg-blue-500/20" },
  { label: "Lab Reports", icon: FlaskConical, bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600", activeBg: "bg-emerald-500/20" },
  { label: "Doctor's Diagnosis", icon: FileText, bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600", activeBg: "bg-amber-500/20" },
  { label: "Doctor's Notes", icon: Stethoscope, bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-600", activeBg: "bg-teal-500/20" },
];

type InputMode = "photo" | "text";

const isTextFile = (file: File) => {
  const textTypes = ["text/plain", "text/csv", "text/html", "text/xml", "application/json"];
  const textExtensions = [".txt", ".csv", ".md", ".json", ".xml", ".html"];
  if (textTypes.includes(file.type)) return true;
  return textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
};

const analysisSteps = [
  { label: "Uploading document…", duration: 1500 },
  { label: "Reading content…", duration: 3000 },
  { label: "Identifying key findings…", duration: 5000 },
  { label: "Generating plain-language summary…", duration: 8000 },
  { label: "Finalizing analysis…", duration: 12000 },
];

const ACCEPT_STRING = "image/*,.pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DocumentAnalyzer = () => {
  const { user } = useAuth();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [mode, setMode] = useState<InputMode>("photo");
  const [customTitle, setCustomTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [extractedDocText, setExtractedDocText] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) { setProgress(0); setStepIndex(0); return; }
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(95, (elapsed / (elapsed + 6000)) * 100);
      setProgress(pct);
      const idx = analysisSteps.findIndex((s) => elapsed < s.duration);
      setStepIndex(idx === -1 ? analysisSteps.length - 1 : idx);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  useEffect(() => {
    if (result && loading) setProgress(100);
  }, [result, loading]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      toast.error("File must be under 10MB");
      e.target.value = "";
      return;
    }

    // Handle PDF/DOCX documents
    if (isDocument(selected)) {
      setExtracting(true);
      setDocFileName(selected.name);
      setImagePreview(null);
      setImageBase64(null);
      try {
        if (isPDF(selected)) {
          const { text, hasText } = await extractTextFromPDF(selected);
          if (hasText) {
            setExtractedDocText(text);
          } else {
            // Scanned PDF — render first page as image
            const img = await renderPDFPageToImage(selected);
            setImageBase64(img);
            setExtractedDocText(null);
          }
        } else if (isDOCX(selected)) {
          const text = await extractTextFromDOCX(selected);
          if (text.trim().length > 10) {
            setExtractedDocText(text);
          } else {
            toast.error("Could not extract text from this document");
            clearFile();
            return;
          }
        }
      } catch (err) {
        console.error("Document extraction error:", err);
        toast.error("Failed to read document. Try a different file.");
        clearFile();
        return;
      } finally {
        setExtracting(false);
      }
      return;
    }

    // Handle images
    if (!selected.type.startsWith("image/")) {
      toast.error("Please select an image, PDF, or Word file");
      e.target.value = "";
      return;
    }

    setDocFileName(null);
    setExtractedDocText(null);
    setImagePreview(URL.createObjectURL(selected));
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const clearFile = () => {
    setImagePreview(null);
    setImageBase64(null);
    setDocFileName(null);
    setExtractedDocText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected && !isTextFile(selected)) {
      toast.error("Only text files (.txt, .csv, .md) are supported.");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const analyze = async () => {
    if (mode === "photo" && !imageBase64 && !extractedDocText) {
      toast.error("Please upload a document or photo");
      return;
    }
    if (mode === "text" && !textInput && !file) {
      toast.error("Please provide text or upload a text file");
      return;
    }
    setLoading(true);
    try {
      let payload: any;
      if (mode === "photo") {
        if (extractedDocText) {
          // Send extracted text from PDF/DOCX
          const content = extractedDocText.substring(0, MAX_TEXT_LENGTH);
          payload = `Category: ${selectedCat || "General"}\n\nDocument content:\n${content}`;
        } else if (imageBase64) {
          payload = { image: imageBase64, category: selectedCat || "General" };
        }
      } else {
        let content = textInput;
        if (file && !textInput) {
          const raw = await file.text();
          content = raw.substring(0, MAX_TEXT_LENGTH);
          if (raw.length > MAX_TEXT_LENGTH) {
            toast.info(`File content truncated to ${MAX_TEXT_LENGTH.toLocaleString()} characters.`);
          }
        }
        content = content.substring(0, MAX_TEXT_LENGTH);
        payload = `Category: ${selectedCat || "General"}\n\nDocument content:\n${content}`;
      }
      const result = await Promise.race([
        supabase.functions.invoke("health-tools", {
          body: { type: "document_analysis", payload },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 60000)
        ),
      ]);
      const { data, error } = result;
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setResult(data.response);
    } catch (err: any) {
      const msg = err?.message === "timeout"
        ? "Analysis timed out. Try a smaller file or paste the text manually."
        : "Analysis failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    const activeCat = categories.find(c => c.label === selectedCat);
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500`} style={{ width: `${progress}%`, transition: "width 0.3s" }} />
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Analyzing Document…</h3>
                {activeCat && <Badge variant="outline" className={`${activeCat.text} ${activeCat.border} text-[10px] mt-1`}>{activeCat.label}</Badge>}
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground animate-pulse">
              {analysisSteps[stepIndex]?.label}
            </p>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          This may take 10–30 seconds depending on document complexity.
        </p>
      </div>
    );
  }

  const saveToVault = async () => {
    if (!user) { toast.error("Please log in to save"); return; }
    setSaving(true);
    try {
      const recordType = selectedCat === "Doctor's Diagnosis" ? "Doctor's Diagnosis" : "AI Analysis";
      const { error } = await supabase.from("medical_records").insert({
        user_id: user.id,
        title: `${selectedCat || "Document"} Analysis — ${new Date().toLocaleDateString("en-IN")}`,
        record_type: recordType,
        description: result.substring(0, 50000),
        record_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Your Report is saved in the Vault in Reports in the Document Analyzer tab");
    } catch (err: any) {
      console.error("Vault save error:", err);
      toast.error(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  // Results view
  if (result) {
    const activeCat = categories.find(c => c.label === selectedCat);
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setResult(""); setTextInput(""); setFile(null); clearFile(); setSaved(false); }}>← Back</Button>

        {/* Original Document Reference */}
        {(imagePreview || imageBase64 || extractedDocText || (mode === "text" && textInput)) && (
          <Collapsible defaultOpen className="border border-border rounded-xl overflow-hidden">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <FileText className="w-4 h-4 text-primary" />
                Original Document
                {docFileName && <span className="text-xs font-normal text-muted-foreground">— {docFileName}</span>}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-[300px]">
                <div className="p-4">
                  {(imagePreview || (imageBase64 && !extractedDocText)) ? (
                    <img
                      src={imagePreview || imageBase64 || ""}
                      alt="Original document"
                      className="w-full rounded-lg border border-border object-contain bg-muted"
                    />
                  ) : extractedDocText ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 leading-relaxed">
                      {extractedDocText}
                    </pre>
                  ) : textInput ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 leading-relaxed">
                      {textInput}
                    </pre>
                  ) : null}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Card className="overflow-hidden">
          <div className={`h-1 ${activeCat ? `bg-gradient-to-r ${activeCat.label === "Medical Images" ? "from-blue-500 to-blue-300" : activeCat.label === "Lab Reports" ? "from-emerald-500 to-emerald-300" : activeCat.label === "Doctor's Diagnosis" ? "from-amber-500 to-amber-300" : "from-teal-500 to-teal-300"}`  : "bg-primary"}`} />
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" /> Analysis Results
              </h3>
              {activeCat && (
                <Badge className={`${activeCat.activeBg} ${activeCat.text} border ${activeCat.border} text-[10px]`}>
                  <activeCat.icon className="w-3 h-3 mr-1" /> {activeCat.label}
                </Badge>
              )}
            </div>

            {(() => {
              const visual = tryParseVisualReport(result);
              if (visual) return <VisualHealthReport report={visual} />;
              return (
                <div className="prose prose-sm max-w-none dark:prose-invert bg-muted/30 rounded-lg p-4 border border-border/50">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              );
            })()}

            <ReportShareButtons
              title={`${selectedCat || "Document"} Analysis`}
              subtitle="AI-Powered Medical Document Analysis"
              content={result}
              category={selectedCat || "General"}
            />
          </CardContent>
        </Card>

        <Button
          onClick={saveToVault}
          disabled={saving || saved}
          className="w-full"
          variant={saved ? "outline" : "default"}
        >
          {saved ? (
            <><Check className="w-4 h-4 mr-2" /> Saved to Medical Vault</>
          ) : saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save to Medical Vault</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          ⚠️ AI analysis is for informational purposes only. Consult a doctor for medical decisions.
        </p>
      </div>
    );
  }

  // Input view
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500" />
        <CardContent className="p-5 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Document Analyzer</h3>
          <p className="text-sm text-muted-foreground">Upload a photo, PDF, Word document, or paste text from a medical document for AI-powered plain-language analysis.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => {
          const isActive = selectedCat === cat.label;
          return (
            <button
              key={cat.label}
              onClick={() => setSelectedCat(cat.label)}
              className={`p-3 rounded-xl border-2 flex items-center gap-2.5 text-left transition-all ${
                isActive
                  ? `${cat.activeBg} ${cat.border} shadow-sm`
                  : `border-border/50 hover:${cat.border} ${cat.bg}`
              }`}
            >
              <div className={`w-9 h-9 rounded-lg ${isActive ? cat.activeBg : cat.bg} flex items-center justify-center shrink-0`}>
                <cat.icon className={`w-4.5 h-4.5 ${cat.text}`} />
              </div>
              <span className={`text-xs font-semibold ${isActive ? cat.text : "text-foreground"}`}>{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === "photo" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("photo")}
        >
          <Upload className="w-4 h-4 mr-2" /> Upload File
        </Button>
        <Button
          variant={mode === "text" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("text")}
        >
          <Type className="w-4 h-4 mr-2" /> Manual Text
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {mode === "photo" ? (
            <>
              {extracting ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl border-primary/30 bg-primary/5">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-sm font-medium">Extracting text from document…</span>
                </div>
              ) : imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Document preview" className="w-full rounded-lg border border-border max-h-64 object-contain bg-muted" />
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={clearFile}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : docFileName ? (
                <div className="flex items-center gap-3 p-4 border-2 border-dashed rounded-xl border-primary/30 bg-primary/5">
                  <FileText className="w-10 h-10 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{docFileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {extractedDocText ? "Text extracted successfully ✓" : "Rendered as image for analysis ✓"}
                    </p>
                  </div>
                  <Button size="icon" variant="destructive" className="h-7 w-7 shrink-0" onClick={clearFile}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-all bg-gradient-to-b from-muted/30 to-transparent border-border/60">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Tap to upload file or take photo</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, PDF, DOCX — max 10MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_STRING}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Upload a text file (.txt, .csv, .md)</label>
                <input
                  type="file"
                  accept=".txt,.csv,.md,.json,.xml,.html,text/plain,text/csv"
                  onChange={handleTextFileChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium mt-1"
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">— or paste text content below —</p>
              <div className="relative">
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Paste your lab report, diagnosis, or medical notes here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value.substring(0, MAX_TEXT_LENGTH))}
                  maxLength={MAX_TEXT_LENGTH}
                />
                <p className="text-[10px] text-muted-foreground text-right">{textInput.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}</p>
              </div>
            </>
          )}
          <Button onClick={analyze} disabled={loading || extracting} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Upload className="w-4 h-4 mr-2" /> Analyze Document</>}
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ This tool provides informational analysis only. Always consult a qualified healthcare professional.
      </p>
    </div>
  );
};

export default DocumentAnalyzer;
