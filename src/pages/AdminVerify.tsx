import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/hooks/use-toast";
import { Shield, Mail, Smartphone, Loader2 } from "lucide-react";

const MASKED_PHONE = "+91 ******8482";
const MASKED_EMAIL = "ch***@futurewave.in";
const RESEND_COOLDOWN = 60;

export default function AdminVerify() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/admin/coupons";

  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [locked, setLocked] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const sentOnceRef = useRef(false);

  const sendCode = async () => {
    setSending(true);
    setDeliveryError(null);
    const { data, error } = await supabase.functions.invoke("admin-2fa", { body: { action: "send" } });
    setSending(false);
    if (error || data?.error) {
      const msg = (data?.error || error?.message || "Failed to send code").toString();
      if (msg.toLowerCase().includes("locked") || msg.toLowerCase().includes("too many")) {
        setLocked(true);
      }
      const details = [data?.smsError, data?.emailError].filter(Boolean).join(" • ");
      setDeliveryError(details ? `${msg} — ${details}` : msg);
      toast({ title: "Couldn't send code", description: msg, variant: "destructive" });
      return;
    }
    setCooldown(RESEND_COOLDOWN);
    // Partial-success warning: one channel worked, other failed
    if (data?.smsError || data?.emailError) {
      const partial: string[] = [];
      if (data.sms) partial.push("SMS sent");
      else if (data.smsError) partial.push(`SMS failed: ${data.smsError}`);
      if (data.email) partial.push("Email sent");
      else if (data.emailError) partial.push(`Email failed: ${data.emailError}`);
      setDeliveryError(partial.join(" • "));
    }
    toast({ title: "Code sent", description: "Check your SMS and email." });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke("admin-2fa", { body: { action: "verify", code } });
    setVerifying(false);
    if (error || data?.error || !data?.token) {
      toast({ title: "Verification failed", description: data?.error || error?.message || "Invalid code", variant: "destructive" });
      setCode("");
      return;
    }
    sessionStorage.setItem("admin_step_up_token", data.token);
    toast({ title: "Verified", description: "Welcome to admin." });
    navigate(next, { replace: true });
  };

  return (
    <AppLayout>
      <div className="container max-w-md mx-auto py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Admin Verification</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Enter the 6-digit code sent to the admin contacts.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="w-4 h-4" /> SMS to {MASKED_PHONE}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" /> Email to {MASKED_EMAIL}
              </div>
            </div>

            {locked ? (
              <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm text-center">
                Too many failed attempts. Locked for 10 minutes — contact support.
              </div>
            ) : (
              <>
                {deliveryError && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs break-words">
                    {deliveryError}
                  </div>
                )}
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={setCode} disabled={verifying}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button onClick={verify} disabled={code.length !== 6 || verifying} className="w-full">
                  {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify
                </Button>

                <Button
                  variant="ghost"
                  onClick={sendCode}
                  disabled={sending || cooldown > 0}
                  className="w-full"
                >
                  {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
