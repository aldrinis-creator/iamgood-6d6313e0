import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Camera, Upload, X, Loader2, AlertTriangle, Save, Check, Info, Pill, ShieldAlert, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastAiError } from "@/lib/aiErrorMessage";
import ReportShareButtons from "@/components/ReportShareButtons";
import { bannedSingleSubstances } from "@/data/bannedDrugs";

interface VisualFeatures {
  shape: string;
  color: string;
  imprint: string;
  score_line: boolean;
  size_estimate: string;
  coating: string;
}

interface LikelyMed {
  name: string;
  salt: string;
  common_brands: string[];
  typical_use: string;
  confidence: number;
}

interface MatchInfo {
  matched: boolean;
  matched_med_name: string | null;
  warning: "no warning" | "wrong pill" | "unknown pill" | "banned/restricted in India";
}

interface PillResult {
  image_quality: "good" | "poor";
  pill_detected: boolean;
  visual_features: VisualFeatures;
  likely_medications: LikelyMed[];
  match_against_prescriptions: MatchInfo;
  safety_notes: string[];
  recommendations: string[];
  confidence: number;
  disclaimer: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const PHOTO_TIPS = [
  "Place pill on a plain white surface",
  "Use natural daylight, avoid flash glare",
  "Fill the frame; capture imprint side clearly",
  "If a capsule, photograph it whole",
];

const PillIdentifier = () => {
  const { user } = useAuth();
  const [activeMeds, setActiveMeds] = useState<{ name: string; dosage: string }[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PillResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("medications")
      .select("name, dosage, end_date")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const today = new Date().toISOString().split("T")[0];
        const active = (data || []).filter((m: any) => !m.end_date || m.end_date >= today);
        setActiveMeds(active.map((m: any) => ({ name: m.name, dosage: m.dosage })));
      });
  }, [user]);

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

  const analyze = async () => {
    if (!imageBase64) {
      toast.error("Please add a photo first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: {
          type: "pill_identification",
          payload: {
            image: imageBase64,
            active_medications: activeMeds,
            banned_substances: bannedSingleSubstances,
          },
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const raw = (data?.response || "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      const parsed: PillResult = JSON.parse(raw);
      setResult(parsed);

      // Notify guardian on wrong pill / banned
      const warn = parsed.match_against_prescriptions?.warning;
      if (user && (warn === "wrong pill" || warn === "banned/restricted in India")) {
        notifyGuardians(parsed).catch((e) => console.error("guardian notify failed", e));
      }
    } catch (err: any) {
      console.error("Pill ID error:", err);
      await toastAiError(err, "Identification failed. Please try a clearer photo.");
    } finally {
      setLoading(false);
    }
  };

  const notifyGuardians = async (r: PillResult) => {
    if (!user) return;
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id, guardian_user_id")
      .eq("user_id", user.id)
      .eq("status", "accepted");
    if (!guardians?.length) return;
    const title = r.match_against_prescriptions.warning === "banned/restricted in India"
      ? "⚠️ Banned pill identified"
      : "⚠️ Possible wrong pill";
    const message = `Pill ID flagged: ${r.likely_medications[0]?.name || "unknown pill"}. ${r.match_against_prescriptions.warning}. Please check on your ward.`;
    const notifs = guardians.map((g: any) => ({
      user_id: user.id,
      guardian_id: g.id,
      title,
      message,
      type: "pill_warning",
    }));
    await supabase.rpc("insert_notifications_deduped", { p_notifications: notifs as any });
  };

  const saveToVault = async () => {
    if (!user || !result) return;
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      const fileName = `pill-id-${Date.now()}.jpg`;
      if (originalFile) {
        const path = `${user.id}/${Date.now()}-${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("medical-documents")
          .upload(path, originalFile, { contentType: originalFile.type });
        if (!upErr) fileUrl = path;
      }
      const top = result.likely_medications[0]?.name || "Unknown pill";
      const { error } = await supabase.from("medical_records").insert({
        user_id: user.id,
        title: `Pill ID: ${top} — ${new Date().toLocaleDateString("en-IN")}`,
        record_type: "Lab Report",
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

  // ============ Results view ============
  if (result) {
    const warn = result.match_against_prescriptions?.warning || "no warning";
    const isWrongPill = warn === "wrong pill" || warn === "banned/restricted in India";
    const isUnknown = warn === "unknown pill";
    const isMatch = warn === "no warning" && result.match_against_prescriptions.matched;
    const lowQuality = result.image_quality === "poor" || !result.pill_detected || result.confidence < 50;

    if (!result.pill_detected || result.image_quality === "poor") {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={reset}>← Try again</Button>
          {imagePreview && <img src={imagePreview} alt="Pill" className="w-full max-h-64 object-contain rounded-lg border bg-muted" />}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Photo unclear</AlertTitle>
            <AlertDescription>We couldn't identify a pill clearly. Please retake on a plain white surface in good light.</AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={reset}>← New scan</Button>

        {imagePreview && (
          <img src={imagePreview} alt="Pill" className="w-full max-h-64 object-contain rounded-lg border bg-muted" />
        )}

        {/* Headline match banner */}
        {isWrongPill && (
          <Alert variant="destructive" className="border-2">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle className="text-lg font-bold">DO NOT TAKE</AlertTitle>
            <AlertDescription>
              {warn === "banned/restricted in India"
                ? "This pill appears to contain a substance BANNED or RESTRICTED in India. Do not consume. Consult your doctor."
                : "This pill does not match any of your active prescriptions. Verify with your doctor or pharmacist before taking."}
            </AlertDescription>
          </Alert>
        )}
        {isMatch && (
          <Alert className="border-success/50 bg-success/10">
            <Check className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">Matches your prescription</AlertTitle>
            <AlertDescription>
              Likely <strong>{result.match_against_prescriptions.matched_med_name}</strong> from your active medications.
            </AlertDescription>
          </Alert>
        )}
        {isUnknown && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <HelpCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Unknown pill</AlertTitle>
            <AlertDescription>
              You have no active prescriptions on record to compare against. Verify with a pharmacist before consuming.
            </AlertDescription>
          </Alert>
        )}
        {lowQuality && !isWrongPill && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Low confidence ({result.confidence}%)</AlertTitle>
            <AlertDescription>Verify with a pharmacist before consuming.</AlertDescription>
          </Alert>
        )}

        {/* Visual features */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Visual features</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Shape:</span> <span className="font-medium capitalize">{result.visual_features.shape}</span></div>
              <div><span className="text-muted-foreground">Color:</span> <span className="font-medium">{result.visual_features.color}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Imprint:</span> <span className="font-mono font-medium">{result.visual_features.imprint || "none"}</span></div>
              <div><span className="text-muted-foreground">Score line:</span> <span className="font-medium">{result.visual_features.score_line ? "Yes" : "No"}</span></div>
              <div><span className="text-muted-foreground">Size:</span> <span className="font-medium capitalize">{result.visual_features.size_estimate}</span></div>
              <div><span className="text-muted-foreground">Coating:</span> <span className="font-medium capitalize">{result.visual_features.coating}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Likely medications */}
        {result.likely_medications.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Likely medication{result.likely_medications.length > 1 ? "s" : ""}</p>
              {result.likely_medications.map((m, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{m.name}</p>
                    <Badge variant={m.confidence >= 70 ? "default" : m.confidence >= 50 ? "secondary" : "outline"}>
                      {m.confidence}%
                    </Badge>
                  </div>
                  {m.salt && <p className="text-xs text-muted-foreground">Salt: {m.salt}</p>}
                  {m.common_brands?.length > 0 && (
                    <p className="text-xs text-muted-foreground">Brands: {m.common_brands.join(", ")}</p>
                  )}
                  {m.typical_use && <p className="text-xs">{m.typical_use}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Safety + recommendations */}
        {(result.safety_notes.length > 0 || result.recommendations.length > 0) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {result.safety_notes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Safety notes</p>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    {result.safety_notes.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {result.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    {result.recommendations.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <ReportShareButtons
          title="Pill Identification Report"
          subtitle="AI-powered visual pill ID"
          content={formatReport(result)}
          category="Lab Reports"
        />

        <Button onClick={saveToVault} disabled={saving || saved} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saved ? "Saved to Medical Vault" : "Save to Medical Vault"}
        </Button>

        <p className="text-xs text-muted-foreground italic text-center">
          {result.disclaimer || "Visual identification only. Always verify with a pharmacist before consuming an unfamiliar pill."}
        </p>
      </div>
    );
  }

  // ============ Capture view ============
  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Pill className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Not sure about your tablet?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Photograph the pill and we'll identify it, then check it against your active prescriptions and India's banned-drug list.
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Photo tips</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
            {PHOTO_TIPS.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </AlertDescription>
      </Alert>

      {activeMeds.length === 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs">
            You have no active medications on record — we'll identify the pill but can't cross-check against prescriptions.
          </AlertDescription>
        </Alert>
      )}

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
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Identifying…</> : "Identify Pill"}
      </Button>

      <p className="text-xs text-muted-foreground italic text-center">
        Visual identification only. Always verify with a pharmacist before consuming.
      </p>
    </div>
  );
};

function formatReport(r: PillResult): string {
  const top = r.likely_medications[0];
  const warn = r.match_against_prescriptions.warning;
  return [
    `**Top match:** ${top?.name || "Unknown"}${top ? ` (${top.confidence}%)` : ""}`,
    top?.salt ? `**Salt:** ${top.salt}` : "",
    `**Prescription check:** ${warn}`,
    r.match_against_prescriptions.matched_med_name ? `**Matched against:** ${r.match_against_prescriptions.matched_med_name}` : "",
    "",
    "**Visual features:**",
    `- Shape: ${r.visual_features.shape}`,
    `- Color: ${r.visual_features.color}`,
    `- Imprint: ${r.visual_features.imprint || "none"}`,
    `- Score line: ${r.visual_features.score_line ? "Yes" : "No"}`,
    `- Size: ${r.visual_features.size_estimate}`,
    `- Coating: ${r.visual_features.coating}`,
    "",
    ...(r.safety_notes.length ? ["**Safety notes:**", ...r.safety_notes.map((s) => `- ${s}`), ""] : []),
    ...(r.recommendations.length ? ["**Recommendations:**", ...r.recommendations.map((s) => `- ${s}`), ""] : []),
    `_${r.disclaimer}_`,
  ].filter(Boolean).join("\n");
}

export default PillIdentifier;
