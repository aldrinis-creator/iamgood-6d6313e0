/**
 * VaultClaimCard — 5-step hardened death-verification wizard for the
 * nominated guardian. Enforces eligibility cooldown, structured death
 * certificate metadata, ID with last-4 capture, live selfie + ID,
 * three-checkbox sworn declaration, typed-name match, and password
 * re-auth before insert.
 */
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, Upload, Loader2, FileText, Camera, CheckCircle2 } from "lucide-react";
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
  reject_reason?: string | null;
}

interface GuardianRow {
  id: string;
  guardian_name: string;
  is_vault_nominee: boolean;
  status: string;
  nominated_at: string;
}

interface WardProfile {
  date_of_birth: string | null;
}

const STATUS_LABELS: Record<string, { label: string; tone: "warning" | "info" | "success" | "destructive" }> = {
  initiated: { label: "Awaiting Documents", tone: "info" },
  docs_uploaded: { label: "Documents Submitted", tone: "info" },
  user_window_open: { label: "Grace Window (7 days)", tone: "warning" },
  released: { label: "Released", tone: "success" },
  rejected: { label: "Rejected", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "destructive" },
};

const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png"];
const MIN_BYTES = 50 * 1024;
const MAX_BYTES = 10 * 1024 * 1024;

const fileSchema = z.custom<File>((f) => f instanceof File, "File required")
  .refine((f) => ALLOWED_MIMES.includes(f.type), "Must be PDF, JPG or PNG")
  .refine((f) => f.size >= MIN_BYTES, "File too small (min 50 KB)")
  .refine((f) => f.size <= MAX_BYTES, "File too large (max 10 MB)");

