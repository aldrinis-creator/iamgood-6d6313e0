/**
 * useVaultReminderScheduler
 *
 * Runs once per app session (per user) and once per day:
 *  1. Reads all `vault_reminder_meta` rows for the user.
 *  2. For any row whose `next_reminder_at <= now()` and `tier != 'done'`,
 *     creates an in-app notification via `insert_notification_deduped` RPC,
 *     then advances the row to the next tier (7d → 3d → 24h → due → done,
 *     or quarterly for will reviews).
 *
 * The shadow `vault_reminder_meta` table contains only non-sensitive labels
 * (e.g. "Health Insurance · HDFC Ergo") so reminders fire without ever
 * needing the user's vault PIN.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ReminderRow = {
  id: string;
  user_id: string;
  doc_id: string;
  kind: "insurance_renewal" | "insurance_expiry" | "will_review";
  display_label: string;
  next_reminder_at: string;
  tier: "7d" | "3d" | "24h" | "due" | "done" | "quarterly";
  target_date: string | null;
};

function nextInsuranceTier(currentTier: ReminderRow["tier"], targetISO: string | null) {
  if (!targetISO) return { tier: "done" as const, fireAt: new Date(Date.now() + 365 * ONE_DAY_MS) };
  const target = new Date(targetISO);
  switch (currentTier) {
    case "7d":
      return { tier: "3d" as const, fireAt: new Date(target.getTime() - 3 * ONE_DAY_MS) };
    case "3d":
      return { tier: "24h" as const, fireAt: new Date(target.getTime() - ONE_DAY_MS) };
    case "24h":
      return { tier: "due" as const, fireAt: target };
    default:
      return { tier: "done" as const, fireAt: new Date(target.getTime() + 365 * ONE_DAY_MS) };
  }
}

export function useVaultReminderScheduler() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;
    const now = Date.now();
    // throttle: at most every 6 hours per session
    if (now - lastRunRef.current < 6 * 60 * 60 * 1000) return;
    lastRunRef.current = now;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vault_reminder_meta" as any)
        .select("*")
        .eq("user_id", userId)
        .neq("tier", "done")
        .lte("next_reminder_at", new Date().toISOString());
      if (cancelled || error || !data) return;

      for (const row of data as unknown as ReminderRow[]) {
        const title =
          row.kind === "will_review"
            ? "Quarterly Will Review"
            : row.kind === "insurance_renewal"
              ? "Insurance Renewal Due"
              : "Insurance Expiry";

        const message =
          row.kind === "will_review"
            ? `Review your Will (${row.display_label}) — confirm if any changes are needed.`
            : `${row.display_label} ${row.kind === "insurance_renewal" ? "renews" : "expires"} on ${row.target_date ? new Date(row.target_date).toLocaleDateString("en-IN") : "soon"}. Open Medical Vault to review.`;

        await supabase.rpc("insert_notification_deduped", {
          p_user_id: userId,
          p_title: title,
          p_message: message,
          p_type: row.kind === "will_review" ? "will_review" : "insurance_reminder",
          p_guardian_id: null,
        });

        let nextTier: ReminderRow["tier"];
        let nextFire: Date;
        if (row.kind === "will_review") {
          nextTier = "quarterly";
          nextFire = new Date(Date.now() + 90 * ONE_DAY_MS);
        } else {
          const next = nextInsuranceTier(row.tier, row.target_date);
          nextTier = next.tier;
          nextFire = next.fireAt;
        }

        await supabase
          .from("vault_reminder_meta" as any)
          .update({ tier: nextTier, next_reminder_at: nextFire.toISOString() })
          .eq("id", row.id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
