import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2, ShieldAlert, IndianRupee, Pill, AlertTriangle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface Alternative {
  name: string;
  salt: string;
  price_approx: string;
  source: string;
}

interface ScannedMedication {
  name: string;
  salt_composition: string;
  dosage: string;
  status: "banned" | "restricted" | "safe" | "unknown";
  ban_details: string | null;
  mrp_approx: string;
  alternatives: Alternative[];
  warnings: string[];
}

interface ScanResult {
  medications: ScannedMedication[];
  interactions: string[];
  summary: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  banned: { label: "BANNED", color: "bg-destructive text-destructive-foreground", icon: <ShieldAlert className="w-3 h-3" /> },
  restricted: { label: "RESTRICTED", color: "bg-orange-500 text-white", icon: <AlertTriangle className="w-3 h-3" /> },
  safe: { label: "SAFE", color: "bg-success text-success-foreground", icon: <Pill className="w-3 h-3" /> },
  unknown: { label: "UNKNOWN", color: "bg-muted text-muted-foreground", icon: <Pill className="w-3 h-3" /> },
};

const PrescriptionScanner = () => {
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For image files, we'll use OCR-like approach - convert to base64 and send to AI
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await analyzePrescription(`[Image uploaded: ${file.name}]\nPlease analyze this prescription image. The image content is provided as base64 data. Extract all medication names, dosages, and instructions visible in the prescription.\n\nBase64 image data (first 500 chars for context): ${base64?.substring(0, 500)}`);
    };
    reader.readAsDataURL(file);
  };

  const analyzePrescription = async (text: string) => {
    if (!text.trim()) {
      toast.error("Please enter or upload a prescription");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "prescription_scan", payload: text },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      try {
        const parsed: ScanResult = JSON.parse(data.response);
        setResult(parsed);
      } catch {
        // If AI didn't return valid JSON, try to extract it
        const jsonMatch = data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          setResult(JSON.parse(jsonMatch[0]));
        } else {
          toast.error("Could not parse prescription analysis");
        }
      }
    } catch {
      toast.error("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-success/20 bg-success/5">
        <CardContent className="p-3 flex items-start gap-2">
          <FileText className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Scan your prescription to check salt composition, find cheaper govt-certified alternatives (Jan Aushadhi/PMBJP), and filter out banned medications.
          </p>
        </CardContent>
      </Card>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button variant={mode === "upload" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode("upload")}>
          <Camera className="w-4 h-4 mr-1" /> Upload Image
        </Button>
        <Button variant={mode === "manual" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setMode("manual")}>
          <FileText className="w-4 h-4 mr-1" /> Type Medicines
        </Button>
      </div>

      {mode === "upload" ? (
        <Card>
          <CardContent className="p-4 text-center space-y-3">
            <Camera className="w-12 h-12 text-success mx-auto" />
            <p className="text-sm text-muted-foreground">Upload a photo of your prescription</p>
            <Input ref={fileRef} type="file" accept="image/*" capture="environment" className="max-w-xs mx-auto" onChange={handleFileUpload} />
            <Button className="w-full bg-success text-success-foreground hover:bg-success/90" onClick={() => fileRef.current?.click()} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</> : <><Upload className="w-4 h-4 mr-1" /> Upload & Analyze</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="Enter medication names from your prescription, e.g.:\nTab Crocin 500mg\nCap Omez 20mg\nTab Ecosprin 75mg"
              value={prescriptionText}
              onChange={(e) => setPrescriptionText(e.target.value)}
              rows={5}
            />
            <Button className="w-full bg-success text-success-foreground hover:bg-success/90" onClick={() => analyzePrescription(prescriptionText)} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</> : <><Pill className="w-4 h-4 mr-1" /> Analyze Prescription</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Summary */}
          {result.summary && (
            <Card className="border-primary/20">
              <CardContent className="p-3">
                <p className="text-sm">{result.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Medications */}
          {result.medications?.map((med, idx) => {
            const config = statusConfig[med.status] || statusConfig.unknown;
            return (
              <Card key={idx} className={med.status === "banned" ? "border-destructive/30" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{med.name}</p>
                      <p className="text-xs text-muted-foreground">{med.dosage}</p>
                    </div>
                    <Badge className={`${config.color} gap-1`}>
                      {config.icon} {config.label}
                    </Badge>
                  </div>

                  {/* Salt composition */}
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Salt / Composition</p>
                    <p className="text-xs">{med.salt_composition}</p>
                  </div>

                  {med.ban_details && (
                    <div className="bg-destructive/10 rounded p-2">
                      <p className="text-xs text-destructive">{med.ban_details}</p>
                    </div>
                  )}

                  {/* Price & Alternatives */}
                  {med.alternatives && med.alternatives.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Prescribed MRP</p>
                        <p className="text-xs font-medium">{med.mrp_approx}</p>
                      </div>
                      <p className="text-[10px] font-semibold text-success uppercase flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" /> Cheaper Alternatives
                      </p>
                      {med.alternatives.map((alt, ai) => (
                        <div key={ai} className="flex items-center justify-between bg-success/5 rounded p-2 border border-success/20">
                          <div>
                            <p className="text-xs font-medium">{alt.name}</p>
                            <p className="text-[10px] text-muted-foreground">{alt.salt} · {alt.source}</p>
                          </div>
                          <Badge variant="outline" className="text-success border-success/30 text-[10px]">{alt.price_approx}</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {med.warnings && med.warnings.length > 0 && (
                    <div className="space-y-1">
                      {med.warnings.map((w, wi) => (
                        <p key={wi} className="text-[10px] text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {w}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Drug Interactions */}
          {result.interactions && result.interactions.length > 0 && (
            <Card className="border-orange-300">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs font-semibold flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="w-4 h-4" /> Drug Interactions Found
                </p>
                {result.interactions.map((i, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">• {i}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        ⚠️ This tool provides informational guidance only. Always consult your doctor before changing medications.
      </p>
    </div>
  );
};

export default PrescriptionScanner;
