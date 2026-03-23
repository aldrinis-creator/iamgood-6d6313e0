import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScanFace, Camera, CameraOff, Heart, Brain, AlertTriangle, History, Trash2, Lightbulb, Upload, Video, ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const SCAN_DURATION = 30;
const CALIBRATION_DURATION = 3;
const SAMPLE_RATE = 15;
const MIN_SAMPLES = (SCAN_DURATION - CALIBRATION_DURATION) * SAMPLE_RATE * 0.4;

const SKIN_GREEN_MIN = 30;
const SKIN_GREEN_MAX = 230;
const MIN_VALID_FRAME_RATIO = 0.4;
const MIN_SIGNAL_STDDEV = 0.1;
const MIN_SNR = 0.8;

type ScanPhase = "idle" | "starting" | "calibrating" | "scanning" | "analyzing" | "results" | "failed";
type InputMode = "live" | "photo" | "video";

interface ScanResults {
  heartRate: number | null;
  stressLevel: "Low" | "Moderate" | "High";
  stressScore: number;
  confidence: "Good" | "Fair" | "Poor";
}

interface PhotoAnalysisResults {
  face_detected: boolean;
  fatigue_level: string;
  fatigue_score: number;
  stress_indicators: string;
  stress_score: number;
  skin_observations: string;
  wellness_notes: string;
  recommendations: string[];
}

const getStressFromHR = (hr: number): { level: "Low" | "Moderate" | "High"; score: number } => {
  if (hr < 70) return { level: "Low", score: 25 };
  if (hr < 85) return { level: "Low", score: 40 };
  if (hr < 100) return { level: "Moderate", score: 60 };
  return { level: "High", score: 85 };
};

