import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2, VolumeX, X, Plus, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecognition, isSpeechRecognitionSupported } from "@/hooks/useVoiceRecognition";
import { ensureAudioReady } from "@/lib/audioAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUserSettings, DEFAULT_VOICE_QUERY_PROMPTS } from "@/hooks/useUserSettings";

type Phase = "idle" | "listening" | "thinking" | "ready" | "speaking";

const MAX_PROMPTS = 8;
const MAX_PROMPT_LEN = 70;

// Browser TTS fallback (only used if server-side TTS audio is missing)
const speakTextFallback = (text: string, onEnd?: () => void) => {
  if (!("speechSynthesis" in window) || !text) {
    onEnd?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.lang = navigator.language || "en-US";
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
  const { settings, updateSetting } = useUserSettings();
  const prompts = settings.voiceQueryPrompts?.length
    ? settings.voiceQueryPrompts
    : DEFAULT_VOICE_QUERY_PROMPTS;

  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const [autoSpoke, setAutoSpoke] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch { /* ignore */ }
    }
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }, []);

  const playAudio = useCallback((dataUrl: string, onEnd?: () => void): boolean => {
    try {
      stopAudio();
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => onEnd?.();
      audio.onerror = () => onEnd?.();
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          console.warn("[voice-query] audio play blocked:", err);
          onEnd?.();
        });
      }
      return true;
    } catch (e) {
      console.error("[voice-query] playAudio error:", e);
      onEnd?.();
      return false;
    }
  }, [stopAudio]);

  const handleSpeakTap = useCallback(() => {
    if (phase === "speaking") {
      stopAudio();
      setPhase("ready");
      return;
    }
    if (!answer) return;
    setPhase("speaking");
    if (lastAudioRef.current) {
      playAudio(lastAudioRef.current, () => setPhase("ready"));
    } else {
      const ok = speakTextFallback(answer, () => setPhase("ready"));
      if (!ok) setPhase("ready");
    }
  }, [phase, answer, stopAudio, playAudio]);

  const sendQueryInternal = useCallback(async (text: string, attempt = 0): Promise<void> => {
    setTranscript(text);
    setAnswer("");
    setAutoSpoke(false);
    lastAudioRef.current = null;
    setPhase("thinking");

    if (offline || !navigator.onLine) {
      setOffline(true);
      const msg = "You're offline. Please reconnect and try again.";
      setAnswer(msg);
      toast.error(msg);
      setPhase("idle");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { data, error } = await supabase.functions.invoke("voice-query", { body: { query: text } });
      if (ctrl.signal.aborted) return;
      console.log("[voice-query] response:", { hasData: !!data, hasAudio: !!(data as any)?.audio, error });

      let serverMsg: string | undefined;
      let status: number | undefined;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          status = ctx?.status;
          if (ctx && typeof ctx.json === "function") {
            const b = await ctx.json();
            serverMsg = b?.error || b?.detail;
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error; } catch { serverMsg = txt?.slice(0, 200); }
          }
        } catch { /* ignore */ }

        // Auto-retry once on transient errors
        if (attempt === 0 && (status === 502 || status === 503 || status === 504 || !status)) {
          console.log("[voice-query] retrying after transient error");
          await new Promise((r) => setTimeout(r, 800));
          return sendQueryInternal(text, 1);
        }
        // Friendly retry on 429
        if (status === 429 && attempt === 0) {
          toast.info("Give me a sec…");
          await new Promise((r) => setTimeout(r, 3000));
          return sendQueryInternal(text, 1);
        }
        throw new Error(serverMsg || error.message || "Voice assistant is temporarily unavailable.");
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      const reply = (data as any)?.answer ?? "Sorry, I couldn't find an answer.";
      const audio = (data as any)?.audio as string | null | undefined;
      setAnswer(reply);
      lastAudioRef.current = audio || null;
      setPhase("ready");

      // Auto-play (works because audio context was unlocked on the mic tap)
      if (audio) {
        setPhase("speaking");
        setAutoSpoke(true);
        playAudio(audio, () => setPhase("ready"));
      } else {
        const started = speakTextFallback(reply, () => setPhase("ready"));
        if (started) {
          setAutoSpoke(true);
          setPhase("speaking");
        }
      }
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      console.error("[voice-query] failed:", e);
      const msg = e?.message || "Voice assistant is temporarily unavailable.";
      setAnswer(msg);
      toast.error(msg);
      setPhase("idle");
    }
  }, [offline, playAudio]);

  const sendQuery = useCallback((text: string) => sendQueryInternal(text, 0), [sendQueryInternal]);

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
      stopAudio();
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
    // Unlock HTMLAudioElement playback by playing a brief silent buffer inside the gesture
    try {
      const silent = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA"
      );
      silent.volume = 0;
      silent.play().catch(() => { /* ignore */ });
    } catch { /* ignore */ }
    if ("vibrate" in navigator) try { navigator.vibrate(40); } catch { /* ignore */ }
    start();
  };

  const handleClose = () => {
    abortRef.current?.abort();
    stop();
    stopAudio();
    setOpen(false);
    setPhase("idle");
    setTranscript("");
    setAnswer("");
    setAutoSpoke(false);
    setShowAdd(false);
    setNewPrompt("");
  };

  const handleAddPrompt = () => {
    const t = newPrompt.trim();
    if (!t) return;
    if (prompts.length >= MAX_PROMPTS) {
      toast.info(`Up to ${MAX_PROMPTS} prompts. Delete one first.`);
      return;
    }
    if (prompts.includes(t)) {
      toast.info("Already in your list.");
      return;
    }
    updateSetting("voiceQueryPrompts", [...prompts, t.slice(0, MAX_PROMPT_LEN)]);
    setNewPrompt("");
    setShowAdd(false);
  };

  const handleDeletePrompt = (p: string) => {
    updateSetting("voiceQueryPrompts", prompts.filter((x) => x !== p));
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
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {phase === "listening" ? "Listening…" : phase === "thinking" ? "Thinking…" : phase === "speaking" ? "Speaking" : phase === "ready" ? "Answer" : "Hey Check-iN"}
                  {offline && <span className="inline-flex items-center gap-1 text-[10px] text-destructive"><WifiOff className="w-3 h-3" />Offline</span>}
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Listening visualizer + interim transcript */}
              {phase === "listening" && (
                <div className="flex items-end justify-center gap-1 h-8" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 bg-destructive rounded-full animate-pulse"
                      style={{ height: `${30 + (i % 3) * 20}%`, animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              )}

              {transcript || interim ? (
                <p className="text-sm text-foreground italic">"{transcript || interim}"</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  {prompts.map((s) => (
                    <div key={s} className="flex items-center gap-1 group">
                      <button
                        onClick={() => sendQuery(s)}
                        className="flex-1 text-left text-xs px-2 py-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                      >
                        {s}
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(s)}
                        aria-label={`Remove "${s}"`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {showAdd ? (
                    <div className="flex items-center gap-1 pt-1">
                      <Input
                        autoFocus
                        value={newPrompt}
                        maxLength={MAX_PROMPT_LEN}
                        onChange={(e) => setNewPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddPrompt();
                          if (e.key === "Escape") { setShowAdd(false); setNewPrompt(""); }
                        }}
                        placeholder="Type a question…"
                        className="h-7 text-xs"
                      />
                      <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={handleAddPrompt}>Add</Button>
                    </div>
                  ) : (
                    prompts.length < MAX_PROMPTS && (
                      <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline pt-1"
                      >
                        <Plus className="w-3 h-3" /> Add question
                      </button>
                    )
                  )}
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
