/** Restrict filter grammar to literal search words, including Unicode names. */
export function validSearchText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && /^[\p{L}\p{M}\p{N}\s-]+$/u.test(value);
}

export function premiumHealthPlan(plan: unknown): boolean {
  return ["premium", "premium-plus", "pro"].includes(String(plan));
}

export const RETURN_COOLDOWN_MS = 30 * 60 * 1000;

/** Haversine check: point within zone radius (metres). */
export function insideZone(lat: number, lng: number, z: { lat: number; lng: number; radius_m: number }): boolean {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(z.lat - lat), dLng = toR(z.lng - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat)) * Math.cos(toR(z.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a)) <= z.radius_m;
}

/** Help chat: only the caller's own questions are trusted as history. */
export function userTurnsOnly<T extends { role: string; content: string }>(msgs: T[], max = 6) {
  return msgs.filter((m) => m.role === "user").slice(-max).map((m) => ({ role: "user" as const, content: m.content.slice(0, 2000) }));
}
