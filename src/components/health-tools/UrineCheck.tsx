import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Camera, Upload, X, Loader2, Droplet, TestTube, AlertTriangle, Save, Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastAiError } from "@/lib/aiErrorMessage";
import ReportShareButtons from "@/components/ReportShareButtons";

type Mode = "color" | "dipstick";

interface ColorResult {
  image_quality: "good" | "poor";
  color_category: string;
  hydration_status: "over" | "good" | "mild_dehydration" | "dehydrated";
  possible_indicators: string[];
  red_flags: string[];
  recommendations: string[];
  see_doctor: "no" | "soon" | "urgent";
  confidence: number;
  disclaimer: string;
}

interface DipstickPad {
  name: string;
  reading: string;
  status: "normal" | "borderline" | "abnormal";
  notes?: string;
}

interface DipstickResult {
  image_quality: "good" | "poor";
  strip_detected: boolean;
  pads: DipstickPad[];
  summary: string;
  red_flags: string[];
  recommendations: string[];
  see_doctor: "no" | "soon" | "urgent";
  confidence: number;
  disclaimer: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const COLOR_SWATCH: Record<string, string> = {
  pale: "#FFF9C4",
  straw: "#FFEB99",
  yellow: "#FFD54F",
  amber: "#FFA726",
  orange: "#FB8C00",
  pink_red: "#E53935",
  brown: "#6D4C2C",
  cloudy: "#E0E0E0",
  other: "#BDBDBD",
};

const HYDRATION_LABEL: Record<string, string> = {
  over: "Over-hydrated",
  good: "Well-hydrated",
  mild_dehydration: "Mildly dehydrated",
  dehydrated: "Dehydrated",
};

const PHOTO_TIPS: Record<Mode, string[]> = {
  color: [
    "Use a clear or white container",
    "Take photo in natural daylight",
    "Plain white background, not toilet water",
    "Hold steady, fill the frame with the sample",
  ],
  dipstick: [
    "Lay strip flat on a white surface",
    "Photograph 60–120 seconds after dipping",
    "Include the bottle's reference colour chart in the frame",
    "Use natural daylight, no flash glare",
  ],
};

const UrineCheck = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("color");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [colorResult, setColorResult] = useState<ColorResult | null>(null);
  const [dipstickResult, setDipstickResult] = useState<DipstickResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setOriginalFile(null);
    setColorResult(null);
    setDipstickResult(null);
    setSaved(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Image must be under 10MB");
      e.target.value = "";
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Please select an image");
      e.target.value = "";
      return;
    }
    setOriginalFile(f);
    setImagePreview(URL.createObjectURL(f));
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(f);
    setColorResult(null);
    setDipstickResult(null);
    setSaved(false);
  };

  const analyze = async () => {
    if (!imageBase64) {
      toast.error("Please add a photo first");
      return;
    }
    setLoading(true);
    try {
      const type = mode === "color" ? "urine_color_analysis" : "urine_dipstick_analysis";
      const result = await supabase.functions.invoke("health-tools", {
        body: { type, payload: { image: imageBase64 } },
      });
      const { data, error } = result;
      if (error) {
        await toastAiError(error, `Invoke error: ${error.message || "Unknown"}`);
        return;
      }
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }
      const raw = (data?.response || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      const parsed = JSON.parse(raw);
      if (mode === "color") setColorResult(parsed);
      else setDipstickResult(parsed);
    } catch (err: any) {
      console.error("Urine analysis error:", err);
      await toastAiError(err, err?.message === "timeout" ? "Analysis timed out. Try again." : `Analysis failed: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const saveToVault = async () => {
    if (!user) {
      toast.error("Please log in to save");
      return;
    }
    const result = mode === "color" ? colorResult : dipstickResult;
    if (!result) return;
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileName = `urine-${mode}-${Date.now()}.jpg`;
      if (originalFile) {
        const path = `${user.id}/${Date.now()}-${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("medical-documents")
          .upload(path, originalFile, { contentType: originalFile.type });
        if (!upErr) fileUrl = path;
      }
      const title = mode === "color"
        ? `Urine Color Check — ${new Date().toLocaleDateString("en-IN")}`
        : `Urine Dipstick — ${new Date().toLocaleDateString("en-IN")}`;
      const description = JSON.stringify(result, null, 2);
      const { error } = await supabase.from("medical_records").insert({
        user_id: user.id,
        title,
        record_type: "Visual Check",
        description,
        file_name: fileName,
        file_url: fileUrl,
        record_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Saved to Medical Vault");
    } catch (err: any) {
      console.error(err);
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const result = mode === "color" ? colorResult : dipstickResult;

  // Results view
  if (result) {
    const urgent = result.see_doctor === "urgent";
    const soon = result.see_doctor === "soon";
    const lowQuality = result.image_quality === "poor" || result.confidence < 50;
    const shareContent = mode === "color"
      ? formatColorReport(colorResult!)
      : formatDipstickReport(dipstickResult!);

    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={reset}>← New scan</Button>

        {imagePreview && (
          <img src={imagePreview} alt="Sample" className="w-full max-h-64 object-contain rounded-lg border bg-muted" />
        )}

        {urgent && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Urgent — see a doctor today</AlertTitle>
            <AlertDescription>
              {result.red_flags.join(" · ") || "Concerning findings detected."}
            </AlertDescription>
          </Alert>
        )}
        {!urgent && soon && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Consult a doctor soon</AlertTitle>
            <AlertDescription>{result.red_flags.join(" · ") || "Some findings warrant a check-up."}</AlertDescription>
          </Alert>
        )}
        {lowQuality && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Low confidence ({result.confidence}%)</AlertTitle>
            <AlertDescription>Photo may be unclear. Consider retaking with better lighting for a more reliable result.</AlertDescription>
          </Alert>
        )}

        {mode === "color" && colorResult && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full border-2 border-border shadow-inner"
                  style={{ background: COLOR_SWATCH[colorResult.color_category] || COLOR_SWATCH.other }}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Detected colour</p>
                  <p className="font-semibold capitalize">{colorResult.color_category.replace("_", " ")}</p>
                  <Badge variant="outline" className="mt-1">{HYDRATION_LABEL[colorResult.hydration_status]}</Badge>
                </div>
              </div>
              {colorResult.possible_indicators.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Possible indicators</p>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    {colorResult.possible_indicators.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
              {colorResult.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    {colorResult.recommendations.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {mode === "dipstick" && dipstickResult && (
          <Card>
            <CardContent className="p-4 space-y-4">
              {!dipstickResult.strip_detected ? (
                <p className="text-sm text-muted-foreground">No test strip clearly detected. Please retake the photo.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {dipstickResult.pads.map((pad, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{pad.name}</p>
                          {pad.notes && <p className="text-xs text-muted-foreground truncate">{pad.notes}</p>}
                        </div>
                        <span className="text-sm font-mono">{pad.reading}</span>
                        <Badge
                          variant="outline"
                          className={
                            pad.status === "abnormal"
                              ? "border-destructive text-destructive"
                              : pad.status === "borderline"
                              ? "border-amber-500 text-amber-600"
                              : "border-success text-success"
                          }
                        >
                          {pad.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {dipstickResult.summary && (
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{dipstickResult.summary}</p>
                  )}
                  {dipstickResult.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        {dipstickResult.recommendations.map((i, idx) => <li key={idx}>{i}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <ReportShareButtons
          title={mode === "color" ? "Urine Color Check" : "Urine Dipstick Analysis"}
          subtitle="AI-powered urine screening"
          content={shareContent}
          category="Lab Reports"
        />

        <div className="flex gap-2">
          <Button onClick={saveToVault} disabled={saving || saved} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved" : "Save to Vault"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground italic text-center">
          {result.disclaimer || "Not a diagnostic test. Consult a doctor for symptoms."}
        </p>
      </div>
    );
  }

  // Capture view
  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); reset(); }}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="color"><Droplet className="w-4 h-4 mr-2" /> Colour Check</TabsTrigger>
          <TabsTrigger value="dipstick"><TestTube className="w-4 h-4 mr-2" /> Dipstick Reader</TabsTrigger>
        </TabsList>
        <TabsContent value={mode} className="mt-4 space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Photo tips</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
                {PHOTO_TIPS[mode].map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </AlertDescription>
          </Alert>

          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border bg-muted" />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={reset}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="h-24 flex-col gap-2">
                <Upload className="w-5 h-5" />
                <span className="text-xs">Upload</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.setAttribute("capture", "environment");
                    fileRef.current.click();
                  }
                }}
                className="h-24 flex-col gap-2"
              >
                <Camera className="w-5 h-5" />
                <span className="text-xs">Camera</span>
              </Button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

          <Button onClick={analyze} disabled={!imageBase64 || loading} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</> : "Analyze"}
          </Button>

          <p className="text-xs text-muted-foreground italic text-center">
            Not a diagnostic test. Consult a doctor for any concerning symptoms.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function formatColorReport(r: ColorResult): string {
  return [
    `**Colour:** ${r.color_category.replace("_", " ")}`,
    `**Hydration:** ${HYDRATION_LABEL[r.hydration_status]}`,
    `**Confidence:** ${r.confidence}%`,
    "",
    "**Possible indicators:**",
    ...r.possible_indicators.map(i => `- ${i}`),
    "",
    ...(r.red_flags.length ? ["**Red flags:**", ...r.red_flags.map(i => `- ${i}`), ""] : []),
    "**Recommendations:**",
    ...r.recommendations.map(i => `- ${i}`),
    "",
    `_${r.disclaimer}_`,
  ].join("\n");
}

function formatDipstickReport(r: DipstickResult): string {
  return [
    `**Confidence:** ${r.confidence}%`,
    "",
    "**Readings:**",
    ...r.pads.map(p => `- ${p.name}: ${p.reading} (${p.status})${p.notes ? ` — ${p.notes}` : ""}`),
    "",
    `**Summary:** ${r.summary}`,
    ...(r.red_flags.length ? ["", "**Red flags:**", ...r.red_flags.map(i => `- ${i}`)] : []),
    "",
    "**Recommendations:**",
    ...r.recommendations.map(i => `- ${i}`),
    "",
    `_${r.disclaimer}_`,
  ].join("\n");
}

export default UrineCheck;
