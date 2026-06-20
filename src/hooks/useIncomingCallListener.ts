import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface IncomingCall {
  callId: string;
  wardName: string;
  wardPhone?: string | null;
  wardUserId?: string | null;
}

export const useIncomingCallListener = () => {
  const { session } = useAuth();
  const [call, setCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    const handlePayload = (payload: any) => {
      if (!payload) return;
      setCall({
        callId: payload.callId || crypto.randomUUID(),
        wardName: payload.wardName || "Your ward",
        wardPhone: payload.wardPhone || null,
        wardUserId: payload.wardUserId || null,
      });
    };

    // 1) Realtime broadcast channel (foreground / backgrounded tab)
    const channel = supabase
      .channel(`guardian-call:${uid}`, { config: { broadcast: { ack: false } } })
      .on("broadcast", { event: "incoming_call" }, ({ payload }) => handlePayload(payload))
      .subscribe();

    // 2) Service worker -> client postMessage (push received while tab open)
    const swHandler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.kind === "incoming_call") handlePayload(data);
    };
    navigator.serviceWorker?.addEventListener?.("message", swHandler);

    // 3) URL param fallback (notification click opens /guardian?incoming_call=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const callId = params.get("incoming_call");
      const wardName = params.get("ward_name");
      const wardPhone = params.get("ward_phone");
      if (callId) {
        handlePayload({ callId, wardName: wardName || "Your ward", wardPhone });
        params.delete("incoming_call");
        params.delete("ward_name");
        params.delete("ward_phone");
        const q = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
      }
    } catch {}

    return () => {
      supabase.removeChannel(channel);
      navigator.serviceWorker?.removeEventListener?.("message", swHandler);
    };
  }, [session?.user?.id]);

  return { call, dismiss: () => setCall(null) };
};
