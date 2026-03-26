import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, IndianRupee, Pill, AlertTriangle, FileText, Camera, Upload, Keyboard, Save, Check, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import type { AlternativeContext } from "./MedicationManager";
import ReportShareButtons from "@/components/ReportShareButtons";

const MAX_INPUT_LENGTH = 5000;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB

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

type InputMode = "photo" | "text";

interface PrescriptionScannerProps {
  alternativeMode?: AlternativeContext | null;
  onSelectAlternative?: (alt: { name: string; dosage: string }) => void;
  onCancelAltMode?: () => void;
}

const PrescriptionScanner = ({ alternativeMode, onSelectAlternative, onCancelAltMode }: PrescriptionScannerProps) => {
  const [inputMode, setInputMode] = useState<InputMode>("photo");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When entering alternative mode, pre-fill the medication name and switch to text mode
  useEffect(() => {
    if (alternativeMode) {
      setInputMode("text");
      setPrescriptionText(alternativeMode.medName);
      setResult(null);
    }
  }, [alternativeMode]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, etc.)");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image too large. Please use an image under 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Extract base64 portion after the data URL prefix
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const analyzePrescription = async () => {
    if (inputMode === "text") {
      const text = prescriptionText.trim();
      if (!text) {
        toast.error("Please enter the medication names from the diagnosis");
        return;
      }
    } else {
      if (!imageBase64) {
        toast.error("Please upload or take a photo of the diagnosis");
        return;
      }
    }

    setLoading(true);
    setResult(null);
    try {
      const body = inputMode === "photo"
        ? { type: "prescription_scan", payload: { image: imageBase64 } }
        : { type: "prescription_scan", payload: prescriptionText.substring(0, MAX_INPUT_LENGTH) };

      const { data, error } = await supabase.functions.invoke("health-tools", { body });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      try {
        const parsed: ScanResult = JSON.parse(data.response);
        setResult(parsed);
      } catch {
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

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Alternative mode banner */}
      {alternativeMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Finding alternatives for: <strong>{alternativeMode.medName}</strong></p>
              <p className="text-xs text-muted-foreground">Analyze to see alternatives, then select one to replace in your order.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={onCancelAltMode}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </CardContent>
        </Card>
      )}

      {!alternativeMode && (
      <Card className="border-success/20 bg-success/5">
        <CardContent className="p-3 flex items-start gap-2">
          <FileText className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Upload a photo of your doctor's diagnosis or type medication names to check salt composition, find cheaper govt-certified alternatives (Jan Aushadhi/PMBJP), and filter out banned medications.
          </p>
        </CardContent>
      </Card>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={inputMode === "photo" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setInputMode("photo")}
        >
          <Camera className="w-4 h-4 mr-1" /> Photo / Upload
        </Button>
        <Button
          variant={inputMode === "text" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => setInputMode("text")}
        >
          <Keyboard className="w-4 h-4 mr-1" /> Type Manually
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {inputMode === "photo" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Prescription preview"
                    className="w-full max-h-64 object-contain rounded-lg border border-border"
                  />
                  <Button variant="ghost" size="sm" onClick={clearImage} className="w-full text-muted-foreground">
                    Remove & choose another
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Tap to upload diagnosis photo</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG · Max 4MB</p>
                </div>
              )}
            </>
          ) : (
            <>
              <Textarea
                placeholder={"Enter medication names from the diagnosis, e.g.:\nTab Crocin 500mg\nCap Omez 20mg\nTab Ecosprin 75mg"}
                value={prescriptionText}
                onChange={(e) => setPrescriptionText(e.target.value.substring(0, MAX_INPUT_LENGTH))}
                rows={5}
                maxLength={MAX_INPUT_LENGTH}
              />
              <p className="text-[10px] text-muted-foreground text-right">{prescriptionText.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}</p>
            </>
          )}
          <Button className="w-full bg-success text-success-foreground hover:bg-success/90" onClick={analyzePrescription} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</> : <><Pill className="w-4 h-4 mr-1" /> Analyze Diagnosis</>}
          </Button>
        </CardContent>
      </Card>

      {result && <PrescriptionResults result={result} onSelectAlternative={alternativeMode ? onSelectAlternative : undefined} />}

      {result && (
        <ReportShareButtons
          title="Doctor's Diagnosis Analysis"
          subtitle="Medication Analysis Report"
          content={[result.summary, ...(result.medications?.map(m => `${m.name} (${m.salt_composition}) — ${m.dosage} — ${m.status.toUpperCase()}`) || [])].join("\n")}
          category="Doctor's Diagnosis"
        />
      )}

      {result && <SaveToVaultButton result={result} />}

      <p className="text-[10px] text-muted-foreground text-center">
        ⚠️ This tool provides informational guidance only. Always consult your doctor before changing medications.
      </p>
    </div>
  );
};

const PrescriptionResults = ({ result, onSelectAlternative }: { result: ScanResult; onSelectAlternative?: (alt: { name: string; dosage: string }) => void }) => (
  <div className="space-y-3">
    {result.summary && (
      <Card className="border-primary/20">
        <CardContent className="p-3">
          <p className="text-sm">{result.summary}</p>
        </CardContent>
      </Card>
    )}

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

            <div className="bg-muted/50 rounded p-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Salt / Composition</p>
              <p className="text-xs">{med.salt_composition}</p>
            </div>

            {med.ban_details && (
              <div className="bg-destructive/10 rounded p-2">
                <p className="text-xs text-destructive">{med.ban_details}</p>
              </div>
            )}

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
                  <div key={ai} className="bg-success/5 rounded p-2 border border-success/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{alt.name}</p>
                        <p className="text-[10px] text-muted-foreground">{alt.salt} · {alt.source}</p>
                      </div>
                      <Badge variant="outline" className="text-success border-success/30 text-[10px]">{alt.price_approx}</Badge>
                    </div>
                    {onSelectAlternative && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs border-primary text-primary hover:bg-primary/10"
                        onClick={() => onSelectAlternative({ name: alt.name, dosage: med.dosage })}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" /> Select this Medication
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

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
);

const SaveToVaultButton = ({ result }: { result: ScanResult }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveToVault = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please log in to save"); return; }

    setSaving(true);
    try {
      const description = [
        result.summary,
        "",
        "Medications:",
        ...(result.medications?.map(m =>
          `• ${m.name} (${m.salt_composition}) — ${m.dosage} — Status: ${m.status.toUpperCase()}${m.ban_details ? ` ⚠️ ${m.ban_details}` : ""}`
        ) || []),
        ...(result.interactions?.length ? ["", "Interactions:", ...result.interactions.map(i => `• ${i}`)] : []),
      ].join("\n");

      const { error } = await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title: "Doctor's Diagnosis Analysis",
        record_type: "Doctor's Diagnosis",
        description,
        record_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Saved to Medical Vault");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
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
  );
};

export default PrescriptionScanner;
