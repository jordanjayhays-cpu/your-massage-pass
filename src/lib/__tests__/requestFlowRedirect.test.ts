import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { requestFlowTarget } from "../requestFlowRedirect";

const HOST = "book.massageclub.io";

const target = (url: string, opts: { host?: string; session?: boolean } = {}) => {
  const u = new URL(url, "https://" + (opts.host ?? HOST));
  return requestFlowTarget(u.pathname, u.search, u.hash, opts.host ?? HOST, !!opts.session);
};

describe("requestFlowTarget", () => {
  it("sends / to the request flow with src=home", () => {
    expect(target("/")).toBe("/reserve?src=home");
  });

  it("keeps every query parameter and adds src", () => {
    const t = target("/?lang=es&utm_source=ig");
    expect(t).toBe("/reserve?lang=es&utm_source=ig&src=home");
    const p = new URLSearchParams(t!.split("?")[1]);
    expect(p.get("lang")).toBe("es");
    expect(p.get("utm_source")).toBe("ig");
  });

  it("keeps lang and nt in order", () => {
    expect(target("/?lang=es&nt=1")).toBe("/reserve?lang=es&nt=1&src=home");
  });

  it("labels Google Ads clicks src=google", () => {
    expect(target("/?gclid=x")).toBe("/reserve?gclid=x&src=google");
    expect(target("/start?gbraid=y")).toBe("/reserve?gbraid=y&src=google");
    expect(target("/book?wbraid=z")).toBe("/reserve?wbraid=z&src=google");
  });

  it("never overwrites an existing src", () => {
    expect(target("/?src=wa")).toBe("/reserve?src=wa");
  });

  it("maps /start, /book and /booking, with or without a trailing slash", () => {
    expect(target("/start")).toBe("/reserve?src=start");
    expect(target("/start/")).toBe("/reserve?src=start");
    expect(target("/book")).toBe("/reserve?src=book");
    expect(target("/book/")).toBe("/reserve?src=book");
    expect(target("/booking")).toBe("/reserve?src=book");
  });

  it("drops the hash", () => {
    expect(target("/start#top")).toBe("/reserve?src=start");
  });

  it("leaves Supabase sign-in links on / to Login", () => {
    expect(target("/#access_token=x")).toBeNull();
    expect(target("/#refresh_token=x")).toBeNull();
    expect(target("/#error_description=expired")).toBeNull();
    expect(target("/#type=recovery")).toBeNull();
    expect(target("/?code=abc")).toBeNull();
    expect(target("/?token_hash=abc&type=magiclink")).toBeNull();
    expect(target("/?error=access_denied")).toBeNull();
  });

  it("keeps a signed-in visitor on Login", () => {
    expect(target("/", { session: true })).toBeNull();
    // The session rule is for "/" only: the old wizard pages always leave.
    expect(target("/book", { session: true })).toBe("/reserve?src=book");
  });

  it("does nothing on other paths", () => {
    expect(target("/login")).toBeNull();
    expect(target("/studios")).toBeNull();
    expect(target("/spa-calma")).toBeNull();
    expect(target("/book/spa-calma")).toBeNull();
    expect(target("/reserve")).toBeNull();
  });

  it("stays with ?stay=1", () => {
    expect(target("/?stay=1")).toBeNull();
    expect(target("/book?stay=1")).toBeNull();
  });

  it("only leaves on the booking host and local previews", () => {
    // On every other host "/" is the marketing Home (App.tsx).
    expect(target("/", { host: "your-massage-pass.vercel.app" })).toBeNull();
    expect(target("/start", { host: "massageclub.io" })).toBeNull();
    expect(target("/", { host: "localhost" })).toBe("/reserve?src=home");
    expect(target("/", { host: "book.localhost" })).toBe("/reserve?src=home");
  });

  it("cleans a hand-typed src and replaces an invalid one", () => {
    expect(target("/?src=IG")).toBe("/reserve?src=ig");
    expect(target("/?src=ig_bio&lang=es")).toBe("/reserve?src=ig-bio&lang=es");
    expect(target("/start?src=not%20valid")).toBe("/reserve?src=start");
    expect(target("/?src=x.y&gclid=1")).toBe("/reserve?src=google&gclid=1");
  });

  it("stays on Lovable previews", () => {
    expect(target("/", { host: "abc.lovableproject.com" })).toBeNull();
    expect(target("/start", { host: "id-preview--abc.lovable.app" })).toBeNull();
  });
});

