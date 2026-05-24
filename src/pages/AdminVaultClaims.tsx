/**
 * Admin queue for vault nominee claims whose 7-day grace window has
 * expired without cancellation. Admin can Release (issuing a 24h portal
 * link to the nominee) or Reject (with reason).
 */
import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ShieldAlert, FileText, CheckCircle2, XCircle, Loader2, ExternalLink, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ClaimRow {
  id: string;
  user_id: string;
  guardian_id: string;
  status: string;
  death_certificate_url: string | null;
  id_proof_url: string | null;
  selfie_url: string | null;
  user_window_ends_at: string | null;
  created_at: string;
  reject_reason: string | null;
  issuing_authority: string | null;
  certificate_number: string | null;
  date_of_death: string | null;
  id_type: string | null;
  id_number_last4: string | null;
  nominee_typed_name: string | null;
  reauth_at: string | null;
}

interface ActivitySignals {
  last_sign_in_at: string | null;
  last_check_in_at: string | null;
  last_journey_at: string | null;
}

const STATUS_TONES: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  docs_uploaded: "secondary",
  user_window_open: "outline",
  released: "default",
  rejected: "destructive",
  cancelled: "destructive",
};

const AdminVaultClaims = () => {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { name: string; phone: string | null }>>({});
  const [guardians, setGuardians] = useState<Record<string, { name: string; phone: string; email: string | null }>>({});
  const [activity, setActivity] = useState<Record<string, ActivitySignals>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [releaseTyped, setReleaseTyped] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vault_nominee_claims" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load claims");
      setLoading(false);
      return;
    }
    const rows = (data || []) as unknown as ClaimRow[];
    setClaims(rows);

    if (rows.length) {
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const guardianIds = [...new Set(rows.map((r) => r.guardian_id))];
      const [{ data: ps }, { data: gs }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, last_active_at").in("id", userIds),
        supabase.from("guardians").select("id, guardian_name, guardian_phone, guardian_email").in("id", guardianIds),
      ]);
      const pmap: typeof profiles = {};
      (ps || []).forEach((p: any) => { pmap[p.id] = { name: p.full_name, phone: p.phone }; });
      setProfiles(pmap);
      const gmap: typeof guardians = {};
      (gs || []).forEach((g: any) => { gmap[g.id] = { name: g.guardian_name, phone: g.guardian_phone, email: g.guardian_email }; });
      setGuardians(gmap);

      // Activity signals: last check-in, last journey
      const amap: Record<string, ActivitySignals> = {};
      await Promise.all(userIds.map(async (uid) => {
        const [{ data: ci }, { data: jr }] = await Promise.all([
          supabase.from("check_ins").select("created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("journeys").select("created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        amap[uid] = {
          last_sign_in_at: (ps || []).find((p: any) => p.id === uid)?.last_active_at || null,
          last_check_in_at: ci?.created_at || null,
          last_journey_at: jr?.created_at || null,
        };
      }));
      setActivity(amap);

      // Signed thumbnail URLs for selfie + ID + cert
      const urlMap: Record<string, string> = {};
      await Promise.all(rows.flatMap((r) => [
        r.selfie_url, r.id_proof_url, r.death_certificate_url,
      ]).filter(Boolean).map(async (path) => {
        const { data } = await supabase.storage.from("medical-documents").createSignedUrl(path!, 600);
        if (data?.signedUrl) urlMap[path!] = data.signedUrl;
      }));
      setSignedUrls(urlMap);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const viewFile = async (path: string) => {
    const url = signedUrls[path];
    if (url) { window.open(url, "_blank", "noopener"); return; }
    const { data } = await supabase.storage.from("medical-documents").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  const openRelease = (claimId: string) => {
    setReleaseId(claimId);
    setReleaseConfirmed(false);
    setReleaseTyped("");
    setReleaseNotes("");
  };

  const confirmRelease = async () => {
    if (!releaseId) return;
    if (!releaseConfirmed || releaseTyped !== "RELEASE" || !releaseNotes.trim()) {
      toast.error("Complete all confirmations");
      return;
    }
    setBusyId(releaseId);
    try {
      const stepUp = sessionStorage.getItem("admin_step_up_token") || "";
      const { error } = await supabase.functions.invoke("vault-release-claim", {
        body: { claim_id: releaseId, release_notes: releaseNotes.trim() },
        headers: { "x-admin-step-up": stepUp },
      });
      if (error) throw error;
      toast.success("Released — nominee notified");
      setReleaseId(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Release failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error("Provide a reason"); return; }
    setBusyId(rejectId);
    try {
      const { error } = await supabase
        .from("vault_nominee_claims" as any)
        .update({ status: "rejected", reject_reason: rejectReason.trim(), rejected_at: new Date().toISOString() })
        .eq("id", rejectId);
      if (error) throw error;
      toast.success("Claim rejected");
      setRejectId(null);
      setRejectReason("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <h1 className="text-2xl font-bold">Vault Nominee Claims</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Review death-certificate-backed Vault claims after the 7-day user grace window has elapsed.
        </p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : claims.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No claims yet.</CardContent></Card>
        ) : (
          claims.map((c) => {
            const p = profiles[c.user_id];
            const g = guardians[c.guardian_id];
            const windowEnded = c.user_window_ends_at ? new Date(c.user_window_ends_at) <= new Date() : false;
            const canAct = c.status === "user_window_open" || c.status === "docs_uploaded";
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{p?.name || "Unknown"} <span className="text-xs text-muted-foreground">({c.user_id.slice(0, 8)}…)</span></CardTitle>
                      <p className="text-xs text-muted-foreground">Nominee: {g?.name || "—"} • {g?.phone || ""}</p>
                    </div>
                    <Badge variant={STATUS_TONES[c.status] || "secondary"}>{c.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Filed</p>
                      <p>{new Date(c.created_at).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Window ends</p>
                      <p>{c.user_window_ends_at ? new Date(c.user_window_ends_at).toLocaleString("en-IN") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date of death</p>
                      <p>{c.date_of_death || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Certificate #</p>
                      <p className="truncate">{c.certificate_number || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Issuing authority</p>
                      <p>{c.issuing_authority || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nominee ID</p>
                      <p>{c.id_type || "—"} •••• {c.id_number_last4 || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Typed name</p>
                      <p>{c.nominee_typed_name || "—"}</p>
                    </div>
                  </div>

                  <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                    <p className="font-medium flex items-center gap-1"><Activity className="w-3 h-3" /> User activity signals</p>
                    <p>Last sign-in: <strong>{activity[c.user_id]?.last_sign_in_at ? new Date(activity[c.user_id].last_sign_in_at!).toLocaleString("en-IN") : "—"}</strong></p>
                    <p>Last check-in: <strong>{activity[c.user_id]?.last_check_in_at ? new Date(activity[c.user_id].last_check_in_at!).toLocaleString("en-IN") : "—"}</strong></p>
                    <p>Last journey: <strong>{activity[c.user_id]?.last_journey_at ? new Date(activity[c.user_id].last_journey_at!).toLocaleString("en-IN") : "—"}</strong></p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {c.selfie_url && signedUrls[c.selfie_url] && (
                      <button onClick={() => viewFile(c.selfie_url!)} className="rounded border overflow-hidden aspect-square hover:opacity-80">
                        <img src={signedUrls[c.selfie_url]} alt="Selfie" className="w-full h-full object-cover" />
                        <p className="text-[10px] text-center bg-muted py-0.5">Selfie</p>
                      </button>
                    )}
                    {c.id_proof_url && signedUrls[c.id_proof_url] && (
                      <button onClick={() => viewFile(c.id_proof_url!)} className="rounded border overflow-hidden aspect-square hover:opacity-80">
                        <img src={signedUrls[c.id_proof_url]} alt="ID" className="w-full h-full object-cover" />
                        <p className="text-[10px] text-center bg-muted py-0.5">ID Proof</p>
                      </button>
                    )}
                    {c.death_certificate_url && (
                      <button onClick={() => viewFile(c.death_certificate_url!)} className="rounded border overflow-hidden aspect-square hover:opacity-80 flex flex-col items-center justify-center bg-muted">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                        <p className="text-[10px] mt-1">Death Cert</p>
                        <ExternalLink className="w-3 h-3 mt-1" />
                      </button>
                    )}
                  </div>

                  {c.reject_reason && (
                    <p className="text-xs text-destructive">Reject reason: {c.reject_reason}</p>
                  )}
                  {canAct && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="default" onClick={() => openRelease(c.id)} disabled={!windowEnded || busyId === c.id}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Release
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectId(c.id)} disabled={busyId === c.id}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                      {!windowEnded && <span className="text-xs text-muted-foreground self-center">Wait until grace window ends</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim</DialogTitle>
            <DialogDescription>Provide a reason. Nominee and admin audit log will record this.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Death certificate appears altered" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim()}>Reject Claim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!releaseId} onOpenChange={(o) => { if (!o) setReleaseId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Vault to Nominee</DialogTitle>
            <DialogDescription>
              This issues a 24-hour one-time portal link to the nominee. This action is logged and irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox id="legible" checked={releaseConfirmed} onCheckedChange={(v) => setReleaseConfirmed(!!v)} />
              <Label htmlFor="legible" className="text-xs leading-relaxed">
                Documents are legible and consistent (death certificate, nominee ID, selfie).
              </Label>
            </div>
            <div>
              <Label htmlFor="confirm" className="text-xs">Type <strong>RELEASE</strong> to confirm</Label>
              <Input id="confirm" value={releaseTyped} onChange={(e) => setReleaseTyped(e.target.value)} placeholder="RELEASE" />
            </div>
            <div>
              <Label htmlFor="notes" className="text-xs">Release notes (audit trail)</Label>
              <Textarea id="notes" value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="e.g. Verified certificate against state registry, ID matches nominee on record." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReleaseId(null)}>Cancel</Button>
            <Button
              variant="default"
              onClick={confirmRelease}
              disabled={!releaseConfirmed || releaseTyped !== "RELEASE" || !releaseNotes.trim() || busyId === releaseId}
            >
              {busyId === releaseId ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminVaultClaims;
