import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const { user_id, medication_name, status, scheduled_time } = await req.json();

    if (!user_id || !medication_name || !status) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user_id)
      .maybeSingle();

    const userName = profile?.full_name || "Your ward";

    // Get guardians
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id, guardian_name, guardian_phone")
      .eq("user_id", user_id);

    if (!guardians || guardians.length === 0) {
      return new Response(JSON.stringify({ message: "No guardians" }), { headers: corsHeaders });
    }

    const timeLabel = scheduled_time
      ? new Date(scheduled_time).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
      : "";

    // Current IST timestamp
    const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
    const istNow = new Date(istMs);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const istDay = istNow.getUTCDate();
    const istMonth = months[istNow.getUTCMonth()];
    const istYear = istNow.getUTCFullYear();
    const istH = istNow.getUTCHours();
    const istM = istNow.getUTCMinutes();
    const istPeriod = istH >= 12 ? "PM" : "AM";
    const istDisplayH = istH % 12 || 12;
    const istTimestamp = `${istDay} ${istMonth} ${istYear}, ${istDisplayH}:${String(istM).padStart(2,"0")} ${istPeriod}`;

    const statusLabel = status === "taken" ? "✅ taken" : status === "taken_late" ? "⏰ taken late" : status === "skipped" ? "⏭️ skipped" : "❌ not taken";
    const title = `Medication ${status === "taken" ? "Taken" : status === "taken_late" ? "Taken Late" : "Missed"}`;
    const message = `[${istTimestamp}] ${userName} has ${statusLabel} their ${medication_name}${timeLabel ? ` (${timeLabel})` : ""}.`;
    const notificationType = status === "taken" ? "medication_taken" : status === "taken_late" ? "medication_taken_late" : "medication_missed";
    const isMissed = status !== "taken" && status !== "taken_late";

    if (isMissed && scheduled_time) {
      const scheduledDate = new Date(scheduled_time);
      const isVeryLate = scheduledDate.getTime() < now.getTime() - (65 * 60 * 1000); // > 65 minutes
      
      if (isVeryLate) {
        console.log(`Medication alert is >65 mins late, skipping missed alert for ${user_id}`);
        return new Response(JSON.stringify({ message: "Medication is very late, skipping missed alert" }), { headers: corsHeaders });
      }

      // Verify if the medications were already taken
      const medNameList = medication_name.split(",").map((n: string) => n.trim());
      const { data: medsData } = await supabase
        .from("medications")
        .select("id")
        .eq("user_id", user_id)
        .in("name", medNameList);

      if (medsData && medsData.length > 0) {
        const medIds = medsData.map(m => m.id);
        const slotStart = new Date(scheduledDate);
        slotStart.setSeconds(0, 0);
        const slotEnd = new Date(slotStart.getTime() + 60000);

        const { data: existingLogs } = await supabase
          .from("medication_logs")
          .select("id, medication_id")
          .in("medication_id", medIds)
          .eq("user_id", user_id)
          .gte("scheduled_at", slotStart.toISOString())
          .lt("scheduled_at", slotEnd.toISOString())
          .in("status", ["taken", "taken_late"]);

        // If the number of taken logs is greater than or equal to the medications requested, skip alert
        if (existingLogs && existingLogs.length >= medIds.length) {
          console.log(`Medications already taken, skipping missed alert for ${user_id}`);
          return new Response(JSON.stringify({ message: "Medications already taken, skipping missed alert" }), { headers: corsHeaders });
        }
      }
    }

    // For missed notifications, check each guardian's preference
    const eligibleGuardians = [];
    for (const g of guardians) {
      if (isMissed) {
        // Find guardian's user ID via phone match
        const { data: guardianProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", g.guardian_phone)
          .maybeSingle();

        if (guardianProfile) {
          // Check guardian's settings for medicationMissedNotify
          const { data: settingsRow } = await supabase
            .from("user_settings")
            .select("settings")
            .eq("user_id", guardianProfile.id)
            .maybeSingle();

          const guardianSettings = settingsRow?.settings as Record<string, unknown> | null;
          // Default is true if not set
          if (guardianSettings?.medicationMissedNotify === false) {
            continue; // Skip this guardian
          }
        }
      }
      eligibleGuardians.push(g);
    }

    if (eligibleGuardians.length === 0) {
      return new Response(JSON.stringify({ message: "All guardians opted out" }), { headers: corsHeaders });
    }

    // Insert notifications for eligible guardians
    const notifications = eligibleGuardians.map((g) => ({
      user_id,
      guardian_id: g.id,
      title,
      message,
      type: notificationType,
      read: false,
    }));

    await supabase.rpc("insert_notifications_deduped", { p_notifications: notifications });

    // MSG91 WhatsApp notification for medication
    const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
    const msg91MedTemplate = Deno.env.get("MSG91_MED_TEMPLATE_ID");
    if (msg91AuthKey && msg91MedTemplate) {
      const recipientsRaw = eligibleGuardians
        .filter((g: any) => g.guardian_phone)
        .map((g: any) => {
          const clean = g.guardian_phone.replace(/[^0-9]/g, "");
          const mobile = clean.startsWith("91") ? clean : `91${clean}`;
          return { mobiles: mobile, user_name: userName, medication_name, status: statusLabel, message };
        });

      // Deduplicate by phone number to prevent multiple SMS to the same number
      const recipients = [...new Map(recipientsRaw.map((r: any) => [r.mobiles, r])).values()];

      if (recipients.length > 0) {
        try {
          await fetch("https://control.msg91.com/api/v5/flow", {
            method: "POST",
            headers: { "Content-Type": "application/json", authkey: msg91AuthKey },
            body: JSON.stringify({ template_id: msg91MedTemplate, short_url: "0", recipients }),
          });
        } catch (e) {
          console.error("MSG91 medication alert error:", e);
        }
      }
    }

    // Send push notifications to guardian devices
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (vapidPrivateKey) {
      for (const g of eligibleGuardians) {
        const { data: guardianProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", g.guardian_phone)
          .maybeSingle();

        if (!guardianProfile) continue;

        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", guardianProfile.id);

        if (!subs || subs.length === 0) continue;

        for (const sub of subs) {
          try {
            const payload = JSON.stringify({ title, body: message, icon: "/placeholder.svg" });
            // Note: Full VAPID push implementation would go here
          } catch {
            // push failed, continue
          }
        }
      }
    }

    return new Response(JSON.stringify({ sent: eligibleGuardians.length }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
