// vault-claim-initiated: Hardened verification + multi-channel notifications
// for a Vault Nominee Claim. Performs file-presence verification, activity
// cross-checks (auto-rejects if user signed in within last 24h, or if DOB > DOD),
// notifies user via in-app + email + SMS, cross-notifies all other guardians,
// logs to admin_audit_log, and advances status to user_window_open.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { claim_id } = await req.json();
    if (!claim_id) return json({ error: "claim_id required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claim, error: claimErr } = await supa
      .from("vault_nominee_claims")
      .select("*")
      .eq("id", claim_id)
      .single();
    if (claimErr || !claim) return json({ error: "claim not found" }, 404);

    const userId = claim.user_id;

    // ─── 1. Verify all 3 storage paths exist with non-zero size ───
    const expectedFiles = [
      { key: "death_certificate_url", path: claim.death_certificate_url },
      { key: "id_proof_url", path: claim.id_proof_url },
      { key: "selfie_url", path: claim.selfie_url },
    ];
    for (const f of expectedFiles) {
      if (!f.path) {
        await rejectClaim(supa, claim_id, `Missing required file: ${f.key}`);
        return json({ error: `missing ${f.key}`, rejected: true }, 200);
      }
      const folder = f.path.split("/").slice(0, -1).join("/");
      const name = f.path.split("/").pop()!;
      const { data: list } = await supa.storage.from("medical-documents").list(folder);
      const found = (list || []).find((o: any) => o.name === name);
      if (!found || !((found.metadata?.size ?? 0) > 0)) {
        await rejectClaim(supa, claim_id, `File missing or empty: ${f.key}`);
        return json({ error: `file missing ${f.key}`, rejected: true }, 200);
      }
    }

    // ─── 2. Cross-check: auto-reject if user signed in within last 24h ───
    const { data: authUser } = await supa.auth.admin.getUserById(userId);
    const lastSignIn = authUser?.user?.last_sign_in_at
      ? new Date(authUser.user.last_sign_in_at)
      : null;
    if (lastSignIn && Date.now() - lastSignIn.getTime() < 24 * 60 * 60 * 1000) {
      await rejectClaim(
        supa, claim_id,
        `User active within 24h of claim (last sign-in ${lastSignIn.toISOString()}) — likely false report`,
      );
      await notifyAllParties(supa, claim, userId, "Vault Claim Auto-Rejected",
        "A bereavement claim was filed against your account but rejected automatically because you were active in the last 24 hours.");
      return json({ ok: true, rejected: true, reason: "user_active_24h" });
    }

    // ─── 3. Cross-check: DOB <= DOD ───
    const { data: prof } = await supa.from("profiles")
      .select("full_name, phone, date_of_birth").eq("id", userId).maybeSingle();
    if (prof?.date_of_birth && claim.date_of_death) {
      const dob = new Date(prof.date_of_birth);
      const dod = new Date(claim.date_of_death);
      if (dod < dob) {
        await rejectClaim(supa, claim_id, `Date of death (${claim.date_of_death}) precedes date of birth (${prof.date_of_birth})`);
        return json({ ok: true, rejected: true, reason: "dod_before_dob" });
      }
    }

    // ─── 4. Multi-channel notify deceased user ───
    await notifyAllParties(
      supa, claim, userId,
      "Vault Claim Filed Against Your Account",
      "A Vault Nominee claim has been filed. If you receive this, log in within 7 days to cancel before release. If this is unexpected, contact support immediately.",
    );

    // ─── 5. Cross-notify all OTHER guardians ───
    const { data: otherGuards } = await supa
      .from("guardians")
      .select("id, guardian_user_id, guardian_name")
      .eq("user_id", userId)
      .eq("status", "accepted")
      .neq("id", claim.guardian_id);

    for (const og of otherGuards || []) {
      if (!og.guardian_user_id) continue;
      await supa.rpc("insert_notification_deduped", {
        p_user_id: og.guardian_user_id,
        p_title: "Vault Claim Notification",
        p_message: "Another guardian has filed a Vault Nominee claim. Please verify with family.",
        p_type: "vault_claim_notice",
        p_guardian_id: claim.guardian_id,
      });
    }

    // ─── 6. Advance status to user_window_open ───
    await supa.from("vault_nominee_claims")
      .update({ status: "user_window_open" })
      .eq("id", claim_id);

    // ─── 7. Admin audit log + admin contact submission ───
    await supa.from("admin_audit_log").insert({
      action: "vault_claim_filed",
      metadata: {
        claim_id,
        user_id: userId,
        guardian_id: claim.guardian_id,
        date_of_death: claim.date_of_death,
        certificate_number: claim.certificate_number,
        issuing_authority: claim.issuing_authority,
        id_type: claim.id_type,
        id_number_last4: claim.id_number_last4,
        nominee_typed_name: claim.nominee_typed_name,
        file_hashes: claim.file_hashes,
      },
    });

    await supa.from("contact_submissions").insert({
      full_name: prof?.full_name || "User",
      email: "system@check-in.app",
      phone: prof?.phone || null,
      subject: "Vault claim review needed",
      message: `Vault claim ${claim_id} filed for user ${userId}. Window ends ${claim.user_window_ends_at}. DOD: ${claim.date_of_death}, Cert#: ${claim.certificate_number}.`,
      source: "vault-claim",
      status: "new",
      user_id: userId,
    });

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function rejectClaim(supa: any, claimId: string, reason: string) {
  await supa.from("vault_nominee_claims")
    .update({ status: "rejected", reject_reason: reason, rejected_at: new Date().toISOString() })
    .eq("id", claimId);
  await supa.from("admin_audit_log").insert({
    action: "vault_claim_auto_rejected",
    metadata: { claim_id: claimId, reason },
  });
}

async function notifyAllParties(supa: any, claim: any, userId: string, title: string, message: string) {
  // In-app
  await supa.rpc("insert_notification_deduped", {
    p_user_id: userId,
    p_title: title,
    p_message: message,
    p_type: "vault_claim",
    p_guardian_id: claim.guardian_id,
  });

  // Email + SMS via existing infra (best effort, swallow errors)
  const { data: prof } = await supa.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
  const { data: authUser } = await supa.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;

  if (email) {
    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          to: email,
          template: "generic_alert",
          subject: title,
          data: { name: prof?.full_name || "there", title, message },
        },
      });
    } catch (_) { /* swallow */ }
  }

  if (prof?.phone) {
    try {
      await supa.functions.invoke("msg91-send", {
        body: {
          phone: prof.phone,
          message: `${title}: ${message}`,
          template_id: Deno.env.get("MSG91_SOS_SMS_TEMPLATE_ID"),
        },
      });
    } catch (_) { /* swallow */ }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
