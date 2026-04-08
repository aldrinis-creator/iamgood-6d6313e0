import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action } = await req.json();

    if (!token || !["accept", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid token or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find guardian record by nomination token
    const { data: guardian, error: findError } = await supabase
      .from("guardians")
      .select("id, user_id, guardian_name, status, nomination_expires_at")
      .eq("nomination_token", token)
      .single();

    if (findError || !guardian) {
      return new Response(
        JSON.stringify({ error: "Nomination not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (guardian.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Nomination already processed", status: guardian.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";

    const { error: updateError } = await supabase
      .from("guardians")
      .update({ status: newStatus })
      .eq("id", guardian.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update nomination" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If rejected, create notification for the User
    if (action === "reject") {
      await supabase.rpc("insert_notification_deduped", {
        p_user_id: guardian.user_id,
        p_title: "Guardian Rejected Nomination",
        p_message: `${guardian.guardian_name} has rejected your guardian nomination.`,
        p_type: "nomination_rejected",
        p_guardian_id: guardian.id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
