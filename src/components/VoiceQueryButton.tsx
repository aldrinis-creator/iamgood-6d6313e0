import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecognition, isSpeechRecognitionSupported } from "@/hooks/useVoiceRecognition";
import { speak, stopSpeaking, ensureAudioReady } from "@/lib/audioAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Phase = "idle" | "listening" | "thinking" | "speaking";

const SAMPLES = [
  "What medications need refilling today?",
  "How's my nutrition looking?",
  "Is my calorie goal on track?",
  "Did I take my medications today?",
];

const waitForVoices = async () => {
  if (!("speechSynthesis" in window)) return;

  if (window.speechSynthesis.getVoices().length > 0) return;

  await new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;

    const handleVoicesChanged = () => {
      cleanup();
      resolve();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 1200);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
    };

    synth.addEventListener?.("voiceschanged", handleVoicesChanged, { once: true });
  });
};

const getPreferredVoice = () => {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const locale = (navigator.language || "en-US").toLowerCase();
  const baseLocale = locale.split("-")[0];

  return (
    voices.find((voice) => voice.lang?.toLowerCase() === locale) ??
    voices.find((voice) => voice.lang?.toLowerCase().startsWith(baseLocale)) ??
    voices[0]
  );
};

const VoiceQueryButton = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const preparedUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const prepareUtterance = useCallback(() => {
    if (!("speechSynthesis" in window)) return null;

    const utterance = new SpeechSynthesisUtterance("");
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = navigator.language || "en-US";

    preparedUtteranceRef.current = utterance;

    try {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }

    return utterance;
  }, []);

  const sendQuery = useCallback(async (text: string) => {
    setTranscript(text);
    setAnswer("");
    setPhase("thinking");

    const utterance = preparedUtteranceRef.current ?? prepareUtterance();
    preparedUtteranceRef.current = null;

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
      setPhase("speaking");

      await ensureAudioReady();

      if (utterance && "speechSynthesis" in window) {
        await waitForVoices();

        const preferredVoice = getPreferredVoice();
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.lang = preferredVoice.lang;
        }

        const started = await new Promise<boolean>((resolve) => {
          let hasStarted = false;
          let settled = false;
          let startTimeout = 0;
          let finishTimeout = 0;

          const finish = (value: boolean) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(startTimeout);
            window.clearTimeout(finishTimeout);
            resolve(value);
          };

          try {
            window.speechSynthesis.cancel();
            window.speechSynthesis.resume();
            utterance.text = reply;
            utterance.onstart = () => {
              hasStarted = true;
            };
            utterance.onend = () => finish(hasStarted);
            utterance.onerror = () => finish(false);
            window.speechSynthesis.speak(utterance);

            startTimeout = window.setTimeout(() => finish(false), 1500);
            finishTimeout = window.setTimeout(() => finish(hasStarted), Math.max(4000, reply.length * 90));
          } catch {
            finish(false);
          }
        });

        if (!started) {
          await speak(reply);
        }
      } else {
        await speak(reply);
      }
    } catch (e: any) {
      console.error("[voice-query] failed:", e);
      const msg = e?.message || "Voice assistant is temporarily unavailable.";
      setAnswer(msg);
      toast.error(msg);
    } finally {
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
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.getVoices();
  }, []);

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
      stopSpeaking();
      setPhase("idle");
      return;
    }
    if (phase === "thinking") return;
    if (!supported) {
      toast.error("Voice recognition isn't supported on this browser.");
      return;
    }
    setTranscript("");
    setAnswer("");
    prepareUtterance();
    await ensureAudioReady();
    start();
  };

  const handleClose = () => {
    stop();
    stopSpeaking();
    setOpen(false);
    setPhase("idle");
    setTranscript("");
    setAnswer("");
    preparedUtteranceRef.current = null;
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
                  {phase === "listening" ? "Listening…" : phase === "thinking" ? "Thinking…" : phase === "speaking" ? "Speaking" : "Hey Check-iN"}
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
                <div className="text-sm bg-primary/5 rounded-lg p-3 border border-primary/10">
                  {answer}
                </div>
              )}

              {phase === "idle" && (
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
