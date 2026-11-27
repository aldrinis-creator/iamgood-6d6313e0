import { describe, it, expect, beforeEach } from "vitest";
import {
  pickNext, requestPopup, releasePopup, currentPopup, startQuietPeriod, setQuietUser,
  isQuiet, QUIET_PERIOD_MS, __resetPopupQueue,
} from "@/lib/popupQueue";

beforeEach(() => { localStorage.clear(); __resetPopupQueue(); });

describe("popup queue", () => {
  it("quiet period lasts 15 minutes", () => {
    const t = 1_000_000;
    startQuietPeriod("user-a", t);
    expect(QUIET_PERIOD_MS).toBe(15 * 60 * 1000);
    expect(isQuiet(t + 14 * 60 * 1000)).toBe(true);
    expect(isQuiet(t + 15 * 60 * 1000 + 1)).toBe(false);
  });
  it("quiet period is per user", () => {
    startQuietPeriod("user-a");
    expect(isQuiet()).toBe(true);
    setQuietUser("user-b");
    expect(isQuiet()).toBe(false);
    setQuietUser("user-a");
    expect(isQuiet()).toBe(true);
    setQuietUser(null);
    expect(isQuiet()).toBe(false);
  });
  it("shows nothing during the quiet period", () => {
    startQuietPeriod("user-a");
    requestPopup("refill");
    expect(currentPopup()).toBe(null);
  });
  it("shows one at a time, next after the current closes", () => {
    requestPopup("battery");
    requestPopup("refill");
    expect(currentPopup()).toBe("battery");
    releasePopup("battery");
    expect(currentPopup()).toBe("refill");
  });
  it("picks the highest priority first", () => {
    expect(pickNext(null, ["cookie", "reminder", "refill"])).toBe("reminder");
  });
});
