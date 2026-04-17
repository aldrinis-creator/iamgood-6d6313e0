import { useCallback, useEffect, useRef, useState } from "react";

// Minimal types for Web Speech API (not in standard TS lib)
interface SRResultAlt { transcript: string; confidence: number }
interface SRResult { 0: SRResultAlt; isFinal: boolean; length: number }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string; message?: string }
interface SRInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export const isSpeechRecognitionSupported = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export interface UseVoiceRecognitionOpts {
  lang?: string;
  onFinal?: (transcript: string) => void;
}

export const useVoiceRecognition = ({ lang = "en-US", onFinal }: UseVoiceRecognitionOpts = {}) => {
  const recRef = useRef<SRInstance | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      try { recRef.current?.abort(); } catch { /* ignore */ }
    };
  }, []);

  const start = useCallback(() => {
    setError(null);
    setInterim("");
    if (!isSpeechRecognitionSupported()) {
      setError("Voice recognition is not supported on this browser.");
      return;
    }
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec: SRInstance = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        onFinal?.(finalText.trim());
      }
    };
    rec.onerror = (e) => {
      setError(e.error || "Voice recognition error");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      setError(String(err));
    }
  }, [lang, onFinal]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  return { listening, interim, error, start, stop, supported: isSpeechRecognitionSupported() };
};
