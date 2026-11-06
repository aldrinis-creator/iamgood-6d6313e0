/** Restrict filter grammar to literal search words, including Unicode names. */
export function validSearchText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && /^[\p{L}\p{M}\p{N}\s-]+$/u.test(value);
}

export function premiumHealthPlan(plan: unknown): boolean {
  return ["premium", "premium-plus", "pro"].includes(String(plan));
}