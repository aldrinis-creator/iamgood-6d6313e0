import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMedicationsToday from "./tools/list-medications-today";
import listUpcomingAppointments from "./tools/list-appointments";
import getHealthStatus from "./tools/get-health-status";

// The OAuth issuer MUST be the direct Supabase host built from the project ref
// (Vite inlines VITE_SUPABASE_PROJECT_ID at build time — no runtime env read).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "checkin-mcp",
  title: "Check-iN",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Check-iN user. Read medications scheduled for today, upcoming appointments, and current Health Passport / check-in status. All data is scoped to the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMedicationsToday, listUpcomingAppointments, getHealthStatus],
});
