import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileImage, FlaskConical, FileText, Stethoscope, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const categories = [
  { label: "Medical Images", icon: FileImage, color: "text-primary" },
  { label: "Lab Reports", icon: FlaskConical, color: "text-success" },
  { label: "Prescriptions", icon: FileText, color: "text-primary" },
  { label: "Doctor's Notes", icon: Stethoscope, color: "text-success" },
];

const DocumentAnalyzer = () => {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!textInput && !file) { toast.error("Please provide text or upload a file"); return; }
    setLoading(true);
    try {
      let content = textInput;
      if (file && !textInput) {
        content = await file.text();
      }
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "document_analysis", payload: `Category: ${selectedCat || "General"}\n\nDocument content:\n${content}` },
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

  if (result) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setResult(""); setTextInput(""); setFile(null); }}>← Back</Button>
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
          <p className="text-sm text-muted-foreground">Upload a medical document for AI-powered plain-language analysis.</p>
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

      {/* Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Input type="file" accept="image/*,.pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <p className="text-xs text-center text-muted-foreground">— or paste text content —</p>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
            placeholder="Paste your lab report, prescription, or medical notes here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
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
