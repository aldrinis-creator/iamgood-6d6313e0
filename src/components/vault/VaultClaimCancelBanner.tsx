/**
 * Full-width banner shown to a logged-in user during the 7-day grace
 * window of an open Vault Nominee Claim. Lets them cancel the claim,
 * which sets status='cancelled' and notifies admin + nominee.
 */
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Claim {
  id: string;
  guardian_id: string;
  user_window_ends_at: string | null;
  status: string;
}

const VaultClaimCancelBanner = () => {
  const { session } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [guardianName, setGuardianName] = useState<string>("a guardian");
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("vault_nominee_claims" as any)
      .select("id, guardian_id, user_window_ends_at, status")
      .eq("user_id", session.user.id)
      .in("status", ["docs_uploaded", "user_window_open"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setClaim(data as unknown as Claim);
      const { data: g } = await supabase
        .from("guardians")
        .select("guardian_name")
        .eq("id", (data as any).guardian_id)
        .maybeSingle();
      if (g) setGuardianName((g as any).guardian_name);
    } else {
      setClaim(null);
    }
  };

  useEffect(() => { load(); }, [session?.user?.id]);

  if (!claim) return null;

  const cancel = async () => {
    if (!confirm("Cancel this claim? This will stop the Vault release.")) return;
    setCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("vault-cancel-claim", {
        body: { claim_id: claim.id },
      });
      if (error) throw error;
      toast.success("Claim cancelled");
      setClaim(null);
    } catch (err: any) {
      toast.error(err?.message || "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  const endsAt = claim.user_window_ends_at ? new Date(claim.user_window_ends_at) : null;

  return (
    <Alert variant="destructive" className="mb-4">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Vault Claim Filed</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-xs">
          {guardianName} has filed a Vault Nominee claim. If this is incorrect, cancel below.
          {endsAt && ` Window ends ${endsAt.toLocaleString("en-IN")}.`}
        </p>
        <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling}>
          {cancelling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Cancel Claim
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default VaultClaimCancelBanner;
