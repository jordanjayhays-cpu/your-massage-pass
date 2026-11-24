import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isNoTagPath } from "@/lib/clarity";

// The privacy page (section 9) promises that neither the Google tag nor
// Clarity loads before "Accept", and the review asked that addresses carrying
// a person's token or contact never reach either (19 Nov 2026).
const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("tags load only after Accept, and never on token pages", () => {
  it("index.html loads gtag.js only inside __mcLoadGtag, which checks the choice and the path", () => {
    const html = read("index.html");
    const fn = html.slice(html.indexOf("window.__mcLoadGtag = function"));
    expect(fn.length).toBeGreaterThan(0);
    const body = fn.slice(0, fn.indexOf("};"));
    expect(body).toMatch(/!granted\(\)/);
    expect(body).toMatch(/noTagPath\(\)/);
    expect(body).toMatch(/googletagmanager\.com\/gtag\/js/);
    // The only place the script is added.
    expect(html.split("googletagmanager.com/gtag/js").length - 1).toBe(1);
    for (const p of ["/unsubscribe", "/review", "/r/"]) expect(html).toContain(`'${p}'`);
  });

  it("public/go.html loads gtag.js and Clarity only with the choice granted", () => {
    const html = read("public/go.html");
    const g = html.slice(html.indexOf("function loadGtag()"));
    expect(g.slice(0, g.indexOf("}"))).toMatch(/!consentGranted\(\)/);
    const c = html.slice(html.indexOf("function loadClarity()"));
    expect(c.slice(0, c.indexOf("\n"))).toBeTruthy();
    expect(c.slice(0, 200)).toMatch(/!consentGranted\(\)/);
  });

  it("Clarity never runs on a page whose address carries a token or a contact", () => {
    for (const p of ["/unsubscribe", "/review", "/r/abc123"]) expect(isNoTagPath(p), p).toBe(true);
    for (const p of ["/", "/privacy", "/reviews", "/studios", "/rio"]) expect(isNoTagPath(p), p).toBe(false);
  });
});
