/**
 * VaultClaimCard — shown on the Guardian Dashboard for the current ward
 * only when the guardian is marked is_vault_nominee=true. Lets the
 * guardian initiate a death claim by uploading a death certificate and
 * a government ID proof.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  wardUserId: string;
  wardName: string;
}

interface ExistingClaim {
  id: string;
  status: string;
  user_window_ends_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; tone: "warning" | "info" | "success" | "destructive" }> = {
  initiated: { label: "Awaiting Documents", tone: "info" },
  docs_uploaded: { label: "Documents Submitted", tone: "info" },
  user_window_open: { label: "Grace Window (7 days)", tone: "warning" },
  released: { label: "Released", tone: "success" },
  rejected: { label: "Rejected", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "destructive" },
};

const VaultClaimCard = ({ wardUserId, wardName }: Props) => {
  const { session } = useAuth();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [guardianId, setGuardianId] = useState<string | null>(null);
  const [claim, setClaim] = useState<ExistingClaim | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [deathCert, setDeathCert] = useState<File | null>(null);
  const [idProof, setIdProof] = useState<File | null>(null);
  const [acknowledge, setAcknowledge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session?.user?.id || !wardUserId) return;
    (async () => {
      const { data: g } = await supabase
        .from("guardians")
        .select("id, is_vault_nominee, status")
        .eq("user_id", wardUserId)
        .eq("guardian_user_id", session.user.id)
        .eq("status", "accepted")
        .maybeSingle();
      const isEligible = !!(g && (g as any).is_vault_nominee);
      setEligible(isEligible);
      setGuardianId(g?.id || null);

      if (isEligible) {
        const { data: c } = await supabase
          .from("vault_nominee_claims" as any)
          .select("id, status, user_window_ends_at, created_at")
          .eq("user_id", wardUserId)
          .eq("guardian_id", g!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setClaim((c as unknown as ExistingClaim) || null);
      }
    })();
  }, [session?.user?.id, wardUserId]);

  const submitClaim = async () => {
    if (!guardianId || !session?.user?.id) return;
    if (!deathCert || !idProof) { toast.error("Both documents required"); return; }
    if (!acknowledge) { toast.error("You must acknowledge the legal declaration"); return; }
    setSubmitting(true);
    try {
      // Insert claim
      const { data: claimRow, error } = await supabase
        .from("vault_nominee_claims" as any)
        .insert({
          user_id: wardUserId,
          guardian_id: guardianId,
          status: "initiated",
        })
        .select("id")
        .single();
      if (error) throw error;
      const claimId = (claimRow as any).id;

      // Upload files
      const certPath = `claims/${claimId}/death_certificate.${deathCert.name.split(".").pop()}`;
      const idPath = `claims/${claimId}/id_proof.${idProof.name.split(".").pop()}`;
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.storage.from("medical-documents").upload(certPath, deathCert, { upsert: true }),
        supabase.storage.from("medical-documents").upload(idPath, idProof, { upsert: true }),
      ]);
      if (e1 || e2) throw e1 || e2;

      await supabase.from("vault_nominee_claims" as any)
        .update({
          death_certificate_url: certPath,
          id_proof_url: idPath,
          proof_uploaded_at: new Date().toISOString(),
          status: "docs_uploaded",
          user_window_started_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      // Trigger notify edge function
      await supabase.functions.invoke("vault-claim-initiated", { body: { claim_id: claimId } });

      toast.success("Claim filed. The user will have 7 days to cancel before admin review.");
      setOpen(false);
      setStep(1);
      setDeathCert(null);
      setIdProof(null);
      setAcknowledge(false);
      setClaim({ id: claimId, status: "user_window_open", user_window_ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(), created_at: new Date().toISOString() });
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  if (eligible !== true) return null;

  const statusInfo = claim ? STATUS_LABELS[claim.status] : null;
  const claimActive = claim && !["cancelled", "rejected", "released"].includes(claim.status);

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" /> Vault Nominee Access
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            You are nominated to receive {wardName}'s Vault contents in the event of their death.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {claim && statusInfo && (
            <div className="flex items-center justify-between p-2 rounded bg-muted/40 text-xs">
              <span>Current claim:</span>
              <Badge variant={statusInfo.tone === "destructive" ? "destructive" : "secondary"}>{statusInfo.label}</Badge>
            </div>
          )}
          {claim?.status === "released" ? (
            <p className="text-xs text-muted-foreground">Released on {new Date(claim.user_window_ends_at || claim.created_at).toLocaleDateString("en-IN")}. Check your email for the access link.</p>
          ) : claimActive ? (
            <p className="text-xs text-muted-foreground">A claim is already in progress. The admin will review after the grace window ends.</p>
          ) : (
            <Button variant="destructive" className="w-full" onClick={() => setOpen(true)}>
              <ShieldAlert className="w-4 h-4 mr-2" /> Report Bereavement & Claim Vault
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vault Claim — Step {step} of 3</DialogTitle>
            <DialogDescription>
              This is a sensitive process. The user will have 7 days to cancel before admin review.
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-3">
              <Label>Upload Death Certificate (PDF or image, ≤10 MB)</Label>
              <Input type="file" accept=".pdf,image/*" onChange={(e) => setDeathCert(e.target.files?.[0] || null)} />
              {deathCert && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> {deathCert.name}</p>}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => setStep(2)} disabled={!deathCert}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>Upload Your Government ID Proof (Aadhaar / Passport / DL)</Label>
              <Input type="file" accept=".pdf,image/*" onChange={(e) => setIdProof(e.target.files?.[0] || null)} />
              {idProof && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> {idProof.name}</p>}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={!idProof}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Alert>
                <AlertDescription className="text-xs">
                  By proceeding, the deceased user (if alive) will receive notifications and have 7 days to cancel this claim. False claims may have legal consequences.
                </AlertDescription>
              </Alert>
              <div className="flex items-start gap-2">
                <Checkbox id="ack" checked={acknowledge} onCheckedChange={(v) => setAcknowledge(!!v)} />
                <Label htmlFor="ack" className="text-xs leading-relaxed">
                  I declare under penalty of perjury that {wardName} has passed away and I am the lawful nominee.
                </Label>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button variant="destructive" onClick={submitClaim} disabled={!acknowledge || submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  Submit Claim
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VaultClaimCard;
