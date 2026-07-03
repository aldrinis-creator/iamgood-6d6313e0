import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface OtpVerificationProps {
  phone: string;
  purpose?: "login" | "register";
  onVerified: (data?: { token_hash?: string; email?: string; no_account?: boolean }) => void;
  onCancel: () => void;
}

type SendState = "idle" | "sending" | "sent" | "failed" | "rate_limited";

const OtpVerification = ({ phone, purpose = "login", onVerified, onCancel }: OtpVerificationProps) => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);

  useEffect(() => {
    sendOtp();
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const sendOtp = async () => {
    setSendState("sending");
    setLastError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "send", phone },
      });
      if (error) {
        setSendState("failed");
        setLastError("Network error. Please try again.");
        toast.error("Failed to send OTP");
        return;
      }
      if (data?.rate_limited) {
        setSendState("rate_limited");
        setLastError("Too many attempts. Please wait 10 minutes.");
        toast.error("Too many OTP requests");
        return;
      }
      if (!data?.success) {
        setSendState("failed");
        setLastError(data?.error || data?.result?.message || "Could not send SMS. Please try again.");
        toast.error("Failed to send OTP", { description: data?.error || "Please try again." });
        return;
      }
      setSendState("sent");
      toast.success(`OTP sent to ${phone}`);
      setResendTimer(30);
    } catch {
      setSendState("failed");
      setLastError("Unexpected error sending OTP.");
      toast.error("Error sending OTP");
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "verify", phone, otp, purpose },
      });
      if (error || !data?.success) {
        toast.error("Invalid OTP", { description: "Please check the code and try again." });
      } else {
        toast.success("Phone verified!");
        onVerified(data);
      }
    } catch {
      toast.error("Verification failed");
    }
    setLoading(false);
  };

  const resendOtp = async () => {
    setSendState("sending");
    setLastError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "resend", phone },
      });
      if (error) {
        setSendState("failed");
        setLastError("Network error. Please try again.");
        toast.error("Failed to resend OTP");
        return;
      }
      if (data?.rate_limited) {
        setSendState("rate_limited");
        setLastError("Too many attempts. Please wait 10 minutes.");
        toast.error("Too many OTP requests");
        return;
      }
      if (!data?.success) {
        setSendState("failed");
        setLastError(data?.error || "Could not resend SMS.");
        toast.error("Failed to resend OTP");
        return;
      }
      setSendState("sent");
      toast.success("OTP resent");
      setResendTimer(30);
    } catch {
      setSendState("failed");
      setLastError("Resend failed");
      toast.error("Resend failed");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="bg-auth-green-glow/20 border border-auth-green/30 rounded-xl p-3 mb-5 flex items-start gap-2.5">
        <div className="text-[18px] shrink-0 mt-[1px]">💬</div>
        <div className="text-[13px] text-auth-text-2 leading-relaxed">
          {sendState === "sending" ? "Sending code..." : <>Enter the <strong className="text-auth-green font-bold">6-digit code</strong> from your SMS. Code is valid for <strong className="text-auth-green font-bold">10 minutes.</strong></>}
        </div>
      </div>

      {(sendState === "failed" || sendState === "rate_limited") && lastError && (
        <div className="flex items-center gap-2 rounded-xl bg-auth-red/10 border border-auth-red/20 px-3 py-3 text-[13px] text-auth-red mb-5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{lastError}</span>
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
