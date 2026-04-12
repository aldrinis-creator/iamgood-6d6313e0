import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guardian_email, guardian_name, guardian_phone, user_name, relation, nomination_token } = await req.json();

    if (!guardian_name || !user_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate-limit: check if invite was sent < 1 hour ago
    if (guardian_email || guardian_phone) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      let query = supabase.from("guardians").select("nominated_at").gte("nominated_at", oneHourAgo);
      if (guardian_email) query = query.eq("guardian_email", guardian_email);
      else query = query.eq("guardian_phone", guardian_phone);

      const { data: recentInvites } = await query;
      if (recentInvites && recentInvites.length > 0) {
        return new Response(
          JSON.stringify({ message: "Invite already sent recently. Please wait before re-sending.", rate_limited: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const relationText = relation ? ` (${relation})` : "";
    const baseUrl = "https://iamgood.lovable.app";
    const acceptLink = nomination_token ? `${baseUrl}/register?nomination=accept&token=${nomination_token}` : `${baseUrl}/register`;
    const rejectLink = nomination_token ? `${baseUrl}/register?nomination=reject&token=${nomination_token}` : "";

    // Send email via transactional email queue
    if (guardian_email) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "guardian-invitation",
            recipientEmail: guardian_email,
            idempotencyKey: `guardian-invite-${guardian_email}-${nomination_token || Date.now()}`,
            templateData: {
              guardianName: guardian_name,
              userName: user_name,
              relation: relationText,
              acceptLink,
              rejectLink,
            },
          },
        });
        console.log("Guardian invitation email queued for:", guardian_email);
      } catch (emailErr) {
        console.error("Email queue error:", emailErr);
      }
    }

    // Send WhatsApp/SMS via MSG91 if phone provided
    if (guardian_phone) {
      const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
      const msg91InviteTemplate = Deno.env.get("MSG91_INVITE_TEMPLATE_ID");
      if (msg91AuthKey && msg91InviteTemplate) {
        const clean = guardian_phone.replace(/[^0-9]/g, "");
        const mobile = clean.startsWith("91") ? clean : `91${clean}`;
        try {
          await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
            body: JSON.stringify({
              template_id: msg91InviteTemplate,
              short_url: "1",
              recipients: [{
                mobiles: mobile,
                guardian_name,
                user_name,
                relation: relationText,
                accept_link: acceptLink,
                reject_link: rejectLink || "",
              }],
            }),
          });
          console.log("MSG91 invite sent to:", mobile);
        } catch (e) {
          console.error("MSG91 invite error:", e);
        }
      } else {
        // Fallback: log WhatsApp link
        const whatsappMsg = encodeURIComponent(
          `🛡️ *Guardian Nomination — Check-iN*\n\nHi ${guardian_name},\n\n*${user_name}*${relationText} has nominated you as their Guardian on Check-iN.\n\n✅ Accept: ${acceptLink}\n${rejectLink ? `❌ Reject: ${rejectLink}\n` : ""}\nCheck-iN — Personal Emergency Response System`
        );
        console.log(`WhatsApp link: https://wa.me/${guardian_phone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`);
      }
    }

    return new Response(
      JSON.stringify({ sent: true }),
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
