import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecognition, isSpeechRecognitionSupported } from "@/hooks/useVoiceRecognition";
import { ensureAudioReady } from "@/lib/audioAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Phase = "idle" | "listening" | "thinking" | "ready" | "speaking";

const SAMPLES = [
  "What medications need refilling today?",
  "How's my nutrition looking?",
  "Is my calorie goal on track?",
  "Did I take my medications today?",
];

const getPreferredVoice = () => {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const locale = (navigator.language || "en-US").toLowerCase();
  const baseLocale = locale.split("-")[0];
  return (
    voices.find((v) => v.lang?.toLowerCase() === locale) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(baseLocale)) ??
    voices[0]
  );
};

const speakText = (text: string, onEnd?: () => void) => {
  if (!("speechSynthesis" in window) || !text) {
    onEnd?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.lang = navigator.language || "en-US";
    const v = getPreferredVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    onEnd?.();
    return false;
  }
};

const VoiceQueryButton = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const [autoSpoke, setAutoSpoke] = useState(false);

  // Pre-load voices on mount so they're ready when needed
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
  }, []);

  const stopAll = useCallback(() => {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }, []);

  const handleSpeakTap = useCallback(() => {
    if (phase === "speaking") {
      stopAll();
      setPhase("ready");
      return;
    }
    if (!answer) return;
    setPhase("speaking");
    const ok = speakText(answer, () => setPhase("ready"));
    if (!ok) setPhase("ready");
  }, [phase, answer, stopAll]);

  const sendQuery = useCallback(async (text: string) => {
    setTranscript(text);
    setAnswer("");
    setAutoSpoke(false);
    setPhase("thinking");

    try {
      const { data, error } = await supabase.functions.invoke("voice-query", { body: { query: text } });
      console.log("[voice-query] response:", { data, error });

      let serverMsg: string | undefined;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const b = await ctx.json();
            serverMsg = b?.error || b?.detail;
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error; } catch { serverMsg = txt?.slice(0, 200); }
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg || error.message || "Voice assistant is temporarily unavailable.");
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      const reply = (data as any)?.answer ?? "Sorry, I couldn't find an answer.";
      setAnswer(reply);
      setPhase("ready");

      // Best-effort auto-speak: works on desktop & some mobile, silently no-op otherwise
      const started = speakText(reply, () => setPhase("ready"));
      if (started) {
        setAutoSpoke(true);
        setPhase("speaking");
      }
    } catch (e: any) {
      console.error("[voice-query] failed:", e);
      const msg = e?.message || "Voice assistant is temporarily unavailable.";
      setAnswer(msg);
      toast.error(msg);
      setPhase("idle");
    }
  }, []);

  const { listening, interim, error, start, stop, supported } = useVoiceRecognition({
    onFinal: (t) => sendQuery(t),
  });

  useEffect(() => {
    if (listening) setPhase("listening");
  }, [listening]);

  useEffect(() => {
    if (error) {
      toast.error(error === "not-allowed" ? "Microphone permission denied." : `Voice error: ${error}`);
      setPhase("idle");
    }
  }, [error]);

  const handleTap = async () => {
    setOpen(true);
    if (phase === "listening") {
      stop();
      return;
    }
    if (phase === "speaking") {
      stopAll();
      setPhase("ready");
      return;
    }
    if (phase === "thinking") return;
    if (!supported) {
      toast.error("Voice recognition isn't supported on this browser.");
      return;
    }
    setTranscript("");
    setAnswer("");
    setAutoSpoke(false);
    await ensureAudioReady();
    // Prime speechSynthesis inside the gesture so later speak() calls are more likely to play
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
        const primer = new SpeechSynthesisUtterance("");
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
      } catch { /* ignore */ }
    }
    start();
  };

  const handleClose = () => {
    stop();
    stopAll();
    setOpen(false);
    setPhase("idle");
    setTranscript("");
    setAnswer("");
    setAutoSpoke(false);
  };

  if (!isSpeechRecognitionSupported()) return null;

  const Icon = phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : Mic;

  return (
    <>
      <button
        onClick={handleTap}
        aria-label="Voice assistant — Hey Check-iN"
        className={`fixed bottom-40 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform ${
          phase === "listening"
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : phase === "thinking"
            ? "bg-accent text-accent-foreground"
            : phase === "speaking"
            ? "bg-success text-success-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <Icon className={`w-6 h-6 ${phase === "thinking" ? "animate-spin" : ""}`} />
      </button>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 pb-24 pointer-events-none">
          <Card className="max-w-md mx-auto shadow-xl pointer-events-auto">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {phase === "listening" ? "Listening…" : phase === "thinking" ? "Thinking…" : phase === "speaking" ? "Speaking" : phase === "ready" ? "Answer" : "Hey Check-iN"}
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {transcript || interim ? (
                <p className="text-sm text-muted-foreground italic">"{transcript || interim}"</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  {SAMPLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuery(s)}
                      className="block w-full text-left text-xs px-2 py-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {answer && (
                <>
                  <div className="text-sm bg-primary/5 rounded-lg p-3 border border-primary/10">
                    {answer}
                  </div>
                  <Button
                    onClick={handleSpeakTap}
                    variant={phase === "speaking" ? "secondary" : "default"}
                    size="sm"
                    className="w-full gap-2"
                  >
                    {phase === "speaking" ? (
                      <><VolumeX className="w-4 h-4" /> Stop</>
                    ) : (
                      <><Volume2 className="w-4 h-4" /> {autoSpoke ? "Hear again" : "Tap to hear"}</>
                    )}
                  </Button>
                </>
              )}

              {phase === "idle" && !answer && (
                <p className="text-[10px] text-center text-muted-foreground">
                  Tap mic to ask • Tap again to cancel
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default VoiceQueryButton;
