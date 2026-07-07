import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2, X, Heart, Stethoscope, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecognition, isSpeechRecognitionSupported } from "@/hooks/useVoiceRecognition";
import { useMediaRecorderStt } from "@/hooks/useMediaRecorderStt";
import { ensureAudioReady } from "@/lib/audioAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Phase = "idle" | "listening" | "thinking" | "speaking";
type SttMode = "browser" | "sarvam";
const FALLBACK_ERRORS = new Set(["service-not-allowed", "not-allowed", "network", "audio-capture"]);
type Mode = "health" | "companion";
type Persona = "user" | "guardian";
interface Msg { role: "user" | "assistant"; content: string }

interface VoiceAgentButtonProps {
  persona?: Persona;
  wardUserId?: string | null;
  wardName?: string | null;
}

const speakFallback = (text: string, onEnd?: () => void) => {
  if (!("speechSynthesis" in window) || !text) { onEnd?.(); return; }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.lang = navigator.language || "en-US";
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    window.speechSynthesis.speak(u);
  } catch { onEnd?.(); }
};

const VoiceAgentButton = ({ persona = "user", wardUserId = null, wardName = null }: VoiceAgentButtonProps) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<Mode>("health");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [interimText, setInterimText] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interimText, phase]);

  const stopAudio = useCallback(() => {
    try { audioRef.current?.pause(); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
  }, []);

  const playAudio = useCallback((dataUrl: string, onEnd?: () => void) => {
    try {
      stopAudio();
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => onEnd?.();
      audio.onerror = () => onEnd?.();
      audio.play().catch(() => onEnd?.());
    } catch { onEnd?.(); }
  }, [stopAudio]);

  const sendTurn = useCallback(async (userText: string, history: Msg[]) => {
    const newHistory: Msg[] = [...history, { role: "user", content: userText }];
    setMessages(newHistory);
    setInterimText("");
    setPhase("thinking");

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { data, error } = await supabase.functions.invoke("voice-agent", {
        body: { messages: newHistory, mode, persona, wardUserId },
      });
      if (ctrl.signal.aborted) return;

      if (error) {
        let msg = error.message || "Voice assistant unavailable.";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); msg = b?.error || msg; }
        } catch {}
        toast.error(msg);
        setMessages([...newHistory, { role: "assistant", content: msg }]);
        setPhase("idle");
        return;
      }
      if ((data as any)?.error) {
        toast.error((data as any).error);
        setPhase("idle");
        return;
      }

      const reply = (data as any)?.answer ?? "Sorry, I couldn't find an answer.";
      const audio = (data as any)?.audio as string | null;
      setMessages([...newHistory, { role: "assistant", content: reply }]);

      if (audio) {
        setPhase("speaking");
        playAudio(audio, () => setPhase("idle"));
      } else {
        setPhase("speaking");
        speakFallback(reply, () => setPhase("idle"));
      }
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      toast.error(e?.message || "Voice assistant failed.");
      setPhase("idle");
    }
  }, [mode, persona, wardUserId, playAudio]);

  const [sttMode, setSttMode] = useState<SttMode>(() =>
    isSpeechRecognitionSupported() ? "browser" : "sarvam",
  );
  const fallbackNoticeShownRef = useRef(false);
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const { listening, interim, error, start, stop, supported } = useVoiceRecognition({
    onFinal: (t) => sendTurn(t, messagesRef.current),
  });

  const sarvam = useMediaRecorderStt({
    language: "unknown",
    onFinal: (t) => sendTurn(t, messagesRef.current),
    onError: (msg) => {
      toast.error(msg);
      setPhase("idle");
    },
  });

  useEffect(() => { setInterimText(interim); }, [interim]);
  useEffect(() => { if (listening) setPhase("listening"); }, [listening]);
  useEffect(() => { if (sarvam.recording) setPhase("listening"); }, [sarvam.recording]);
  useEffect(() => { if (sarvam.uploading) setPhase("thinking"); }, [sarvam.uploading]);

  useEffect(() => {
    if (!error) return;
    if (FALLBACK_ERRORS.has(error) && sarvam.supported) {
      if (!fallbackNoticeShownRef.current) {
        fallbackNoticeShownRef.current = true;
        toast.message("Switching to cloud voice…");
      }
      setSttMode("sarvam");
      // Auto-retry once with Sarvam so the tap isn't wasted.
      void sarvam.start();
      return;
    }
    toast.error(error === "not-allowed" ? "Microphone permission denied." : `Voice error: ${error}`);
    setPhase("idle");
  }, [error, sarvam]);

  const handleMicTap = async () => {
    if (phase === "listening") {
      if (sttMode === "sarvam") sarvam.stop(); else stop();
      return;
    }
    if (phase === "speaking") { stopAudio(); setPhase("idle"); return; }
    if (phase === "thinking") return;

    await ensureAudioReady();
    try {
      const silent = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA");
      silent.volume = 0; silent.play().catch(() => {});
    } catch { /* ignore */ }
    if ("vibrate" in navigator) try { navigator.vibrate(40); } catch { /* ignore */ }

    if (sttMode === "sarvam" || !supported) {
      if (!sarvam.supported) { toast.error("Voice not supported on this browser."); return; }
      setSttMode("sarvam");
      void sarvam.start();
    } else {
      start();
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    await ensureAudioReady();
    // Auto-speak greeting and auto-start listening so the first reply is fully voice-driven.
    if (messages.length === 0) {
      setPhase("speaking");
      speakFallback(greeting, () => {
        setPhase("idle");
        if (supported) {
          try { start(); } catch {}
        }
      });
    } else if (supported) {
      try { start(); } catch {}
    }
  };


  const handleClose = () => {
    abortRef.current?.abort();
    stop();
    stopAudio();
    setOpen(false);
    setPhase("idle");
    setInterimText("");
  };

  const handleClear = () => {
    setMessages([]);
    setInterimText("");
    stopAudio();
    setPhase("idle");
  };

  if (!isSpeechRecognitionSupported()) return null;

  const Icon = phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : Mic;
  const greeting = persona === "guardian"
    ? `Hi! Ask me about ${wardName || "your ward"} — meds, check-ins, appointments — or chat for a moment.`
    : `Hi! Ask me about your health today, or just chat for a moment.`;

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Voice assistant"
        className="fixed bottom-40 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform bg-white text-[#08111F]"
      >
        <Mic className="w-6 h-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={handleClose}>
          <Card className="w-full max-w-md shadow-2xl pointer-events-auto max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 flex flex-col gap-3 min-h-0 flex-1">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Hey Check-iN</h3>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear}>New</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Mode pills */}
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setMode("health")}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded transition-colors ${
                    mode === "health" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground"
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5" /> Ask
                </button>
                <button
                  onClick={() => setMode("companion")}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded transition-colors ${
                    mode === "companion" ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground"
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" /> Chat
                </button>
              </div>

              {/* Transcript */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[50vh] bg-muted/30 rounded-lg p-3">
                {messages.length === 0 && !interimText && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-6">
                    <MessageCircle className="w-8 h-8 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground">{greeting}</p>
                    <p className="text-[10px] text-muted-foreground/70">Tap the mic below to speak.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background border border-border rounded-bl-sm"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {interimText && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-sm bg-primary/40 text-primary-foreground italic">
                      {interimText}…
                    </div>
                  </div>
                )}
                {phase === "thinking" && (
                  <div className="flex justify-start">
                    <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
              </div>

              {/* Mic */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={handleMicTap}
                  aria-label={phase === "listening" ? "Stop listening" : "Start listening"}
                  className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all ${
                    phase === "listening"
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : phase === "thinking"
                      ? "bg-accent text-accent-foreground"
                      : phase === "speaking"
                      ? "bg-success text-success-foreground"
                      : "bg-white text-[#08111F]"
                  }`}
                >
                  <Icon className={`w-7 h-7 ${phase === "thinking" ? "animate-spin" : ""}`} />
                </button>
                <p className="text-[10px] text-muted-foreground">
                  {phase === "listening" ? "Listening… tap to stop"
                    : phase === "thinking" ? "Thinking…"
                    : phase === "speaking" ? "Speaking… tap to stop"
                    : "Tap mic to speak"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default VoiceAgentButton;
