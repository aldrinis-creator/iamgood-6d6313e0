import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScanFace, Camera, CameraOff, Heart, Brain, AlertTriangle, History, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const SCAN_DURATION = 30;
const SAMPLE_RATE = 15;
const MIN_SAMPLES = SCAN_DURATION * SAMPLE_RATE * 0.6;

// Validation thresholds
const SKIN_GREEN_MIN = 60;
const SKIN_GREEN_MAX = 210;
const MIN_VALID_FRAME_RATIO = 0.6;
const MIN_SIGNAL_STDDEV = 0.3;
const MIN_SNR = 1.5;

type ScanPhase = "idle" | "starting" | "scanning" | "analyzing" | "results" | "failed";

interface ScanResults {
  heartRate: number;
  stressLevel: "Low" | "Moderate" | "High";
  stressScore: number;
  confidence: "Good" | "Fair" | "Poor";
}

const getStressFromHR = (hr: number): { level: "Low" | "Moderate" | "High"; score: number } => {
  if (hr < 70) return { level: "Low", score: 25 };
  if (hr < 85) return { level: "Low", score: 40 };
  if (hr < 100) return { level: "Moderate", score: 60 };
  return { level: "High", score: 85 };
};

const FaceScan = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const greenSamples = useRef<number[]>([]);
  const validFrameCount = useRef(0);
  const totalFrameCount = useRef(0);

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [failReason, setFailReason] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

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
      heart_rate: scanResults.heartRate,
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

      supabase.functions.invoke("notify-vital-anomaly", {
        body: {
          user_id: user.id,
          heart_rate: scanResults.heartRate,
          stress_score: scanResults.stressScore,
          source: "Face Scan",
        },
      }).catch(() => {});
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
    return greenMean >= SKIN_GREEN_MIN && greenMean <= SKIN_GREEN_MAX;
  };

  const analyzeSignal = (samples: number[]): ScanResults | null => {
    // 1. Check signal variance — flat signal means no face / blank screen
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < MIN_SIGNAL_STDDEV) {
      return null; // flat signal
    }

    // 2. Detrend and smooth
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

    // 3. SNR check
    const signalPower = smoothed.reduce((a, b) => a + b * b, 0) / smoothed.length;
    const noise = smoothed.map((s, i) => detrended[i] - s);
    const noisePower = noise.reduce((a, b) => a + b * b, 0) / noise.length;
    const snr = noisePower > 0 ? signalPower / noisePower : 0;

    if (snr < MIN_SNR) {
      return null; // too noisy
    }

    // 4. Count zero-crossings for HR
    let crossings = 0;
    for (let i = 1; i < smoothed.length; i++) {
      if (smoothed[i - 1] < 0 && smoothed[i] >= 0) crossings++;
    }

    const durationSec = samples.length / SAMPLE_RATE;
    const heartRate = Math.round((crossings / durationSec) * 60);

    // Reject implausible HR (no clamping — reject instead)
    if (heartRate < 45 || heartRate > 180) {
      return null;
    }

    const { level, score } = getStressFromHR(heartRate);

    // 5. Confidence from valid frame ratio + signal quality
    const validRatio = totalFrameCount.current > 0
      ? validFrameCount.current / totalFrameCount.current
      : 0;

    let confidence: "Good" | "Fair" | "Poor";
    if (validRatio >= 0.8 && snr >= 3 && samples.length >= MIN_SAMPLES) {
      confidence = "Good";
    } else if (validRatio >= 0.6 && snr >= MIN_SNR) {
      confidence = "Fair";
    } else {
      confidence = "Poor";
    }

    return { heartRate, stressLevel: level, stressScore: score, confidence };
  };

  const startScan = async () => {
    setError(null);
    setFailReason("");
    setPhase("starting");
    greenSamples.current = [];
    validFrameCount.current = 0;
    totalFrameCount.current = 0;
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

      setPhase("scanning");
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

            totalFrameCount.current++;
            const valid = isValidSkinTone(greenAvg);
            if (valid) {
              validFrameCount.current++;
              greenSamples.current.push(greenAvg);
            }
            setFaceDetected(valid);
          }
        }

        if (elapsed >= SCAN_DURATION) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;

          // Check valid frame ratio before analyzing
          const validRatio = totalFrameCount.current > 0
            ? validFrameCount.current / totalFrameCount.current
            : 0;

          if (validRatio < MIN_VALID_FRAME_RATIO) {
            stopCamera();
            setFailReason("No face detected. Please position your face within the oval and ensure good lighting.");
            setPhase("failed");
            return;
          }

          setPhase("analyzing");

          setTimeout(() => {
            const scanResults = analyzeSignal(greenSamples.current);

            if (!scanResults) {
              stopCamera();
              setFailReason("Could not detect a valid pulse signal. Please hold still, ensure good lighting, and try again.");
              setPhase("failed");
              return;
            }

            if (scanResults.confidence === "Poor") {
              stopCamera();
              setFailReason("Signal quality too low for reliable results. Try in better lighting and hold very still.");
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
    setError(null);
    setFailReason("");
    setFaceDetected(false);
  };

  const stressColor = (level: string) =>
    level === "Low" ? "text-success" : level === "Moderate" ? "text-amber-500" : "text-sos";

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
                      <span className="font-medium">{scan.heart_rate} BPM</span>
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

      {/* Camera View */}
      {(phase === "starting" || phase === "scanning" || phase === "analyzing") && (
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
                {/* Face detection indicator */}
                {phase === "scanning" && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${faceDetected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                    <span className="text-[10px] font-medium">
                      {faceDetected ? "Face detected" : "No face"}
                    </span>
                  </div>
                )}
              </div>
              <div className="w-full space-y-2 bg-background/80 backdrop-blur-sm rounded-lg p-3">
                {phase === "analyzing" ? (
                  <p className="text-sm text-center font-medium animate-pulse">Analyzing your vitals…</p>
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

      {/* Failed State */}
      {phase === "failed" && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 text-center space-y-4">
            <CameraOff className="w-12 h-12 text-destructive mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Scan Failed</p>
              <p className="text-xs text-muted-foreground">{failReason}</p>
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
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-primary/20">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <Heart className="w-8 h-8 text-primary" />
                <span className="text-2xl font-bold">{results.heartRate}</span>
                <span className="text-xs text-muted-foreground">BPM (est.)</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <Brain className={`w-8 h-8 ${stressColor(results.stressLevel)}`} />
                <span className="text-2xl font-bold">{results.stressLevel}</span>
                <span className="text-xs text-muted-foreground">Stress Level</span>
              </CardContent>
            </Card>
          </div>

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
                Position your face in the camera for {SCAN_DURATION} seconds.
                The scan analyzes subtle skin color changes to estimate your heart rate.
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <CameraOff className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            <Button onClick={startScan} className="w-full bg-success text-success-foreground hover:bg-success/90">
              <Camera className="w-4 h-4 mr-2" /> Start Face Scan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FaceScan;
