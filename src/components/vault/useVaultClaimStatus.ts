/**
 * Shared hook used by both the Guardian Dashboard (slim status strip) and
 * Guardian Services (Vault Nominee Access tile) so both reads share the
 * same eligibility + latest-claim state for a given ward.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface VaultClaim {
  id: string;
  status: string;
  user_window_ends_at: string | null;
  created_at: string;
  reject_reason?: string | null;
}

export interface VaultClaimStatus {
  loading: boolean;
  eligible: boolean;
  claim: VaultClaim | null;
}

export function useVaultClaimStatus(wardUserId: string | null | undefined): VaultClaimStatus {
  const { session } = useAuth();
  const [state, setState] = useState<VaultClaimStatus>({ loading: true, eligible: false, claim: null });

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id || !wardUserId) {
      setState({ loading: false, eligible: false, claim: null });
      return;
    }
    (async () => {
      const { data: g } = await supabase
        .from("guardians")
        .select("id, is_vault_nominee, status")
        .eq("user_id", wardUserId)
        .eq("guardian_user_id", session.user.id)
        .eq("status", "accepted")
        .maybeSingle();
      const eligible = !!(g as any)?.is_vault_nominee;
      let claim: VaultClaim | null = null;
      if (eligible) {
        const { data: c } = await supabase
          .from("vault_nominee_claims" as any)
          .select("id, status, user_window_ends_at, created_at, reject_reason")
          .eq("user_id", wardUserId)
          .eq("guardian_id", (g as any).id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        claim = (c as unknown as VaultClaim) || null;
      }
      if (!cancelled) setState({ loading: false, eligible, claim });
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id, wardUserId]);

  return state;
}

export const ACTIVE_CLAIM_STATUSES = ["initiated", "docs_uploaded", "user_window_open"];
