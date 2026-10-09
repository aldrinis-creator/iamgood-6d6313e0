
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "supabase/functions/check-missed-checkins/index.ts");
let code = fs.readFileSync(file, "utf8");

const startToken = "if (userIdsSet.size > 0) {";
const endToken = "const { data: pendingCheckIns, error: fetchError } = await supabase";

const startIndex = code.indexOf(startToken);
const endIndex = code.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
    const replace = `if (userIdsSet.size > 0) {
      // Fetch custom check-in times for all valid users
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("user_id, settings")
        .in("user_id", Array.from(userIdsSet));
        
      const settingsByUserId = new Map<string, any>();
      (userSettings || []).forEach((s: any) => settingsByUserId.set(s.user_id, s.settings));

      const rowsToUpsert = [];
      
      for (const uId of userIdsSet) {
        const settings = settingsByUserId.get(uId) || {};
        let activeCheckInHours = settings.activeCheckInHours;
        if (!Array.isArray(activeCheckInHours) || activeCheckInHours.length === 0) {
          // Fallback to legacy string array if present
          if (Array.isArray(settings.checkInTimes) && settings.checkInTimes.length > 0) {
            activeCheckInHours = Array.from(new Set(settings.checkInTimes.map((t: any) => parseInt(String(t).split(":")[0], 10)).filter((h: number) => Number.isFinite(h) && h >= 0 && h <= 23))).sort((a: any,b: any) => a - b);
          } else {
            activeCheckInHours = [7, 12, 19];
          }
        }

        for (const h of activeCheckInHours) {
          const slotIST = new Date(istMidnight);
          slotIST.setUTCHours(h, 0, 0, 0);
          const slotUTC = new Date(slotIST.getTime() - istOffsetMs);
          
          if (slotUTC < graceCutoff) {
            rowsToUpsert.push({
              user_id: uId,
              scheduled_at: slotUTC.toISOString(),
              status: "pending",
            });
          }
        }
      }

      if (rowsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from("check_ins")
          .upsert(rowsToUpsert, { onConflict: "user_id,scheduled_at", ignoreDuplicates: true });
        if (upsertError) {
          console.error("Error upserting server-side pending check-ins:", upsertError);
        } else {
          console.log(\`Successfully pre-populated \${rowsToUpsert.length} server-side pending check-ins\`);
        }
      }
    }

    `;
    code = code.substring(0, startIndex) + replace + code.substring(endIndex);
    fs.writeFileSync(file, code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the target code snippet.");
}

