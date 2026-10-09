
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "src/components/CheckInCard.tsx");
let code = fs.readFileSync(file, "utf8");

const search = `    if (error) {
      console.error("Failed to check in:", error);
      toast.error("Check-in failed. Please try again.");
    } else {
      setCheckedIn(true);
      setCheckedInStatus(finalStatus);`;

const replace = `    if (error) {
      console.error("Failed to check in:", error);
      toast.error("Check-in failed. Please try again.");
    } else {
      // If this was a late check-in, trigger the late check-in alert via edge function
      if (isLate) {
        supabase.functions.invoke("send-late-checkin-alert", {
          body: { checkInTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
        }).catch(err => console.error("Failed to send late check-in alert:", err));
      }

      setCheckedIn(true);
      setCheckedInStatus(finalStatus);`;

if (code.includes(search)) {
    code = code.replace(search, replace);
    fs.writeFileSync(file, code);
    console.log("CheckInCard updated successfully!");
} else {
    console.log("Could not find the target code snippet.");
}

