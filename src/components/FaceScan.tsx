import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScanFace, Camera, CameraOff, Heart, Brain, AlertTriangle } from "lucide-react";

const SCAN_DURATION = 30; // seconds
const SAMPLE_RATE = 15; // frames per second for analysis
const MIN_SAMPLES = SCAN_DURATION * SAMPLE_RATE * 0.6; // need at least 60% of expected samples

type ScanPhase = "idle" | "starting" | "scanning" | "analyzing" | "results";

interface ScanResults {
  heartRate: number;
  stressLevel: "Low" | "Moderate" | "High";
  stressScore: number;
  confidence: string;
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

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SCAN_DURATION);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const analyzeSignal = (samples: number[]): ScanResults => {
    // Simple rPPG: find dominant frequency in green channel signal
    // Remove DC component (detrend)
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const detrended = samples.map((s) => s - mean);

    // Apply simple moving average smoothing
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

    // Count zero crossings (positive direction) as a proxy for peaks
    let crossings = 0;
    for (let i = 1; i < smoothed.length; i++) {
      if (smoothed[i - 1] < 0 && smoothed[i] >= 0) {
        crossings++;
      }
    }

    const durationSec = samples.length / SAMPLE_RATE;
    let heartRate = Math.round((crossings / durationSec) * 60);

    // Clamp to physiological range
    heartRate = Math.max(50, Math.min(140, heartRate));

    const { level, score } = getStressFromHR(heartRate);
    const confidence = samples.length >= MIN_SAMPLES ? "Good" : "Fair";

    return { heartRate, stressLevel: level, stressScore: score, confidence };
  };

  const startScan = async () => {
    setError(null);
    setPhase("starting");
    greenSamples.current = [];

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

        // Sample green channel from forehead region
        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, 320, 240);
            // Sample center-top region (forehead area)
            const imgData = ctx.getImageData(100, 30, 120, 60);
            let greenSum = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
              greenSum += imgData.data[i + 1]; // green channel
            }
            const greenAvg = greenSum / (imgData.data.length / 4);
            greenSamples.current.push(greenAvg);
          }
        }

        if (elapsed >= SCAN_DURATION) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setPhase("analyzing");

          // Brief pause for UX then show results
          setTimeout(() => {
            const scanResults = analyzeSignal(greenSamples.current);
            setResults(scanResults);
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
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ScanFace className="w-5 h-5 text-success" />
        AI Face Scan
      </h2>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg text-xs text-muted-foreground">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
        <span>
          This feature provides <strong>estimates only</strong> and is not a medical device.
          Results should not be used for diagnosis. Consult a doctor for health concerns.
        </span>
      </div>

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

            {/* Scan overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-between p-4">
              {/* Face guide */}
              <div className="w-40 h-48 border-2 border-dashed border-success/60 rounded-[50%] mt-4" />

              <div className="w-full space-y-2 bg-background/80 backdrop-blur-sm rounded-lg p-3">
                {phase === "analyzing" ? (
                  <p className="text-sm text-center font-medium animate-pulse">
                    Analyzing your vitals…
                  </p>
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
            <Card className={`border-${results.stressLevel === "Low" ? "success" : results.stressLevel === "Moderate" ? "amber" : "sos"}/20`}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <Brain className="w-8 h-8 text-success" />
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