const SCAN_TIPS = [
  "Try in brighter, even lighting",
  "Hold phone ~30cm from your face",
  "Stay very still during the scan",
  "Avoid backlit situations (no window behind you)",
  "Remove glasses if possible",
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const FaceScan = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const greenSamples = useRef<number[]>([]);
  const calibrationSamples = useRef<number[]>([]);
  const validFrameCount = useRef(0);
  const totalFrameCount = useRef(0);
  const dynamicGreenMin = useRef(SKIN_GREEN_MIN);
  const dynamicGreenMax = useRef(SKIN_GREEN_MAX);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadVideoRef = useRef<HTMLVideoElement>(null);

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [photoResults, setPhotoResults] = useState<PhotoAnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [failReason, setFailReason] = useState<string>("");
  const [failTip, setFailTip] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("live");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [videoProcessingProgress, setVideoProcessingProgress] = useState(0);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: scanHistory = [] } = useQuery({
    queryKey: ["face-scans", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("face_scans")
        .select("*")
        .eq("user_id", user.id)
        .order("scanned_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const saveResults = async (scanResults: ScanResults, sampleCount: number) => {
    if (!user) return;
    const { error } = await supabase.from("face_scans").insert({
      user_id: user.id,
      heart_rate: scanResults.heartRate ?? 0,
      stress_level: scanResults.stressLevel,
      stress_score: scanResults.stressScore,
      confidence: scanResults.confidence,
      sample_count: sampleCount,
    });
    if (error) {
      toast.error("Failed to save scan results");
    } else {
      toast.success("Scan saved to your history");
      queryClient.invalidateQueries({ queryKey: ["face-scans", user.id] });

      if (scanResults.heartRate) {
        supabase.functions.invoke("notify-vital-anomaly", {
          body: {
            user_id: user.id,
            heart_rate: scanResults.heartRate,
            stress_score: scanResults.stressScore,
            source: "Face Scan",
          },
        }).catch(() => {});
      }
    }
  };

  const deleteScan = async (id: string) => {
    const { error } = await supabase.from("face_scans").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete scan");
    } else {
      queryClient.invalidateQueries({ queryKey: ["face-scans", user?.id] });
    }
  };

  const isValidSkinTone = (greenMean: number): boolean => {
    return greenMean >= dynamicGreenMin.current && greenMean <= dynamicGreenMax.current;
  };

  const analyzeSignal = (samples: number[]): { result: ScanResults | null; failCode: string } => {
    if (samples.length < 20) {
      return { result: null, failCode: "insufficient_samples" };
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < MIN_SIGNAL_STDDEV) {
      return { result: null, failCode: "flat_signal" };
    }

    const detrended = samples.map((s) => s - mean);
    const smoothed: number[] = [];
    const windowSize = 5;
    for (let i = 0; i < detrended.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(detrended.length - 1, i + windowSize); j++) {
        sum += detrended[j];
        count++;
      }
      smoothed.push(sum / count);
    }

    const signalPower = smoothed.reduce((a, b) => a + b * b, 0) / smoothed.length;
    const noise = smoothed.map((s, i) => detrended[i] - s);
    const noisePower = noise.reduce((a, b) => a + b * b, 0) / noise.length;
    const snr = noisePower > 0 ? signalPower / noisePower : 0;

    if (snr < MIN_SNR) {
      return { result: null, failCode: "noisy_signal" };
    }

    let crossings = 0;
    for (let i = 1; i < smoothed.length; i++) {
      if (smoothed[i - 1] < 0 && smoothed[i] >= 0) crossings++;
    }

    const durationSec = samples.length / SAMPLE_RATE;
    const heartRate = Math.round((crossings / durationSec) * 60);

    if (heartRate < 45 || heartRate > 180) {
      return { result: null, failCode: "implausible_hr" };
    }

    const { level, score } = getStressFromHR(heartRate);

    const validRatio = totalFrameCount.current > 0
      ? validFrameCount.current / totalFrameCount.current
      : 0;

    let confidence: "Good" | "Fair" | "Poor";
    if (validRatio >= 0.8 && snr >= 3 && samples.length >= MIN_SAMPLES) {
      confidence = "Good";
    } else if (validRatio >= 0.4 && snr >= MIN_SNR) {
      confidence = "Fair";
    } else {
      confidence = "Poor";
    }

    return { result: { heartRate, stressLevel: level, stressScore: score, confidence }, failCode: "" };
  };

  // === PHOTO UPLOAD HANDLER ===
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    setPhase("analyzing");
    setError(null);
    setFailReason("");
    setFailTip("");

    try {
      const base64 = await fileToBase64(file);
      setPhotoPreview(base64);

      const { data, error: fnError } = await supabase.functions.invoke("health-tools", {
        body: { type: "face_analysis", payload: { image: base64 } },
      });

      if (fnError) throw fnError;

      const responseText = data?.response || "";
      let parsed: PhotoAnalysisResults;
      try {
        const jsonStr = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("Could not parse AI response");
      }

      if (!parsed.face_detected) {
        setFailReason("No face detected in the uploaded photo.");
        setFailTip("Upload a clear, well-lit photo showing your face from the front.");
        setPhase("failed");
        return;
      }

      setPhotoResults(parsed);

      // Save to face_scans with null HR (stored as 0 since column is non-nullable)
      const stressLevel = parsed.stress_indicators as "Low" | "Moderate" | "High";
      const scanResult: ScanResults = {
        heartRate: null,
        stressLevel: ["Low", "Moderate", "High"].includes(stressLevel) ? stressLevel : "Moderate",
        stressScore: parsed.stress_score || 50,
        confidence: "Fair",
      };
      await saveResults(scanResult, 0);

      setResults(scanResult);
      setPhase("results");
    } catch (err: any) {
      console.error("Photo analysis error:", err);
      setFailReason("Failed to analyze photo. Please try again.");
      setFailTip("Ensure you have a stable internet connection.");
      setPhase("failed");
    }

    // Reset input so same file can be re-selected
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  // === VIDEO UPLOAD HANDLER ===
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be under 100MB");
      return;
    }

    setPhase("analyzing");
    setError(null);
    setFailReason("");
    setFailTip("");
    setVideoProcessingProgress(0);
    greenSamples.current = [];
    validFrameCount.current = 0;
    totalFrameCount.current = 0;
    dynamicGreenMin.current = SKIN_GREEN_MIN;
    dynamicGreenMax.current = SKIN_GREEN_MAX;

    try {
      const videoUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not load video"));
      });

      const duration = video.duration;
      if (duration > 60) {
        toast.error("Video must be 60 seconds or shorter");
        URL.revokeObjectURL(videoUrl);
        setPhase("idle");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d")!;

      const frameInterval = 1 / SAMPLE_RATE;
      const totalFrames = Math.floor(duration * SAMPLE_RATE);
      const calibrationFrames = CALIBRATION_DURATION * SAMPLE_RATE;
      const calSamples: number[] = [];

      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameInterval;
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        ctx.drawImage(video, 0, 0, 320, 240);
        const imgData = ctx.getImageData(100, 30, 120, 60);
        let greenSum = 0;
        for (let p = 0; p < imgData.data.length; p += 4) {
          greenSum += imgData.data[p + 1];
        }
        const greenAvg = greenSum / (imgData.data.length / 4);

        if (i < calibrationFrames) {
          calSamples.push(greenAvg);
          if (i === calibrationFrames - 1 && calSamples.length > 0) {
            const calMean = calSamples.reduce((a, b) => a + b, 0) / calSamples.length;
            dynamicGreenMin.current = Math.max(SKIN_GREEN_MIN, calMean * 0.6);
            dynamicGreenMax.current = Math.min(SKIN_GREEN_MAX, calMean * 1.4);
          }
        } else {
          totalFrameCount.current++;
          if (isValidSkinTone(greenAvg)) {
            validFrameCount.current++;
            greenSamples.current.push(greenAvg);
          }
        }

        setVideoProcessingProgress(Math.round(((i + 1) / totalFrames) * 100));
      }

      URL.revokeObjectURL(videoUrl);

      const validRatio = totalFrameCount.current > 0
        ? validFrameCount.current / totalFrameCount.current
        : 0;

      if (validRatio < MIN_VALID_FRAME_RATIO) {
        setFailReason("Insufficient face detection in the video.");
        setFailTip("Record a video with your face clearly visible in even lighting.");
        setPhase("failed");
        return;
      }

      const { result: scanResults, failCode } = analyzeSignal(greenSamples.current);

      if (!scanResults) {
        const messages: Record<string, { reason: string; tip: string }> = {
          insufficient_samples: { reason: "Not enough data collected from video.", tip: "Record a full 30-second video with your face clearly visible." },
          flat_signal: { reason: "No pulse signal detected in video.", tip: "Ensure your face is well-lit with natural or warm light." },
          noisy_signal: { reason: "Signal too noisy for reliable reading.", tip: "Keep your head very still while recording." },
          implausible_hr: { reason: "Could not determine a valid heart rate.", tip: "Try recording in a well-lit, stable environment." },
        };
        const msg = messages[failCode] || { reason: "Could not analyze video.", tip: "Try again with a clearer video." };
        setFailReason(msg.reason);
        setFailTip(msg.tip);
        setPhase("failed");
        return;
      }

      if (scanResults.confidence === "Poor") {
        setFailReason("Signal quality too low for reliable results.");
        setFailTip("Record in brighter lighting with your face centered and still.");
        setPhase("failed");
        return;
      }

      setResults(scanResults);
      await saveResults(scanResults, greenSamples.current.length);
      setPhase("results");
    } catch (err: any) {
      console.error("Video processing error:", err);
      setFailReason("Failed to process video. Please try again.");
      setFailTip("Ensure the video format is supported (MP4, WebM, MOV).");
      setPhase("failed");
    }

    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const startScan = async () => {
    setError(null);
    setFailReason("");
    setFailTip("");
    setPhase("starting");
    setPhotoResults(null);
    setPhotoPreview(null);
    greenSamples.current = [];
    calibrationSamples.current = [];
    validFrameCount.current = 0;
    totalFrameCount.current = 0;
    dynamicGreenMin.current = SKIN_GREEN_MIN;
    dynamicGreenMax.current = SKIN_GREEN_MAX;
    setFaceDetected(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPhase("calibrating");
      const startTime = Date.now();

      intervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const pct = Math.min(100, (elapsed / SCAN_DURATION) * 100);
        setProgress(pct);
        setTimeLeft(Math.max(0, SCAN_DURATION - Math.floor(elapsed)));

        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, 320, 240);
            const imgData = ctx.getImageData(100, 30, 120, 60);
            let greenSum = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
              greenSum += imgData.data[i + 1];
            }
            const greenAvg = greenSum / (imgData.data.length / 4);

            const inCalibration = elapsed < CALIBRATION_DURATION;

            if (inCalibration) {
              calibrationSamples.current.push(greenAvg);
              const basicValid = greenAvg >= SKIN_GREEN_MIN && greenAvg <= SKIN_GREEN_MAX;
              setFaceDetected(basicValid);
            } else {
              if (calibrationSamples.current.length > 0 && dynamicGreenMin.current === SKIN_GREEN_MIN) {
                const calMean = calibrationSamples.current.reduce((a, b) => a + b, 0) / calibrationSamples.current.length;
                dynamicGreenMin.current = Math.max(SKIN_GREEN_MIN, calMean * 0.6);
                dynamicGreenMax.current = Math.min(SKIN_GREEN_MAX, calMean * 1.4);
              }

              if (phase !== "scanning") setPhase("scanning");

              totalFrameCount.current++;
              const valid = isValidSkinTone(greenAvg);
              if (valid) {
                validFrameCount.current++;
                greenSamples.current.push(greenAvg);
              }
              setFaceDetected(valid);
            }
          }
        }

        if (elapsed >= SCAN_DURATION) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;

          const validRatio = totalFrameCount.current > 0
            ? validFrameCount.current / totalFrameCount.current
            : 0;

          if (validRatio < MIN_VALID_FRAME_RATIO) {
            stopCamera();
            setFailReason("Insufficient face detection during scan.");
            setFailTip("Position your face within the oval and ensure even lighting on your face.");
            setPhase("failed");
            return;
          }

          setPhase("analyzing");

          setTimeout(() => {
            const { result: scanResults, failCode } = analyzeSignal(greenSamples.current);

            if (!scanResults) {
              stopCamera();
              const messages: Record<string, { reason: string; tip: string }> = {
                insufficient_samples: { reason: "Not enough data collected.", tip: "Hold still and keep your face in frame for the full 30 seconds." },
                flat_signal: { reason: "No pulse signal detected.", tip: "Ensure your face is well-lit with natural or warm light. Avoid fluorescent lighting." },
                noisy_signal: { reason: "Signal too noisy for reliable reading.", tip: "Stay very still. Rest your elbows on a table for stability." },
                implausible_hr: { reason: "Could not determine a valid heart rate.", tip: "Try in a quieter, well-lit environment. Hold the phone about 30cm from your face." },
              };
              const msg = messages[failCode] || { reason: "Scan could not produce reliable results.", tip: "Try again in better conditions." };
              setFailReason(msg.reason);
              setFailTip(msg.tip);
              setPhase("failed");
              return;
            }

            if (scanResults.confidence === "Poor") {
              stopCamera();
              setFailReason("Signal quality too low for reliable results.");
              setFailTip("Try in brighter lighting with your face centered and completely still.");
              setPhase("failed");
              return;
            }

            setResults(scanResults);
            saveResults(scanResults, greenSamples.current.length);
            stopCamera();
            setPhase("results");
          }, 1500);
        }
      }, 1000 / SAMPLE_RATE);
    } catch {
      setPhase("idle");
      setError("Camera access denied. Please allow camera permissions and try again.");
      stopCamera();
    }
  };

  const resetScan = () => {
    stopCamera();
    setPhase("idle");
    setProgress(0);
    setTimeLeft(SCAN_DURATION);
    setResults(null);
    setPhotoResults(null);
    setPhotoPreview(null);
    setError(null);
    setFailReason("");
    setFailTip("");
    setFaceDetected(false);
    setVideoProcessingProgress(0);
  };

  const stressColor = (level: string) =>
    level === "Low" ? "text-success" : level === "Moderate" ? "text-amber-500" : "text-sos";

  const isPhotoMode = inputMode === "photo" && photoResults !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-success" />
          AI Face Scan
        </h2>
        {scanHistory.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" />
            {showHistory ? "Hide" : "History"}
          </Button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg text-xs text-muted-foreground">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
        <span>
          This feature provides <strong>estimates only</strong> and is not a medical device.
          Results should not be used for diagnosis. Consult a doctor for health concerns.
        </span>
      </div>

      {/* Scan History */}
      {showHistory && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Recent Scans</h3>
            {scanHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scans yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {scanHistory.map((scan: any) => (
                  <div key={scan.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                    <div className="flex items-center gap-3">
                      <Heart className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {scan.heart_rate > 0 ? `${scan.heart_rate} BPM` : "Photo scan"}
                      </span>
                      <span className={`text-xs font-medium ${stressColor(scan.stress_level)}`}>
                        {scan.stress_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(scan.scanned_at), "MMM d, h:mm a")}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteScan(scan.id)}>
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden file inputs */}
      <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />

      {/* Camera View (Live Scan) */}
      {(phase === "starting" || phase === "calibrating" || phase === "scanning" || (phase === "analyzing" && inputMode === "live")) && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            <video
              ref={videoRef}
              className="w-full aspect-[4/3] object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
              playsInline
              muted
            />
            <canvas ref={canvasRef} width={320} height={240} className="hidden" />
            <div className="absolute inset-0 flex flex-col items-center justify-between p-4">
              <div className="relative">
                <div className="w-40 h-48 border-2 border-dashed border-success/60 rounded-[50%] mt-4" />
                {(phase === "calibrating" || phase === "scanning") && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                    <span className="text-[10px] font-medium">
                      {phase === "calibrating" ? "Calibrating…" : faceDetected ? "Face detected" : "No face"}
                    </span>
                  </div>
                )}
              </div>
              <div className="w-full space-y-2 bg-background/80 backdrop-blur-sm rounded-lg p-3">
                {phase === "analyzing" ? (
                  <p className="text-sm text-center font-medium animate-pulse">Analyzing your vitals…</p>
                ) : phase === "calibrating" ? (
                  <p className="text-sm text-center font-medium">Calibrating… Hold still</p>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>Scanning… Keep still</span>
                      <span>{timeLeft}s left</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo/Video Analyzing State */}
      {phase === "analyzing" && inputMode !== "live" && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-success mx-auto animate-spin" />
            {inputMode === "photo" && (
              <>
                {photoPreview && (
                  <img src={photoPreview} alt="Uploaded" className="w-32 h-32 object-cover rounded-full mx-auto border-2 border-success/30" />
                )}
                <p className="text-sm font-medium animate-pulse">Analyzing your photo with AI…</p>
                <p className="text-xs text-muted-foreground">Checking for fatigue, stress, and skin wellness indicators</p>
              </>
            )}
            {inputMode === "video" && (
              <>
                <p className="text-sm font-medium">Processing video frames…</p>
                <Progress value={videoProcessingProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">{videoProcessingProgress}% complete</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed State */}
      {phase === "failed" && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 text-center space-y-4">
            <CameraOff className="w-12 h-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Scan Failed</p>
              <p className="text-xs text-muted-foreground">{failReason}</p>
              {failTip && (
                <div className="flex items-start gap-2 p-2.5 bg-accent/50 rounded-lg text-xs text-left">
                  <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>{failTip}</span>
                </div>
              )}
            </div>
            <Button onClick={resetScan} className="w-full" variant="outline">
              <Camera className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {phase === "results" && results && (
        <div className="space-y-3">
          {/* Photo-only banner */}
          {isPhotoMode && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg text-xs">
              <ImageIcon className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <span>
                <strong>Photo analysis</strong> provides wellness indicators only (skin tone, fatigue, stress signs).
                For heart rate estimation, use <strong>Live Scan</strong> or upload a <strong>30-second video</strong>.
              </span>
            </div>
          )}

          <div className={`grid ${isPhotoMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
            {!isPhotoMode && results.heartRate && (
              <Card className="border-primary/20">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <Heart className="w-8 h-8 text-primary" />
                  <span className="text-2xl font-bold">{results.heartRate}</span>
                  <span className="text-xs text-muted-foreground">BPM (est.)</span>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <Brain className={`w-8 h-8 ${stressColor(results.stressLevel)}`} />
                <span className="text-2xl font-bold">{results.stressLevel}</span>
                <span className="text-xs text-muted-foreground">Stress Level</span>
              </CardContent>
            </Card>
          </div>

          {/* Photo Analysis Details */}
          {isPhotoMode && photoResults && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">AI Wellness Analysis</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[11px] text-muted-foreground">Fatigue Level</p>
                    <p className={`text-sm font-semibold ${stressColor(photoResults.fatigue_level)}`}>
                      {photoResults.fatigue_level}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[11px] text-muted-foreground">Stress Indicators</p>
                    <p className={`text-sm font-semibold ${stressColor(photoResults.stress_indicators)}`}>
                      {photoResults.stress_indicators}
                    </p>
                  </div>
                </div>
                {photoResults.skin_observations && (
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[11px] text-muted-foreground">Skin Observations</p>
                    <p className="text-xs mt-0.5">{photoResults.skin_observations}</p>
                  </div>
                )}
                {photoResults.wellness_notes && (
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[11px] text-muted-foreground">Wellness Notes</p>
                    <p className="text-xs mt-0.5">{photoResults.wellness_notes}</p>
                  </div>
                )}
                {photoResults.recommendations && photoResults.recommendations.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-success/10">
                    <p className="text-[11px] text-muted-foreground mb-1">Recommendations</p>
                    {photoResults.recommendations.map((rec, i) => (
                      <p key={i} className="text-xs pl-3 relative before:content-['•'] before:absolute before:left-0">
                        {rec}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stress score for non-photo modes */}
          {!isPhotoMode && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Stress Score</span>
                  <span className="font-medium">{results.stressScore}/100</span>
                </div>
                <Progress value={results.stressScore} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Confidence: {results.confidence}</span>
                  <span>Signal quality: {greenSamples.current.length} samples</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground text-center">
            {results.stressLevel === "Low"
              ? "Your vitals look calm. Keep it up! 🧘"
              : results.stressLevel === "Moderate"
              ? "Moderate stress detected. Try a breathing exercise. 🌬️"
              : "High stress detected. Consider resting and consulting a professional. ❤️"}
          </div>

          <Button onClick={resetScan} className="w-full" variant="outline">
            <Camera className="w-4 h-4 mr-2" /> Scan Again
          </Button>
        </div>
      )}

      {/* Idle State */}
      {phase === "idle" && (
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6 text-center space-y-4">
            <ScanFace className="w-16 h-16 text-success mx-auto" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Choose a scan mode below. Live scan and video upload estimate heart rate.
                Photo upload analyzes wellness indicators.
              </p>
            </div>

            {/* Mode Selection */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={inputMode === "live" ? "default" : "outline"}
                size="sm"
                className={`flex flex-col gap-1 h-auto py-3 ${inputMode === "live" ? "bg-success text-success-foreground hover:bg-success/90" : ""}`}
                onClick={() => setInputMode("live")}
              >
                <Camera className="w-5 h-5" />
                <span className="text-[11px]">Live Scan</span>
              </Button>
              <Button
                variant={inputMode === "photo" ? "default" : "outline"}
                size="sm"
                className={`flex flex-col gap-1 h-auto py-3 ${inputMode === "photo" ? "bg-success text-success-foreground hover:bg-success/90" : ""}`}
                onClick={() => setInputMode("photo")}
              >
                <ImageIcon className="w-5 h-5" />
                <span className="text-[11px]">Photo</span>
              </Button>
              <Button
                variant={inputMode === "video" ? "default" : "outline"}
                size="sm"
                className={`flex flex-col gap-1 h-auto py-3 ${inputMode === "video" ? "bg-success text-success-foreground hover:bg-success/90" : ""}`}
                onClick={() => setInputMode("video")}
              >
                <Video className="w-5 h-5" />
                <span className="text-[11px]">Video</span>
              </Button>
            </div>

            {/* Mode-specific info */}
            {inputMode === "photo" && (
              <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg text-xs text-left">
                <ImageIcon className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <span>
                  Photo analysis will check for <strong>skin tone, fatigue, and stress signals</strong> only.
                  Heart rate cannot be measured from a single photo — use Live Scan or Video for that.
                </span>
              </div>
            )}
            {inputMode === "video" && (
              <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg text-xs text-left">
                <Video className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <span>
                  Upload a <strong>30-second video</strong> of your face (max 60s). The same PPG analysis as live scan
                  will be used to estimate heart rate and stress levels.
                </span>
              </div>
            )}

            {/* Tips (for live and video modes) */}
            {inputMode !== "photo" && (
              <div className="text-left space-y-1.5 p-3 bg-accent/30 rounded-lg">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Tips for best results
                </p>
                {SCAN_TIPS.map((tip, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground pl-5">• {tip}</p>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <CameraOff className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Action button per mode */}
            {inputMode === "live" && (
              <Button onClick={startScan} className="w-full bg-success text-success-foreground hover:bg-success/90">
                <Camera className="w-4 h-4 mr-2" /> Start Face Scan
              </Button>
            )}
            {inputMode === "photo" && (
              <Button onClick={() => photoInputRef.current?.click()} className="w-full bg-success text-success-foreground hover:bg-success/90">
                <Upload className="w-4 h-4 mr-2" /> Upload or Take Photo
              </Button>
            )}
            {inputMode === "video" && (
              <Button onClick={() => videoInputRef.current?.click()} className="w-full bg-success text-success-foreground hover:bg-success/90">
                <Upload className="w-4 h-4 mr-2" /> Upload Video
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FaceScan;
