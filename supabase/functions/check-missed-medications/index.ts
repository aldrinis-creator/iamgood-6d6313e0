import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate, normalizeIndianPhone } from "../_shared/msg91Whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Runs every ~5 minutes. For every medication_logs row that is `missed`,
// at least 60 minutes past its scheduled time, in today's IST window, and
// not yet WhatsApp-alerted, send ONE consolidated WhatsApp message per
// (user, scheduled_hour) to the user and a single message to all guardians
// covering every medication in that slot. Stamp `whatsapp_alerted_at` so we
// never resend.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: accept cron (service-role bearer) OR a valid user JWT (client escalation fallback)
    const authHeader = req.headers.get("Authorization") || "";
    const isCron = authHeader === `Bearer ${serviceRoleKey}`;
    if (!isCron) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);


    const now = new Date();
    const graceCutoff = new Date(now.getTime() - 60 * 60 * 1000); // T+60m

    // IST day window
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const istMidnight = new Date(istNow);
    istMidnight.setUTCHours(0, 0, 0, 0);
    const todayStartUTC = new Date(istMidnight.getTime() - istOffsetMs);
    const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000 - 1);

    // ── Server-side medication missed pre-population ──
    // Get all active medications
    const { data: activeMeds, error: medError } = await supabase
      .from("medications")
      .select("id, user_id, name, schedule_times")
      .eq("alarm_enabled", true);

    if (medError) {
      console.error("Error fetching medications for pre-population:", medError);
    } else if (activeMeds && activeMeds.length > 0) {
      // Get all existing logs for today
      const { data: existingLogs, error: logsError } = await supabase
        .from("medication_logs")
        .select("medication_id, scheduled_at")
        .gte("scheduled_at", todayStartUTC.toISOString())
        .lte("scheduled_at", todayEndUTC.toISOString());

      if (logsError) {
        console.error("Error fetching medication logs for pre-population:", logsError);
      } else {
        const existingLogsMap = new Set<string>();
        if (existingLogs) {
          for (const log of existingLogs) {
            const d = new Date(log.scheduled_at);
            const key = `${log.medication_id}-${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
            existingLogsMap.add(key);
          }
        }

        const logsToInsert = [];
        for (const med of activeMeds) {
          for (const timeStr of med.schedule_times) {
            const [h, m] = timeStr.split(":").map(Number);
            const slotIST = new Date(istMidnight);
            slotIST.setUTCHours(h, m || 0, 0, 0);
            const slotUTC = new Date(slotIST.getTime() - istOffsetMs);

            if (slotUTC < graceCutoff) {
              const key = `${med.id}-${slotUTC.getUTCFullYear()}-${slotUTC.getUTCMonth()}-${slotUTC.getUTCDate()}-${slotUTC.getUTCHours()}-${slotUTC.getUTCMinutes()}`;
              if (!existingLogsMap.has(key)) {
                logsToInsert.push({
                  medication_id: med.id,
                  user_id: med.user_id,
                  scheduled_at: slotUTC.toISOString(),
                  status: "missed",
                });
                existingLogsMap.add(key);
              }
            }
          }
        }

        if (logsToInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from("medication_logs")
            .insert(logsToInsert);
          if (insertErr) {
            console.error("Error inserting missed medication logs on server side:", insertErr);
          } else {
            console.log(`Successfully logged ${logsToInsert.length} missed medications on server side`);
          }
        }
      }
    }

    const { data: logs, error } = await supabase
      .from("medication_logs")
      .select("id, user_id, scheduled_at, medication:medications(name)")
      .eq("status", "missed")
      .is("whatsapp_alerted_at", null)
      .gte("scheduled_at", todayStartUTC.toISOString())
      .lte("scheduled_at", todayEndUTC.toISOString())
      .lt("scheduled_at", graceCutoff.toISOString())
      .limit(500);

    if (error) {
      console.error("fetch logs error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!logs || logs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No missed medications to alert", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter out guardian-role users + paused users (same rules as check-ins).
    const userIds = [...new Set(logs.map((l) => l.user_id))];
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("user_id", userIds)
      .eq("role", "guardian");
    const guardianUserIds = new Set((roleRows || []).map((r) => r.user_id));

    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("user_id, settings")
      .in("user_id", userIds);
    const pausedUserIds = new Set<string>();
    const nowMs = now.getTime();
    for (const row of settingsData || []) {
      const s = row.settings as any;
      if (s?.pauseMode && s.pauseMode !== "active") {
        let isPaused = true;
        if (s.pauseMode === "checked-out" && s.checkOutConfig) {
          const expiryStr = s.checkOutConfig.endsAt || s.checkOutConfig.endDate;
          if (expiryStr) {
            const expiryMs = new Date(expiryStr).getTime();
            if (expiryMs && expiryMs < nowMs) isPaused = false;
          }
        }
        if (isPaused) pausedUserIds.add(row.user_id);
      }
    }

    const eligibleLogs = logs.filter(
      (l) => !guardianUserIds.has(l.user_id) && !pausedUserIds.has(l.user_id),
    );

    // Silently mark skipped logs as alerted so we don't reprocess them forever.
    const skippedIds = logs
      .filter((l) => guardianUserIds.has(l.user_id) || pausedUserIds.has(l.user_id))
      .map((l) => l.id);
    if (skippedIds.length > 0) {
      await supabase
        .from("medication_logs")
        .update({ whatsapp_alerted_at: now.toISOString() })
        .in("id", skippedIds);
    }

    if (eligibleLogs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No eligible users", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Group by user + scheduled hour
    type Group = { user_id: string; hourKey: string; logIds: string[]; medNames: Set<string>; scheduled: Date };
    const groups = new Map<string, Group>();
    for (const l of eligibleLogs) {
      const d = new Date(l.scheduled_at);
      const hourKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
      const key = `${l.user_id}|${hourKey}`;
      let g = groups.get(key);
      if (!g) {
        g = { user_id: l.user_id, hourKey, logIds: [], medNames: new Set(), scheduled: d };
        groups.set(key, g);
      }
      g.logIds.push(l.id);
      const name = (l as any).medication?.name;
      if (name) g.medNames.add(name);
    }

    let sent = 0;
    for (const g of groups.values()) {
      // Stamp first to avoid duplicate sends if function runs concurrently.
      const { data: stamped, error: stampErr } = await supabase
        .from("medication_logs")
        .update({ whatsapp_alerted_at: now.toISOString() })
        .in("id", g.logIds)
        .is("whatsapp_alerted_at", null)
        .select("id");
      if (stampErr || !stamped || stamped.length === 0) {
        console.log(`skip ${g.user_id} ${g.hourKey} (already stamped)`);
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", g.user_id)
        .maybeSingle();
      const userName = profile?.full_name || "Your ward";
      const userPhone = normalizeIndianPhone(profile?.phone);
      const medList = [...g.medNames].join(", ") || "your medication";

      // 1) User WhatsApp
      if (userPhone) {
        await sendWhatsAppTemplate({
          templateName: "user_missed_medication",
          languageCode: "en_US",
          recipients: [{ to: [userPhone], components: { body_1: medList } }],
        });
      }

      // 2) Guardians WhatsApp
      const { data: guardians } = await supabase
        .from("guardians")
        .select("id, guardian_phone")
        .eq("user_id", g.user_id)
        .eq("status", "accepted");

      const guardianPhones = Array.from(new Set(
        (guardians || [])
          .map((gd) => normalizeIndianPhone(gd.guardian_phone))
          .filter((p): p is string => !!p),
      ));
      if (guardianPhones.length > 0) {
        await sendWhatsAppTemplate({
          templateName: "guardian_missed_medication",
          languageCode: "en_US",
          recipients: guardianPhones.map((p) => ({
            to: [p],
            components: { body_1: userName, body_2: medList },
          })),
        });

        // Deduped in-app notification per guardian
        const notifications = (guardians || []).map((gd: any) => ({
          user_id: g.user_id,
          guardian_id: gd.id,
          title: "Missed Medication Alert",
          message: `${userName} missed: ${medList}.`,
          type: "medication_missed",
        }));
        await supabase.rpc("insert_notifications_deduped", { p_notifications: notifications });
      }

      sent++;
    }

    return new Response(
      JSON.stringify({ message: "ok", groups: groups.size, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("check-missed-medications error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