/**
 * The inline script in index.html must make the same decision as
 * requestFlowTarget. Run it in a sandbox with a fake location and compare.
 */
describe("index.html inline redirect matches requestFlowTarget", () => {
  const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
  const m = html.match(/KEEP IN SYNC[\s\S]*?<script>([\s\S]*?)<\/script>/);
  const code = m ? m[1] : "";

  const runInline = (url: string, opts: { host?: string; session?: boolean } = {}) => {
    const host = opts.host ?? HOST;
    const u = new URL(url, "https://" + host);
    let replaced: string | null = null;
    const store: Record<string, string> = opts.session ? { "sb-jglftdstrowwckwqmpue-auth-token": "{}" } : { mc_lang: "es" };
    const keys = Object.keys(store);
    const localStorage = {
      get length() { return keys.length; },
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => store[k] ?? null,
    };
    const location = {
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      hostname: host,
      replace: (to: string) => { replaced = to; },
    };
    vm.runInNewContext(code, { window: { location }, localStorage, URLSearchParams });
    return replaced;
  };

  it("finds the script", () => {
    expect(code).toContain("l.replace('/reserve?'");
    expect(code).toContain("/reserve?");
  });

  const cases: Array<[string, { host?: string; session?: boolean }?]> = [
    ["/"],
    ["/?lang=es&utm_source=ig"],
    ["/?lang=es&nt=1"],
    ["/?gclid=x"],
    ["/?src=wa"],
    ["/start"],
    ["/book/"],
    ["/booking"],
    ["/start#top"],
    ["/#access_token=x"],
    ["/#type=signup"],
    ["/?code=abc"],
    ["/?token=abc"],
    ["/", { session: true }],
    ["/book", { session: true }],
    ["/login"],
    ["/studios"],
    ["/spa-calma"],
    ["/?stay=1"],
    ["/", { host: "abc.lovableproject.com" }],
    ["/", { host: "your-massage-pass.vercel.app" }],
    ["/", { host: "localhost" }],
    ["/?src=IG"],
    ["/?src=ig_bio&lang=es"],
    ["/start?src=not%20valid"],
    ["/?src=x.y&gclid=1"],
  ];

  it.each(cases)("%s", (url, opts = {}) => {
    expect(runInline(url, opts)).toBe(target(url, opts));
  });

  it("keeps the outside referrer and the landing path for go.html", () => {
    const saved: Record<string, string> = {};
    const u = new URL("/start?utm_source=ig", "https://" + HOST);
    let replaced: string | null = null;
    const location = { pathname: u.pathname, search: u.search, hash: "", hostname: HOST, replace: (to: string) => { replaced = to; } };
    const localStorage = { length: 0, key: () => null, getItem: () => null };
    const sessionStorage = { setItem: (k: string, v: string) => { saved[k] = v; } };
    vm.runInNewContext(code, { window: { location }, localStorage, sessionStorage, document: { referrer: "https://l.instagram.com/" }, URLSearchParams, JSON, Date, String });
    expect(replaced).toBe("/reserve?utm_source=ig&src=start");
    const hop = JSON.parse(saved.mc_hop);
    expect(hop.ref).toBe("https://l.instagram.com/");
    expect(hop.path).toBe("/start");
    expect(typeof hop.t).toBe("number");
  });
});
