import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const RequestSchema = z.object({
  token: z.string().uuid(),
  action: z.enum(["lookup", "accept", "reject"]),
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: "Invalid token or action" }, 400);
    }
    const { token, action } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find guardian record by nomination token
    const { data: guardian, error: findError } = await supabase
      .from("guardians")
      .select("id, user_id, guardian_name, guardian_phone, status, nomination_expires_at")
      .eq("nomination_token", token)
      .single();

    if (findError || !guardian) {
      return jsonResponse({ error: "Nomination not found" }, 404);
    }

    // Check if nomination has expired
    if (guardian.nomination_expires_at && new Date(guardian.nomination_expires_at) < new Date()) {
      // Mark as expired if still pending
      await supabase
        .from("guardians")
        .update({ status: "expired" })
        .eq("id", guardian.id);
      return jsonResponse({ error: "Nomination has expired. Ask your ward to re-send the invite.", status: "expired" }, 400);
    }

    if (action === "lookup") {
      if (guardian.status !== "pending") {
        return jsonResponse({ error: "Nomination already processed", status: guardian.status }, 400);
      }
      return jsonResponse({
        success: true,
        guardian_name: guardian.guardian_name,
        guardian_phone: guardian.guardian_phone,
        status: guardian.status,
        nomination_expires_at: guardian.nomination_expires_at,
      });
    }

    if (guardian.status !== "pending") {
      return jsonResponse({ error: "Nomination already processed", status: guardian.status }, 400);
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";

    const { error: updateError } = await supabase
      .from("guardians")
      .update({ status: newStatus })
      .eq("id", guardian.id);

    if (updateError) {
      return jsonResponse({ error: "Failed to update nomination" }, 500);
    }

    // Notify the ward either way
    if (action === "reject") {
      await supabase.rpc("insert_notification_deduped", {
        p_user_id: guardian.user_id,
        p_title: "Guardian Rejected Nomination",
        p_message: `${guardian.guardian_name} has rejected your guardian nomination.`,
        p_type: "nomination_rejected",
        p_guardian_id: guardian.id,
      });
    } else {
      await supabase.rpc("insert_notification_deduped", {
        p_user_id: guardian.user_id,
        p_title: "Guardian Accepted",
        p_message: `${guardian.guardian_name} has accepted your guardian nomination and is now connected to you.`,
        p_type: "nomination_accepted",
        p_guardian_id: guardian.id,
      });
    }


    return jsonResponse({ success: true, status: newStatus });
  } catch (err) {
    console.error("Error:", err);
    return jsonResponse({ error: "Unable to process nomination" }, 500);
  }
});
