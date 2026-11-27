import { describe, expect, it } from "vitest";
import { medsToAlert, type RefillMed } from "../../supabase/functions/_shared/refillRules";

const med = (o: Partial<RefillMed> = {}): RefillMed => ({
  id: "m1", user_id: "w1", name: "Metformin", remaining_quantity: 3, low_stock_threshold: 5,
  refill_reminder: true, refill_due_since: "2026-11-23", ...o,
});

describe("refill pop-up rules", () => {
  it("does not fire before the medicine is due", () => {
    expect(medsToAlert([med()], "2026-11-22", {}).size).toBe(0);
  });
  it("stops after exactly 3 pop-ups", () => {
    const sent = { m1: ["2026-11-23", "2026-11-24", "2026-11-25"] };
    expect(medsToAlert([med()], "2026-11-26", sent).size).toBe(0);
  });
  it("a medicine that became due after 12 PM still gets all 3 pop-ups (starts next day)", () => {
    expect(medsToAlert([med()], "2026-11-24", {}).size).toBe(1);
    expect(medsToAlert([med()], "2026-11-25", { m1: ["2026-11-24"] }).size).toBe(1);
    expect(medsToAlert([med()], "2026-11-26", { m1: ["2026-11-24", "2026-11-25"] }).size).toBe(1);
    expect(medsToAlert([med()], "2026-11-27", { m1: ["2026-11-24", "2026-11-25", "2026-11-26"] }).size).toBe(0);
  });
  it("skips a refilled medicine", () => {
    expect(medsToAlert([med({ remaining_quantity: 30 })], "2026-11-23", {}).size).toBe(0);
  });
  it("groups several due medicines into one alert per Ward", () => {
    const g = medsToAlert([med(), med({ id: "m2", name: "Amlodipine" })], "2026-11-23", {});
    expect(g.size).toBe(1);
    expect(g.get("w1")?.length).toBe(2);
  });
  it("does not fire twice on the same day", () => {
    expect(medsToAlert([med()], "2026-11-23", { m1: ["2026-11-23"] }).size).toBe(0);
  });
});