async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const VaultClaimCard = ({ wardUserId, wardName }: Props) => {
  const { session } = useAuth();
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [guardian, setGuardian] = useState<GuardianRow | null>(null);
  const [wardProfile, setWardProfile] = useState<WardProfile | null>(null);
  const [claim, setClaim] = useState<ExistingClaim | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — eligibility cooldown
  const [step1Ready, setStep1Ready] = useState(false);

  // Step 2 — death certificate
  const [deathCert, setDeathCert] = useState<File | null>(null);
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState("");

  // Step 3 — nominee ID
  const [idProof, setIdProof] = useState<File | null>(null);
  const [idType, setIdType] = useState("");
  const [idLast4, setIdLast4] = useState("");

  // Step 4 — selfie (live capture)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  // Step 5 — sworn declaration
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [ack3, setAck3] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");

  // Load eligibility
  useEffect(() => {
    if (!session?.user?.id || !wardUserId) return;
    (async () => {
      const { data: g } = await supabase
        .from("guardians")
        .select("id, guardian_name, is_vault_nominee, status, nominated_at")
        .eq("user_id", wardUserId)
        .eq("guardian_user_id", session.user.id)
        .eq("status", "accepted")
        .maybeSingle();
      const row = g as GuardianRow | null;
      const isEligible = !!(row?.is_vault_nominee);
      setEligible(isEligible);
      setGuardian(row);

      if (isEligible) {
        const [{ data: c }, { data: p }] = await Promise.all([
          supabase.from("vault_nominee_claims" as any)
            .select("id, status, user_window_ends_at, created_at, reject_reason")
            .eq("user_id", wardUserId)
            .eq("guardian_id", row!.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("profiles").select("date_of_birth").eq("id", wardUserId).maybeSingle(),
        ]);
        setClaim((c as unknown as ExistingClaim) || null);
        setWardProfile((p as WardProfile) || null);
      }
    })();
  }, [session?.user?.id, wardUserId]);

  // Cooldown timer for step 1
  useEffect(() => {
    if (!open || step !== 1) return;
    setStep1Ready(false);
    const t = setTimeout(() => setStep1Ready(true), 5000);
    return () => clearTimeout(t);
  }, [open, step]);

  // Cleanup camera on close
  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // Defer attaching srcObject until video element exists
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e: any) {
      toast.error("Camera access denied. A live selfie is required.");
    }
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.9));
    if (!blob || blob.size < 10_000) { toast.error("Selfie capture failed, try again"); return; }
    setSelfieBlob(blob);
    setSelfiePreview(URL.createObjectURL(blob));
    stopCamera();
  };

  const retakeSelfie = () => {
    setSelfieBlob(null);
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(null);
    startCamera();
  };

  const resetWizard = () => {
    setStep(1);
    setDeathCert(null); setIssuingAuthority(""); setCertificateNumber(""); setDateOfDeath("");
    setIdProof(null); setIdType(""); setIdLast4("");
    setSelfieBlob(null);
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(null);
    stopCamera();
    setAck1(false); setAck2(false); setAck3(false);
    setTypedName(""); setPassword("");
  };

  // Step validators
  const step2Valid = (() => {
    if (!deathCert) return false;
    const f = fileSchema.safeParse(deathCert);
    if (!f.success) return false;
    if (!issuingAuthority.trim() || !certificateNumber.trim() || !dateOfDeath) return false;
    const dod = new Date(dateOfDeath);
    if (isNaN(dod.getTime())) return false;
    if (dod > new Date()) return false;
    if (wardProfile?.date_of_birth) {
      const dob = new Date(wardProfile.date_of_birth);
      if (dod < dob) return false;
    }
    return true;
  })();

  const step3Valid = !!idProof && fileSchema.safeParse(idProof).success
    && !!idType && /^\d{4}$/.test(idLast4);

  const step4Valid = !!selfieBlob;

  const typedNameMatches = guardian
    && typedName.trim().toLowerCase() === guardian.guardian_name.trim().toLowerCase();
  const step5Valid = ack1 && ack2 && ack3 && typedNameMatches && password.length >= 6;

  const submitClaim = async () => {
    if (!guardian || !session?.user?.id || !session?.user?.email) return;
    if (!step2Valid || !step3Valid || !step4Valid || !step5Valid) {
      toast.error("All verification steps required");
      return;
    }
    setSubmitting(true);
    let createdClaimId: string | null = null;
    try {
      // Re-auth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password,
      });
      if (authErr) throw new Error("Password re-verification failed");
      const reauthAt = new Date().toISOString();

      // Insert claim
      const { data: claimRow, error } = await supabase
        .from("vault_nominee_claims" as any)
        .insert({
          user_id: wardUserId,
          guardian_id: guardian.id,
          status: "initiated",
        })
        .select("id")
        .single();
      if (error) throw error;
      createdClaimId = (claimRow as any).id;
      const claimId = createdClaimId!;

      // Hash + upload all 3 files
      const certExt = deathCert!.name.split(".").pop()?.toLowerCase() || "pdf";
      const idExt = idProof!.name.split(".").pop()?.toLowerCase() || "pdf";
      const certPath = `claims/${claimId}/death_certificate.${certExt}`;
      const idPath = `claims/${claimId}/id_proof.${idExt}`;
      const selfiePath = `claims/${claimId}/selfie.jpg`;

      const [certHash, idHash, selfieHash] = await Promise.all([
        sha256Hex(deathCert!),
        sha256Hex(idProof!),
        sha256Hex(selfieBlob!),
      ]);

      const [u1, u2, u3] = await Promise.all([
        supabase.storage.from("medical-documents").upload(certPath, deathCert!, { upsert: true, contentType: deathCert!.type }),
        supabase.storage.from("medical-documents").upload(idPath, idProof!, { upsert: true, contentType: idProof!.type }),
        supabase.storage.from("medical-documents").upload(selfiePath, selfieBlob!, { upsert: true, contentType: "image/jpeg" }),
      ]);
      if (u1.error || u2.error || u3.error) throw (u1.error || u2.error || u3.error);

      const { error: upErr } = await supabase.from("vault_nominee_claims" as any)
        .update({
          death_certificate_url: certPath,
          id_proof_url: idPath,
          selfie_url: selfiePath,
          issuing_authority: issuingAuthority.trim(),
          certificate_number: certificateNumber.trim(),
          date_of_death: dateOfDeath,
          id_type: idType,
          id_number_last4: idLast4,
          nominee_typed_name: typedName.trim(),
          reauth_at: reauthAt,
          file_hashes: { death_cert: certHash, id_proof: idHash, selfie: selfieHash },
          proof_uploaded_at: new Date().toISOString(),
          status: "docs_uploaded",
          user_window_started_at: new Date().toISOString(),
        })
        .eq("id", claimId);
      if (upErr) throw upErr;

      await supabase.functions.invoke("vault-claim-initiated", { body: { claim_id: claimId } });

      toast.success("Claim filed. The user has 7 days to cancel before admin review.");
      setOpen(false);
      resetWizard();
      setClaim({
        id: claimId,
        status: "user_window_open",
        user_window_ends_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      // Rollback orphaned claim row
      if (createdClaimId) {
        await supabase.from("vault_nominee_claims" as any).delete().eq("id", createdClaimId);
      }
      const msg = err?.message || "Failed to submit claim";
      if (msg.includes("30 days")) {
        toast.error("A previous claim was rejected/cancelled within the last 30 days. Try again later.");
      } else if (msg.includes("vault_one_active_claim")) {
        toast.error("An active claim already exists for this ward.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
      setPassword("");
    }
  };

  if (eligible !== true) return null;

  const statusInfo = claim ? STATUS_LABELS[claim.status] : null;
  const claimActive = claim && !["cancelled", "rejected", "released"].includes(claim.status);
  const nominatedDate = guardian?.nominated_at
    ? new Date(guardian.nominated_at).toLocaleDateString("en-IN")
    : "—";

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
            <Button variant="destructive" className="w-full" onClick={() => { resetWizard(); setOpen(true); }}>
              <ShieldAlert className="w-4 h-4 mr-2" /> Report Bereavement & Claim Vault
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) { stopCamera(); resetWizard(); }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vault Claim — Step {step} of 5</DialogTitle>
            <DialogDescription>
              Verified bereavement workflow. The user has 7 days to cancel before admin review.
            </DialogDescription>
          </DialogHeader>

          {/* STEP 1 — Eligibility self-check */}
          {step === 1 && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertDescription className="text-xs space-y-1">
                  <p><strong>Filing falsely is a criminal offence under IPC §191 / §193.</strong></p>
                  <p>Make sure you have verified the death and have the original documents.</p>
                </AlertDescription>
              </Alert>
              <div className="rounded border bg-muted/30 p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Ward:</span> <strong>{wardName}</strong></p>
                <p><span className="text-muted-foreground">You were nominated on:</span> <strong>{nominatedDate}</strong></p>
                <p><span className="text-muted-foreground">Your name on record:</span> <strong>{guardian?.guardian_name}</strong></p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => setStep(2)} disabled={!step1Ready}>
                  {step1Ready ? "I understand — Continue" : "Please read… (5s)"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 2 — Death certificate */}
          {step === 2 && (
            <div className="space-y-3">
              <Label>Death Certificate (PDF/JPG/PNG, 50 KB–10 MB)</Label>
              <Input type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setDeathCert(e.target.files?.[0] || null)} />
              {deathCert && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {deathCert.name} ({(deathCert.size / 1024).toFixed(0)} KB)
                </p>
              )}
              <div className="space-y-2">
                <div>
                  <Label htmlFor="auth" className="text-xs">Issuing Authority</Label>
                  <Input id="auth" value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} placeholder="e.g. Municipal Corporation of Mumbai" />
                </div>
                <div>
                  <Label htmlFor="certno" className="text-xs">Certificate Number</Label>
                  <Input id="certno" value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} placeholder="As printed on the certificate" />
                </div>
                <div>
                  <Label htmlFor="dod" className="text-xs">Date of Death</Label>
                  <Input id="dod" type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfDeath} onChange={(e) => setDateOfDeath(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={!step2Valid}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 3 — Nominee ID */}
          {step === 3 && (
            <div className="space-y-3">
              <Label>Your Government ID Proof</Label>
              <Input type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setIdProof(e.target.files?.[0] || null)} />
              {idProof && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {idProof.name} ({(idProof.size / 1024).toFixed(0)} KB)
                </p>
              )}
              <div>
                <Label className="text-xs">ID Type</Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                    <SelectItem value="voter_id">Voter ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="last4" className="text-xs">Last 4 digits of ID number</Label>
                <Input id="last4" inputMode="numeric" maxLength={4} value={idLast4}
                  onChange={(e) => setIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={() => setStep(4)} disabled={!step3Valid}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 4 — Live selfie */}
          {step === 4 && (
            <div className="space-y-3">
              <Alert>
                <AlertDescription className="text-xs">
                  Take a live selfie holding your uploaded ID next to your face. Uploaded photos are not allowed.
                </AlertDescription>
              </Alert>
              {!selfiePreview ? (
                <div className="space-y-2">
                  {cameraOn ? (
                    <video ref={videoRef} className="w-full rounded bg-black aspect-square object-cover" muted playsInline />
                  ) : (
                    <div className="aspect-square w-full rounded bg-muted flex items-center justify-center">
                      <Camera className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  {!cameraOn ? (
                    <Button type="button" className="w-full" onClick={startCamera}>
                      <Camera className="w-4 h-4 mr-2" /> Start Camera
                    </Button>
                  ) : (
                    <Button type="button" className="w-full" onClick={captureSelfie}>
                      Capture Selfie
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <img src={selfiePreview} alt="Selfie preview" className="w-full rounded aspect-square object-cover" />
                  <div className="flex items-center gap-2 text-xs text-success">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Selfie captured
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={retakeSelfie}>Retake</Button>
                </div>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => { stopCamera(); setStep(3); }}>Back</Button>
                <Button onClick={() => { stopCamera(); setStep(5); }} disabled={!step4Valid}>Next</Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 5 — Sworn declaration */}
          {step === 5 && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  Final step. By submitting, you authorise this claim to be reviewed by Check-iN admins.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox id="ack1" checked={ack1} onCheckedChange={(v) => setAck1(!!v)} />
                  <Label htmlFor="ack1" className="text-xs leading-relaxed">
                    I confirm <strong>{wardName}</strong> has died on <strong>{dateOfDeath || "—"}</strong>.
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="ack2" checked={ack2} onCheckedChange={(v) => setAck2(!!v)} />
                  <Label htmlFor="ack2" className="text-xs leading-relaxed">
                    I confirm I am the nominated person and have uploaded my own ID.
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="ack3" checked={ack3} onCheckedChange={(v) => setAck3(!!v)} />
                  <Label htmlFor="ack3" className="text-xs leading-relaxed">
                    I understand a false claim is a criminal offence and may be referred to the police.
                  </Label>
                </div>
              </div>
              <div>
                <Label htmlFor="typed" className="text-xs">Type your full name (must match nominee record)</Label>
                <Input id="typed" value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={guardian?.guardian_name} />
                {typedName && !typedNameMatches && (
                  <p className="text-xs text-destructive mt-1">Name does not match the nominee record.</p>
                )}
              </div>
              <div>
                <Label htmlFor="pwd" className="text-xs">Re-enter your account password</Label>
                <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep(4)}>Back</Button>
                <Button variant="destructive" onClick={submitClaim} disabled={!step5Valid || submitting}>
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
