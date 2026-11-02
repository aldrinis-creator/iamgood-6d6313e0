// Shared request guards for edge functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export function isCronRequest(req: Request): boolean {
  const auth = req.headers.get("Authorization") || "";
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  return (!!svc && auth === `Bearer ${svc}`) ||
    (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret);
}

/** Returns the verified user for the bearer token, or null. */
export async function getCaller(req: Request): Promise<{ id: string; email?: string | null; phone?: string | null } | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email, phone: data.user.phone };
}

export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await serviceClient().rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Cron or admin only. Returns null when allowed, or a 401/403 Response. */
export async function requireCronOrAdmin(req: Request, headers: Record<string, string>): Promise<Response | null> {
  if (isCronRequest(req)) return null;
  const caller = await getCaller(req);
  if (caller && await isAdmin(caller.id)) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: caller ? 403 : 401,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Any signed-in user (or internal service call). */
export async function requireUser(req: Request, headers: Record<string, string>) {
  if (isCronRequest(req)) return { caller: null, internal: true as const, error: null };
  const caller = await getCaller(req);
  if (!caller) {
    return {
      caller: null, internal: false as const,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...headers, "Content-Type": "application/json" },
      }),
    };
  }
  return { caller, internal: false as const, error: null };
}

const digits = (p: string) => (p || "").replace(/\D/g, "").slice(-10);

/** Phones (last 10 digits) of accepted guardians of a ward. */
export async function acceptedGuardianPhones(wardId: string): Promise<Set<string>> {
  const { data } = await serviceClient().from("guardians")
    .select("guardian_phone").eq("user_id", wardId).eq("status", "accepted");
  return new Set((data || []).map((g: any) => digits(g.guardian_phone)).filter(Boolean));
}

export function phoneIn(set: Set<string>, phone: string) {
  return set.has(digits(phone));
}

/** True when caller is the ward or an accepted guardian of the ward. */
export async function canActForWard(callerId: string, wardId: string): Promise<boolean> {
  if (callerId === wardId) return true;
  const { data } = await serviceClient().from("guardians").select("id")
    .eq("user_id", wardId).eq("guardian_user_id", callerId).eq("status", "accepted").limit(1);
  return !!data?.length;
}
