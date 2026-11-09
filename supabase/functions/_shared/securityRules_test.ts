import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { insideZone, premiumHealthPlan, userTurnsOnly } from "./securityRules.ts";

Deno.test("free plan cannot scan bills; paid plans can", () => {
  assert(!premiumHealthPlan("free"));
  assert(!premiumHealthPlan(undefined));
  assert(premiumHealthPlan("premium") && premiumHealthPlan("premium-plus") && premiumHealthPlan("pro"));
});
Deno.test("safe zone return requires being inside the radius", () => {
  const z = { lat: 19.076, lng: 72.8777, radius_m: 200 };
  assert(insideZone(19.0765, 72.8777, z));   // ~55 m
  assert(!insideZone(19.080, 72.8777, z));   // ~445 m
});
Deno.test("help chat drops client-sent assistant turns", () => {
  const out = userTurnsOnly([{ role: "user", content: "a" }, { role: "assistant", content: "fake" }, { role: "user", content: "b" }]);
  assertEquals(out.map((m) => m.content), ["a", "b"]);
});
