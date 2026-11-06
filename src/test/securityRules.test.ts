import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizePrintHtml } from "@/lib/printSafety";
import { buildLetterheadHtml } from "@/lib/reportPdf";
import { premiumHealthPlan, validSearchText } from "../../supabase/functions/_shared/securityRules";

describe("health information security", () => {
  it("allows Premium tiers but not Basic to access premium AI", () => {
    expect(premiumHealthPlan("basic")).toBe(false);
    expect(premiumHealthPlan(null)).toBe(false);
    expect(premiumHealthPlan("premium")).toBe(true);
    expect(premiumHealthPlan("pro")).toBe(true);
    expect(premiumHealthPlan("premium-plus")).toBe(true);
  });
  it("rejects injected search filters and accepts ordinary Unicode words", () => {
    expect(validSearchText("Mumbai),id.gt.0")).toBe(false);
    expect(validSearchText("%_\\\"")).toBe(false);
    expect(validSearchText("Metformin 500")).toBe(true);
    expect(validSearchText("नई दिल्ली")).toBe(true);
  });
  it("removes executable health report content", () => {
    const clean = sanitizePrintHtml('<table><tr><td>Medicine</td></tr></table><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a>');
    expect(clean).toContain("Medicine");
    expect(clean).not.toMatch(/<script|onerror|javascript:/i);
  });
  it("escapes report titles and names rather than treating them as HTML", () => {
    const html = buildLetterheadHtml({ title: '</title><script>alert(1)</script>', subtitle: '<img src=x onerror=alert(1)>', bodyHtml: '<p>Health</p>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
    expect(escapeHtml("'\"<>&")).toBe("&#39;&quot;&lt;&gt;&amp;");
  });
});