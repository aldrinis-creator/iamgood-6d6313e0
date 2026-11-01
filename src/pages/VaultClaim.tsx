/**
 * Public route /vault-claim/:token — nominee claim portal.
 * Step 1: enter OTP sent to nominee's verified phone.
 * Step 2: read-only export of vault contents (Bank, Insurance, Will,
 *         Identity, Email summaries with nominee details).
 *
 * Token expires 24h after release. After expiry the link returns 410.
 */
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Lock, Printer, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReleasePayload {
  user_name: string;
  released_at: string;
  expires_at: string;
  identity?: { label: string; value: string; notes?: string }[];
  email?: { label: string; email: string; password?: string; recovery_email?: string; notes?: string }[];
  bank?: { label: string; bank_name: string; account_number: string; ifsc: string; nominee_name: string; nominee_phone: string; nominee_relation: string; notes?: string }[];
  insurance?: { label: string; company: string; category: string; policy_number: string; nominee_name: string; nominee_phone: string; renewal_date?: string; expiry_date?: string }[];
  will?: { label: string; status: string; partner: string; document_ref?: string; nominee_name?: string; nominee_phone?: string; notes?: string }[];
  digital_legacy?: { id: string; title: string; recipient_name: string; recipient_relation: string; media_type: string; content_text?: string; media_url?: string }[];
  metadata_only?: boolean;
}

const VaultClaim = () => {
  const { token } = useParams<{ token: string }>();
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [payload, setPayload] = useState<ReleasePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Invalid link"); return; }
    // Auto-request OTP on mount
    (async () => {
      setRequestingOtp(true);
      try {
        const { error } = await supabase.functions.invoke("vault-claim-otp-verify", {
          body: { token, action: "request" },
        });
        if (error) throw error;
        setOtpSent(true);
      } catch (err: any) {
        setError(err?.message || "Link is invalid or expired");
      } finally {
        setRequestingOtp(false);
      }
    })();
  }, [token]);

  const verify = async () => {
    if (otp.length !== 6) { toast.error("Enter 6-digit OTP"); return; }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-claim-otp-verify", {
        body: { token, action: "verify", otp },
      });
      if (error || !(data as any)?.payload) throw error || new Error("Invalid OTP");
      setPayload((data as any).payload);
    } catch (err: any) {
      toast.error(err?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30 safe-top">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Link Unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30 safe-top">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Vault Claim Portal</CardTitle>
            <p className="text-xs text-muted-foreground">A 6-digit OTP has been sent to the nominee's verified phone.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {requestingOtp ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : otpSent ? (
              <>
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    OTP sent. Enter the 6-digit code below. Link expires 24 hours after release.
                  </AlertDescription>
                </Alert>
                <Label>OTP</Label>
                <Input
                  type="text" maxLength={6} inputMode="numeric"
                  value={otp} placeholder="● ● ● ● ● ●"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-base text-center tracking-widest font-mono"
                />
                <Button onClick={verify} disabled={otp.length !== 6 || verifying} className="w-full">
                  {verifying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                  Unlock Vault
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-muted/30 print:bg-white safe-top">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-2xl font-bold">Vault Release for {payload.user_name}</h1>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
          </Button>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Released on {new Date(payload.released_at).toLocaleString("en-IN")}. Link expires {new Date(payload.expires_at).toLocaleString("en-IN")}.
            {payload.metadata_only && " (Metadata only — user did not enable Nominee Recovery.)"}
          </AlertDescription>
        </Alert>

        {payload.identity?.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Identity Documents</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {payload.identity.map((e, i) => (
                <div key={i} className="p-2 rounded bg-muted/40 text-sm">
                  <p className="font-medium">{e.label}</p>
                  <p className="font-mono text-xs">{e.value}</p>
                  {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {payload.email?.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Email Accounts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {payload.email.map((e, i) => (
                <div key={i} className="p-2 rounded bg-muted/40 text-sm">
                  <p className="font-medium">{e.label}</p>
                  <p className="text-xs">Email: <span className="font-mono">{e.email}</span></p>
                  {e.password && <p className="text-xs">Password: <span className="font-mono">{e.password}</span></p>}
                  {e.recovery_email && <p className="text-xs">Recovery: <span className="font-mono">{e.recovery_email}</span></p>}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {payload.bank?.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Bank Accounts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {payload.bank.map((e, i) => (
                <div key={i} className="p-3 rounded bg-muted/40 text-sm space-y-1">
                  <p className="font-medium">{e.label} <Badge variant="secondary" className="ml-1">{e.bank_name}</Badge></p>
                  <p className="text-xs">A/C: <span className="font-mono">{e.account_number}</span> · IFSC: <span className="font-mono">{e.ifsc}</span></p>
                  <p className="text-xs"><strong>Nominee:</strong> {e.nominee_name} ({e.nominee_relation}) · {e.nominee_phone}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {payload.insurance?.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Insurance Policies</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {payload.insurance.map((e, i) => (
                <div key={i} className="p-3 rounded bg-muted/40 text-sm space-y-1">
                  <p className="font-medium">{e.company} <Badge variant="secondary" className="ml-1 capitalize">{e.category}</Badge></p>
                  <p className="text-xs">Policy: <span className="font-mono">{e.policy_number}</span></p>
                  <p className="text-xs"><strong>Nominee:</strong> {e.nominee_name} · {e.nominee_phone}</p>
                  {e.renewal_date && <p className="text-xs text-muted-foreground">Renewal: {e.renewal_date}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {payload.will?.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Legal Will</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {payload.will.map((e, i) => (
                <div key={i} className="p-3 rounded bg-muted/40 text-sm space-y-1">
                  <p className="font-medium">{e.label} <Badge variant="secondary" className="capitalize ml-1">{e.status}</Badge></p>
                  <p className="text-xs">Partner: <span className="capitalize">{e.partner}</span> {e.document_ref && `· Ref: ${e.document_ref}`}</p>
                  {e.nominee_name && <p className="text-xs"><strong>Nominee:</strong> {e.nominee_name} · {e.nominee_phone}</p>}
                  {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {payload.digital_legacy?.length ? (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                <span>Personal Messages & Digital Legacy</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                  Released
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payload.digital_legacy.map((msg, i) => (
                <div key={i} className="p-4 rounded-xl bg-card border border-emerald-500/20 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{msg.title}</p>
                    <Badge variant="secondary" className="text-xs capitalize">{msg.media_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Intended For: <strong className="text-foreground">{msg.recipient_name}</strong> ({msg.recipient_relation})
                  </p>
                  {msg.media_type === "text" && msg.content_text && (
                    <div className="p-3 rounded-lg bg-muted/50 italic text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                      "{msg.content_text}"
                    </div>
                  )}
                  {msg.media_type === "audio" && msg.media_url && (
                    <div className="pt-1">
                      <audio controls src={msg.media_url} className="w-full h-8" />
                    </div>
                  )}
                  {msg.media_type === "video" && msg.media_url && (
                    <div className="pt-1">
                      <video controls src={msg.media_url} className="w-full rounded-lg max-h-56 bg-black" />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default VaultClaim;
