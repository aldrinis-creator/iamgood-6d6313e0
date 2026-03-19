import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileImage, FlaskConical, FileText, Stethoscope, Loader2, Upload, Camera, X, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const MAX_TEXT_LENGTH = 10000;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

const categories = [
  { label: "Medical Images", icon: FileImage, color: "text-primary" },
  { label: "Lab Reports", icon: FlaskConical, color: "text-success" },
  { label: "Prescriptions", icon: FileText, color: "text-primary" },
  { label: "Doctor's Notes", icon: Stethoscope, color: "text-success" },
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

const DocumentAnalyzer = () => {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [mode, setMode] = useState<InputMode>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animated progress while loading
  useEffect(() => {
    if (!loading) { setProgress(0); setStepIndex(0); return; }
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      // Asymptotic progress: approaches 95% over ~15s
      const pct = Math.min(95, (elapsed / (elapsed + 6000)) * 100);
      setProgress(pct);
      // Update step label
      const idx = analysisSteps.findIndex((s) => elapsed < s.duration);
      setStepIndex(idx === -1 ? analysisSteps.length - 1 : idx);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  // Snap to 100% briefly when result arrives
  useEffect(() => {
    if (result && loading) setProgress(100);
  }, [result, loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, etc.)");
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be under 4MB");
      e.target.value = "";
      return;
    }

    setImagePreview(URL.createObjectURL(selected));
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
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
    if (mode === "photo" && !imageBase64) {
      toast.error("Please upload a photo of your document");
      return;
    }
    if (mode === "text" && !textInput && !file) {
      toast.error("Please provide text or upload a text file");
      return;
    }

    setLoading(true);
    try {
      let payload: any;

      if (mode === "photo" && imageBase64) {
        payload = {
          image: imageBase64,
          category: selectedCat || "General",
        };
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

      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "document_analysis", payload },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setResult(data.response);
    } catch {
      toast.error("Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <h3 className="font-semibold text-base">Analyzing Document…</h3>
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
              <Skeleton className="h-4 w-5/6" />
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          This may take 10–30 seconds depending on document complexity.
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setResult(""); setTextInput(""); setFile(null); clearImage(); }}>← Back</Button>
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Analysis Results
            </h3>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">
          ⚠️ AI analysis is for informational purposes only. Consult a doctor for medical decisions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 text-center space-y-3">
          <Search className="w-12 h-12 text-primary mx-auto" />
          <h3 className="font-semibold">Document Analyzer</h3>
          <p className="text-sm text-muted-foreground">Upload a photo or paste text from a medical document for AI-powered plain-language analysis.</p>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => (
          <button
            key={cat.label}
            onClick={() => setSelectedCat(cat.label)}
            className={`p-3 rounded-lg border flex items-center gap-2 text-left transition-all ${
              selectedCat === cat.label ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <cat.icon className={`w-5 h-5 ${cat.color}`} />
            <span className="text-xs font-medium">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "photo" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("photo")}
        >
          <Camera className="w-4 h-4 mr-2" /> Photo / Upload
        </Button>
        <Button
          variant={mode === "text" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("text")}
        >
          <Type className="w-4 h-4 mr-2" /> Manual Text
        </Button>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {mode === "photo" ? (
            <>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Document preview" className="w-full rounded-lg border border-border max-h-64 object-contain bg-muted" />
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={clearImage}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tap to take photo or upload image</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG — max 4MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
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
                  placeholder="Paste your lab report, prescription, or medical notes here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value.substring(0, MAX_TEXT_LENGTH))}
                  maxLength={MAX_TEXT_LENGTH}
                />
                <p className="text-[10px] text-muted-foreground text-right">{textInput.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}</p>
              </div>
            </>
          )}
          <Button onClick={analyze} disabled={loading} className="w-full">
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
