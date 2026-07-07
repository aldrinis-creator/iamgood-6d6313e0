import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UseMediaRecorderSttOpts {
  language?: string; // "unknown" (auto) | "en-IN" | "hi-IN" | ...
  maxDurationMs?: number;
  onFinal?: (transcript: string) => void;
  onError?: (msg: string) => void;
}

const pickMime = (): string => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    try { if ((MediaRecorder as any).isTypeSupported?.(m)) return m; } catch { /* ignore */ }
  }
  return "";
};

export const useMediaRecorderStt = ({
  language = "unknown",
  maxDurationMs = 20000,
  onFinal,
  onError,
}: UseMediaRecorderSttOpts = {}) => {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const cleanup = useCallback(() => {
    if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    recRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const upload = useCallback(async (blob: Blob) => {
    setUploading(true);
    try {
      const form = new FormData();
      const ext =
        blob.type.includes("mp4") ? "mp4" :
        blob.type.includes("wav") ? "wav" :
        blob.type.includes("ogg") ? "ogg" :
        "webm";
      form.append("audio", blob, `recording.${ext}`);
      form.append("language", language);

      const { data, error: err } = await supabase.functions.invoke("sarvam-stt", { body: form });
      if (err) {
        let msg = err.message || "Transcription failed.";
        try {
          const ctx: any = (err as any).context;
          if (ctx?.json) { const b = await ctx.json(); msg = b?.error || msg; }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const transcript = ((data as any)?.transcript ?? "").toString().trim();
      if (!transcript) {
        throw new Error("Didn't catch that — please try again.");
      }
      onFinal?.(transcript);
    } catch (e: any) {
      const msg = e?.message || "Transcription failed.";
      setError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  }, [language, onFinal, onError]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try { if (rec.state !== "inactive") rec.stop(); } catch { /* ignore */ }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      const msg = "Microphone recording not supported on this browser.";
      setError(msg); onError?.(msg); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onerror = () => {
        setError("Recording error");
        onError?.("Recording error");
        cleanup();
        setRecording(false);
      };
      rec.onstop = async () => {
        setRecording(false);
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        cleanup();
        if (blob.size < 2048) {
          const msg = "Didn't catch that — please try again.";
          setError(msg); onError?.(msg); return;
        }
        await upload(blob);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      timeoutRef.current = window.setTimeout(() => stop(), maxDurationMs);
    } catch (e: any) {
      const msg = e?.name === "NotAllowedError"
        ? "Microphone permission denied."
        : (e?.message || "Could not access microphone.");
      setError(msg);
      onError?.(msg);
      cleanup();
      setRecording(false);
    }
  }, [supported, maxDurationMs, upload, cleanup, stop, onError]);

  return { recording, uploading, error, start, stop, supported };
};
