import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface OtpVerificationProps {
  phone: string;
  onVerified: (data?: { token_hash?: string; email?: string; no_account?: boolean }) => void;
  onCancel: () => void;
}

const OtpVerification = ({ phone, onVerified, onCancel }: OtpVerificationProps) => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "send", phone },
      });
      if (error || !data?.success) {
        toast({ title: "Failed to send OTP", description: data?.result?.message || "Please try again.", variant: "destructive" });
      } else {
        toast({ title: "OTP sent", description: `A verification code was sent to ${phone}` });
        setResendTimer(30);
      }
    } catch {
      toast({ title: "Error sending OTP", variant: "destructive" });
    }
    setSending(false);
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "verify", phone, otp },
      });
      if (error || !data?.success) {
        toast({ title: "Invalid OTP", description: "Please check the code and try again.", variant: "destructive" });
      } else {
        toast({ title: "Phone verified!" });
        onVerified(data);
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    }
    setLoading(false);
  };

  const resendOtp = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "resend", phone },
      });
      if (!error && data?.success) {
        toast({ title: "OTP resent" });
        setResendTimer(30);
      } else {
        toast({ title: "Failed to resend", variant: "destructive" });
      }
    } catch {
      toast({ title: "Resend failed", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Verify your phone</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the 6-digit code sent to <strong>{phone}</strong>
        </p>
      </div>

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
        disabled={otp.length !== 6 || loading}
      >
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify OTP"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={resendOtp}
          disabled={resendTimer > 0 || sending}
          className="text-primary disabled:text-muted-foreground"
        >
          {resendTimer > 0 ? `Resend in ${resendTimer}s` : sending ? "Sending..." : "Resend OTP"}
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default OtpVerification;
