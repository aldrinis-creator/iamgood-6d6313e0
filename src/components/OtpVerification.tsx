import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { auth } from "@/integrations/firebase/client";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

interface OtpVerificationProps {
  phone: string;
  purpose?: "login" | "register";
  /** Guardian invite token — server rejects sends to a number the ward did not invite. */
  nominationToken?: string | null;
  onVerified: (data?: { token_hash?: string; email?: string; no_account?: boolean }) => void;
  onCancel: () => void;
}

type SendState = "idle" | "sending" | "sent" | "failed" | "rate_limited";

const OtpVerification = ({ phone, purpose = "login", nominationToken, onVerified, onCancel }: OtpVerificationProps) => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [hasSent, setHasSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);

  // Check if it's an Indian number (+91)
  const isIndianNumber = phone.replace(/\s+/g, "").startsWith("+91");

  useEffect(() => {
    sendOtp("send");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    if (!requestId || !isIndianNumber || sendState !== "sent") return;
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.functions.invoke("send-otp", {
        body: { phone, action: "status", request_id: requestId },
      });
      if (data?.delivery_status === "failed") {
        setDeliveryNote("WhatsApp could not deliver this code. Please tap Resend OTP after the timer ends.");
      } else if (data?.delivery_status === "delivered" || data?.delivery_status === "read") {
        setDeliveryNote("The code was delivered on WhatsApp.");
      } else {
        setDeliveryNote("The provider accepted the request, but delivery is still pending. You can resend after the timer ends.");
      }
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [requestId, isIndianNumber, phone, sendState]);

  /** Turn a raw server/provider error into something an elderly user can act on. */
  const friendlyError = (raw?: string | null): string => {
    const msg = (raw || "").toLowerCase();
    if (!msg) return "We couldn't send the code just now. Please tap Resend OTP in a moment.";
    if (msg.includes("invite was sent to")) return raw!; // already plain language + masked number
    if (msg.includes("rate") || msg.includes("too many")) return "Too many code requests. Please wait 10 minutes and try again.";
    if (msg.includes("invalid number") || msg.includes("not reachable") || msg.includes("invalid mobile"))
      return "This number doesn't look reachable on WhatsApp or SMS. Please check the number and try again.";
    if (msg.includes("not configured") || msg.includes("auth_key") || msg.includes("authkey"))
      return "Our messaging service is temporarily unavailable. Please try again shortly.";
    if (msg.includes("network") || msg.includes("failed to fetch"))
      return "No internet connection. Please check your network and tap Resend OTP.";
    return `We couldn't send the code: ${raw}`;
  };

  const sendOtp = async (action: "send" | "resend" = "send") => {
    setSendState("sending");
    setLastError(null);
    setDeliveryNote(null);

    if (isIndianNumber) {
      // ── MSG91 WHATSAPP ROUTE (INDIA) ──
      try {
        const { data, error } = await supabase.functions.invoke("send-otp", {
          body: { phone, action, purpose, nomination_token: nominationToken || undefined },
        });

        let payload: any = data;
        if (error) {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const res = typeof ctx.clone === "function" ? ctx.clone() : ctx;
              payload = await res.json();
            } catch { /* ignore */ }
          }
        }

        if (payload?.rate_limited) {
          setSendState("rate_limited");
          setLastError(friendlyError(payload.error || "too many requests"));
          return;
        }

        if (error || !payload?.success) {
          const msg = friendlyError(payload?.error || (error as any)?.message);
          setSendState("failed");
          setLastError(msg);
          toast.error("Couldn't send the code", { description: msg });
          return;
        }

        setHasSent(true);
        setSendState("sent");
        setRequestId(typeof payload.request_id === "string" ? payload.request_id : null);
        toast.success(`OTP request accepted for ${phone}`);
        setResendTimer(30);
      } catch (err: any) {
        const msg = friendlyError(err?.message);
        setSendState("failed");
        setLastError(msg);
        toast.error("Couldn't send the code", { description: msg });
      }
    } else {
      // ── FIREBASE PHONE AUTH ROUTE (INTERNATIONAL) ──
      try {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible",
          });
        }

        const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        setConfirmationResult(result);
        setHasSent(true);
        setSendState("sent");
        toast.success(`OTP sent via SMS to ${phone}`);
        setResendTimer(30);
      } catch (err: any) {
        console.error(err);
        setSendState("failed");
        setLastError(err.message || "Could not send SMS. Please try again.");
        toast.error("Failed to send OTP", { description: err.message || "Please try again." });
      }
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6 || !hasSent) return;
    setLoading(true);

    if (isIndianNumber) {
      // ── MSG91 WHATSAPP VERIFY (INDIA) ──
      try {
        const { data, error } = await supabase.functions.invoke("send-otp", {
          body: { action: "verify", phone, otp, purpose },
        });

        let payload: any = data;
        if (error) {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const res = typeof ctx.clone === "function" ? ctx.clone() : ctx;
              payload = await res.json();
            } catch { /* ignore */ }
          }
        }

        if (!payload?.success || !payload?.verified) {
          const msg = payload?.error || "Invalid or expired OTP";
          toast.error("Invalid OTP", { description: msg });
          setLoading(false);
          return;
        }

        toast.success("Phone verified!");
        onVerified(payload);
      } catch (err: any) {
        toast.error("Invalid OTP", { description: "Please check the code and try again." });
      }
      setLoading(false);
    } else {
      // ── FIREBASE VERIFY (INTERNATIONAL) ──
      if (!confirmationResult) {
        setLoading(false);
        return;
      }

      try {
        const result = await confirmationResult.confirm(otp);
        const idToken = await result.user.getIdToken();

        const { data, error } = await supabase.functions.invoke("firebase-auth", {
          body: { idToken },
        });

        let payload: any = data;
        let errorMessage = payload?.error || "Failed to create session.";
        
        if (error) {
          const ctx = (error as any).context;
          let contextError = ctx?.error;
          if (!contextError && ctx && typeof ctx.json === 'function') {
            try {
              const res = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
              const j = await res.json();
              contextError = j?.error;
            } catch (e) {}
          }
          errorMessage = contextError || (error as any).message || errorMessage;
          
          console.error("firebase-auth session exchange failed:", errorMessage);
          toast.error("Authentication failed", { description: errorMessage });
          setLoading(false);
          return;
        }

        if (!payload?.success) {
           toast.error("Authentication failed", { description: errorMessage });
           setLoading(false);
           return;
        }

        toast.success("Phone verified!");
        onVerified(payload);
      } catch (err: any) {
        toast.error("Invalid OTP", { description: "Please check the code and try again." });
      }
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    sendOtp("resend");
  };

  return (
    <div className="flex flex-col">
      <div className="bg-auth-green-glow/20 border border-auth-green/30 rounded-xl p-3 mb-5 flex items-start gap-2.5">
        <div className="text-[18px] shrink-0 mt-[1px]">💬</div>
        <div className="text-[13px] text-auth-text-2 leading-relaxed">
          {sendState === "sending" ? "Sending code..." : <>Enter the <strong className="text-auth-green font-bold">6-digit code</strong> sent on <strong className="text-auth-green font-bold">{isIndianNumber ? "WhatsApp" : "SMS"}</strong>. Code is valid for <strong className="text-auth-green font-bold">{isIndianNumber ? "5" : "10"} minutes.</strong></>}
        </div>
      </div>

      {(sendState === "failed" || sendState === "rate_limited") && lastError && (
        <div className="rounded-xl bg-auth-red/10 border border-auth-red/20 px-3 py-3 mb-5">
          <div className="flex items-start gap-2 text-[13px] text-auth-red">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-[2px]" />
            <span>{lastError}</span>
          </div>
          <div className="text-[12px] text-auth-text-3 mt-2 pl-6">
            Still no code? {resendTimer > 0 ? `Try again in ${resendTimer}s, or write` : "Tap Resend OTP, or write"} to{" "}
            <a href="mailto:support@futurewave.in" className="text-auth-green font-semibold">support@futurewave.in</a>.
          </div>
        </div>
      )}

      <div className="flex justify-between w-full mb-5">
        <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="flex w-full gap-2 justify-between">
          <InputOTPGroup className="flex w-full gap-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <InputOTPSlot 
                key={idx} 
                index={idx} 
                className="flex-1 h-[52px] bg-navy-mid border-[1.5px] border-auth-border-hi rounded-[10px] text-[22px] font-bold text-auth-text-1 flex items-center justify-center focus-visible:border-auth-green focus-visible:ring-0" 
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {deliveryNote && (
        <div className="rounded-xl bg-navy-mid border border-auth-border-hi px-3 py-3 mb-4 text-[13px] text-auth-text-2 leading-relaxed">
          {deliveryNote}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 mb-6">
        <div className="text-[13px] text-auth-text-3">
          {sendState === "sending" ? "Sending..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : ""}
        </div>
        <button
          type="button"
          onClick={resendOtp}
          disabled={resendTimer > 0 || sendState === "sending" || sendState === "rate_limited"}
          className="text-[13px] font-semibold text-auth-green disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendTimer > 0 ? "Change number?" : "Resend OTP"}
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={verifyOtp}
          disabled={otp.length !== 6 || loading || sendState === "sending"}
          className="w-full bg-auth-green text-[#0A1525] text-[17px] font-bold py-4 rounded-2xl flex items-center justify-center disabled:opacity-50 transition-transform active:scale-[0.98]"
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify & continue ›"}
        </button>
      </div>
    </div>
  );
};

export default OtpVerification;
