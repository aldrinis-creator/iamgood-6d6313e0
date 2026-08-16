import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

export type InviteChannels = {
  email?: "sent" | "failed" | "skipped";
  sms?: "sent" | "failed" | "skipped";
  whatsapp?: "sent" | "failed" | "skipped";
  rate_limited?: boolean;
};

type GuardianInviteInput = {
  guardian_name: string;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  relation?: string | null;
  user_name: string;
  nomination_token?: string | null;
};

function describe(res: InviteChannels | null): string {
  if (!res) return "";
  const ok: string[] = [];
  if (res.email === "sent") ok.push("email");
  if (res.whatsapp === "sent") ok.push("WhatsApp");
  if (res.sms === "sent") ok.push("SMS");
  return ok.length ? `Invite sent by ${ok.join(" and ")}.` : "";
}

/** Invoke the invite edge function and surface the per-channel outcome. */
export async function sendGuardianInvite(
  input: GuardianInviteInput,
  opts: { silent?: boolean } = {}
): Promise<InviteChannels | null> {
  try {
    const { data, error } = await supabase.functions.invoke("send-guardian-invite", {
      body: input,
    });
    if (error) throw error;
    const res = (data || {}) as InviteChannels;
    if (!opts.silent) {
      if (res.rate_limited) {
        toast.info("Invite was already sent recently. Please wait before re-sending.");
      } else {
        const msg = describe(res);
        if (msg) toast.success(msg);
        else toast.error("Could not deliver the invite. Check the guardian's phone/email.");
      }
    }
    return res;
  } catch (e) {
    console.error("send-guardian-invite failed:", e);
    if (!opts.silent) toast.error("Guardian saved, but the invite could not be sent. Try 'Re-send invite'.");
    return null;
  }
}

/**
 * Insert a guardian and immediately dispatch the nomination invite with the
 * real nomination token, so the accept/reject links actually work.
 */
export async function addGuardianWithInvite(params: {
  userId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  relation?: string | null;
  isPrimary: boolean;
  userName: string;
}): Promise<{ error: unknown | null }> {
  const { data, error } = await supabase
    .from("guardians")
    .insert({
      user_id: params.userId,
      guardian_name: params.guardianName.trim(),
      guardian_phone: params.guardianPhone.trim(),
      guardian_email: params.guardianEmail?.trim() || null,
      relation: params.relation?.trim() || null,
      is_primary: params.isPrimary,
      status: "pending",
      nominated_at: new Date().toISOString(),
    })
    .select("id, nomination_token")
    .single();

  if (error) return { error };

  await sendGuardianInvite({
    guardian_name: params.guardianName.trim(),
    guardian_phone: params.guardianPhone.trim(),
    guardian_email: params.guardianEmail?.trim() || null,
    relation: params.relation?.trim() || null,
    user_name: params.userName,
    nomination_token: (data as { nomination_token?: string } | null)?.nomination_token ?? null,
  });

  return { error: null };
}

/** Re-send the invite for an existing guardian row (fetches its live token). */
export async function resendGuardianInvite(
  guardianId: string,
  userName: string
): Promise<void> {
  const { data, error } = await supabase
    .from("guardians")
    .select("guardian_name, guardian_phone, guardian_email, relation, nomination_token")
    .eq("id", guardianId)
    .maybeSingle();

  if (error || !data) {
    toast.error("Could not load guardian details");
    return;
  }

  await sendGuardianInvite({
    guardian_name: data.guardian_name,
    guardian_phone: data.guardian_phone,
    guardian_email: data.guardian_email,
    relation: data.relation,
    user_name: userName,
    nomination_token: (data as { nomination_token?: string }).nomination_token ?? null,
  });
}

/** Make one guardian the Primary Guardian, demoting the current primary. */
export async function setPrimaryGuardian(
  userId: string,
  guardianId: string
): Promise<boolean> {
  const { error: clearErr } = await supabase
    .from("guardians")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("is_primary", true);
  if (clearErr) {
    toast.error("Failed to update primary guardian");
    return false;
  }
  const { error: setErr } = await supabase
    .from("guardians")
    .update({ is_primary: true })
    .eq("id", guardianId);
  if (setErr) {
    toast.error("Failed to update primary guardian");
    return false;
  }
  toast.success("Primary guardian updated");
  return true;
}
