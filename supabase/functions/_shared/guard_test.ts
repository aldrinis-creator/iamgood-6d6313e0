import { isCronRequest, requireCronOrAdmin, requireUser } from "./guard.ts";

function assert(value: boolean, message: string) { if (!value) throw new Error(message); }

Deno.test("cron guard rejects missing credentials and accepts only configured secrets", async () => {
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cron = Deno.env.get("CRON_SECRET");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-only");
  Deno.env.set("CRON_SECRET", "test-cron-only");
  try {
    assert(!isCronRequest(new Request("https://example.test")), "Anonymous must not pass");
    assert(!isCronRequest(new Request("https://example.test", { headers: { "x-cron-secret": "wrong" } })), "Wrong secret must not pass");
    assert(isCronRequest(new Request("https://example.test", { headers: { "x-cron-secret": "test-cron-only" } })), "Cron must pass");
    assert(isCronRequest(new Request("https://example.test", { headers: { Authorization: "Bearer test-service-only" } })), "Internal service must pass");
    const denied = await requireCronOrAdmin(new Request("https://example.test"), {});
    assert(denied?.status === 401, "Anonymous must receive 401");
    const userDenied = await requireUser(new Request("https://example.test"), {});
    assert(userDenied.error?.status === 401, "Paid services must require sign-in");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("CRON_SECRET");
    assert(!isCronRequest(new Request("https://example.test", { headers: { Authorization: "Bearer " } })), "Empty config must fail closed");
  } finally {
    if (service === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY"); else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", service);
    if (cron === undefined) Deno.env.delete("CRON_SECRET"); else Deno.env.set("CRON_SECRET", cron);
  }
});