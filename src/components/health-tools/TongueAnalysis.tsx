import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Camera, Upload, X, Loader2, AlertTriangle, Save, Check, Info, Smile } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastAiError } from "@/lib/aiErrorMessage";
import ReportShareButtons from "@/components/ReportShareButtons";

interface TongueResult {
  image_quality: "good" | "poor";
  tongue_detected: boolean;
  color: string;
  coating: string;
  moisture: string;
  shape: string;
  surface: string[];
  possible_indicators: string[];
  red_flags: string[];
  recommendations: string[];
  see_doctor: "no" | "soon" | "urgent";
  confidence: number;
  disclaimer: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const COLOR_SWATCH: Record<string, string> = {
  pink: "#F8A5B5",
  pale: "#F5D6CC",
  red: "#D9322F",
  purple: "#7E3F70",
  bluish: "#6F8FB8",
  other: "#BDBDBD",
};

const PHOTO_TIPS = [
  "Stick your tongue out fully, mouth wide open",
  "Use natural daylight; avoid flash glare",
  "Plain background, hold phone steady",
  "Fill the frame — get close but in focus",
];

const TongueAnalysis = () => {
  const { user } = useAuth();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TongueResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setOriginalFile(null);
    setResult(null);
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
    setResult(null);
    setSaved(false);
  };

  const notifyGuardians = async (r: TongueResult) => {
    if (!user) return;
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id, guardian_user_id")
      .eq("user_id", user.id)
      .eq("status", "accepted");
    if (!guardians?.length) return;
    const title = r.see_doctor === "urgent" ? "⚠️ Tongue check — urgent" : "Tongue check — concerning findings";
    const message = `Tongue analysis flagged: ${r.red_flags.slice(0, 2).join("; ") || "concerning visual findings"}. Please check on your ward.`;
    const notifs = guardians.map((g: any) => ({
      user_id: user.id,
      guardian_id: g.id,
      title,
      message,
      type: "tongue_warning",
    }));
    await supabase.rpc("insert_notifications_deduped", { p_notifications: notifs as any });
  };

  const analyze = async () => {
    if (!imageBase64) {
      toast.error("Please add a photo first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "tongue_analysis", payload: { image: imageBase64 } },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const raw = (data?.response || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      const parsed: TongueResult = JSON.parse(raw);
      setResult(parsed);

      // Guardian alert on red flags
      if (user && (parsed.see_doctor === "urgent" || (parsed.see_doctor === "soon" && parsed.red_flags.length > 0))) {
        notifyGuardians(parsed).catch((e) => console.error("guardian notify failed", e));
      }
    } catch (err: any) {
      console.error("Tongue analysis error:", err);
      await toastAiError(err, "Analysis failed. Please try a clearer photo.");
    } finally {
      setLoading(false);
    }
  };

  const saveToVault = async () => {
    if (!user || !result) return;
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      const fileName = `tongue-${Date.now()}.jpg`;
      if (originalFile) {
        const path = `${user.id}/${Date.now()}-${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("medical-documents")
          .upload(path, originalFile, { contentType: originalFile.type });
        if (!upErr) fileUrl = path;
      }
      const title = `Tongue Check — ${new Date().toLocaleDateString("en-IN")}`;
      const { error } = await supabase.from("medical_records").insert({
        user_id: user.id,
        title,
        record_type: "Visual Check",
        description: JSON.stringify(result, null, 2),
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

  // Results view
  if (result) {
    const urgent = result.see_doctor === "urgent";
    const soon = result.see_doctor === "soon";
    const lowQuality = result.image_quality === "poor" || !result.tongue_detected || result.confidence < 50;

    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={reset}>← New scan</Button>

        {imagePreview && (
          <img src={imagePreview} alt="Tongue" className="w-full max-h-64 object-contain rounded-lg border bg-muted" />
        )}

        {!result.tongue_detected && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Photo unclear — retake</AlertTitle>
            <AlertDescription>No tongue clearly detected. Stick tongue out fully, use daylight, and refocus.</AlertDescription>
          </Alert>
        )}

        {urgent && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Urgent — see a doctor today</AlertTitle>
            <AlertDescription>{result.red_flags.join(" · ") || "Concerning findings detected."}</AlertDescription>
          </Alert>
        )}
        {!urgent && soon && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Consult a doctor soon</AlertTitle>
            <AlertDescription>{result.red_flags.join(" · ") || "Some findings warrant a check-up."}</AlertDescription>
          </Alert>
        )}
        {lowQuality && result.tongue_detected && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Low confidence ({result.confidence}%)</AlertTitle>
            <AlertDescription>Photo may be unclear. Consider retaking with better lighting.</AlertDescription>
          </Alert>
        )}

        {result.tongue_detected && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full border-2 border-border shadow-inner"
                  style={{ background: COLOR_SWATCH[result.color] || COLOR_SWATCH.other }}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Tongue colour</p>
                  <p className="font-semibold capitalize">{result.color}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="capitalize">Coating: {result.coating.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className="capitalize">{result.moisture.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className="capitalize">Shape: {result.shape}</Badge>
                  </div>
                </div>
              </div>

              {result.surface?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.surface.map((s, i) => (
                    <Badge key={i} variant="secondary" className="capitalize">{s}</Badge>
                  ))}
                </div>
              )}

              {result.possible_indicators.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Possible indicators</p>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    {result.possible_indicators.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
              {result.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    {result.recommendations.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <ReportShareButtons
          title="Tongue Check"
          subtitle="AI-powered tongue screening"
          content={formatReport(result)}
          category="Lab Reports"
        />

        <div className="flex gap-2">
          <Button onClick={saveToVault} disabled={saving || saved} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved" : "Save to Vault"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground italic text-center">
          {result.disclaimer || "Visual screening only, not a diagnosis."}
        </p>
      </div>
    );
  }

  // Capture view
  return (
    <div className="space-y-4">
      <Alert>
        <Smile className="h-4 w-4" />
        <AlertTitle>Photo tips</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
            {PHOTO_TIPS.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </AlertDescription>
      </Alert>

      {imagePreview ? (
        <div className="relative">
          <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border bg-muted" />
          <Button size="icon" variant="secondary" className="absolute top-2 right-2" onClick={reset}>
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
                fileRef.current.setAttribute("capture", "user");
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
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</> : "Analyze tongue"}
      </Button>

      <p className="text-xs text-muted-foreground italic text-center">
        Not a diagnostic test. Consult a doctor or dentist for persistent symptoms.
      </p>
    </div>
  );
};

function formatReport(r: TongueResult): string {
  return [
    `**Colour:** ${r.color}`,
    `**Coating:** ${r.coating.replace(/_/g, " ")}`,
    `**Moisture:** ${r.moisture.replace(/_/g, " ")}`,
    `**Shape:** ${r.shape}`,
    `**Surface:** ${r.surface.join(", ") || "—"}`,
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

export default TongueAnalysis;
