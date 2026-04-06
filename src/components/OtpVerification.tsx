import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6 text-center">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Verify your phone</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {sendState === "sending" && "Sending code…"}
          {sendState === "sent" && <>Enter the 6-digit code sent to <strong>{phone}</strong></>}
          {sendState === "failed" && "Couldn't deliver SMS. Try resend below."}
          {sendState === "rate_limited" && "Too many attempts. Wait 10 minutes."}
          {sendState === "idle" && <>Enter the 6-digit code sent to <strong>{phone}</strong></>}
        </p>
      </div>

      {(sendState === "failed" || sendState === "rate_limited") && lastError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      <div className="flex justify-center">
        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        onClick={verifyOtp}
        className="w-full min-h-[48px] text-base"
        disabled={otp.length !== 6 || loading || sendState === "sending"}
      >
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify OTP"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={resendOtp}
          disabled={resendTimer > 0 || sendState === "sending" || sendState === "rate_limited"}
          className="text-primary disabled:text-muted-foreground"
        >
          {sendState === "sending" ? "Sending…" : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default OtpVerification;
