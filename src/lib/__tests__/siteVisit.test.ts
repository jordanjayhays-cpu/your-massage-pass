import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventContext, isTrackingExcluded, trackEvent, viewportBucket } from "@/lib/siteVisit";

const TRACK_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/track";

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function setUrl(search: string) {
  window.history.replaceState({}, "", `/studios${search}`);
}

describe("trackEvent beacon payload", () => {
  let beacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    setUrl("");
    document.documentElement.lang = "es";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
  });

  afterEach(() => {
    localStorage.clear();
    setUrl("");
  });

  it("adds lang, host, vw and v to meta", async () => {
    trackEvent("req_view", { meta: { flow: "studio" } });
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(url).toBe(TRACK_URL);
    const payload = JSON.parse(await readBlob(blob));
    expect(payload.event).toBe("req_view");
    expect(payload.path).toBe("/studios");
    expect(payload.meta).toEqual({
      flow: "studio",
      lang: "es",
      host: window.location.hostname,
      vw: "xs",
      v: "ds1",
    });
  });

  it("lets the caller's own meta keys win", async () => {
    trackEvent("req_submit_ok", { slug: "spa-calma", meta: { lang: "en", vw: "custom", v: "x", host: "h" } });
    const [, blob] = beacon.mock.calls[0] as [string, Blob];
    const payload = JSON.parse(await readBlob(blob));
    expect(payload.partner_slug).toBe("spa-calma");
    expect(payload.meta).toEqual({ lang: "en", vw: "custom", v: "x", host: "h" });
  });

  it("still sends the context when the caller gives no meta", async () => {
    trackEvent("studio_view");
    const [, blob] = beacon.mock.calls[0] as [string, Blob];
    const payload = JSON.parse(await readBlob(blob));
    expect(payload.meta).toMatchObject({ lang: "es", vw: "xs", v: "ds1" });
    expect(typeof payload.meta.host).toBe("string");
  });

  it("sends nothing for an opted-out visitor (?nt=1)", () => {
    setUrl("?nt=1");
    trackEvent("req_view");
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe("viewportBucket", () => {
  it("buckets widths at 400, 768 and 1200", () => {
    expect(viewportBucket(360)).toBe("xs");
    expect(viewportBucket(399)).toBe("xs");
    expect(viewportBucket(400)).toBe("sm");
    expect(viewportBucket(767)).toBe("sm");
    expect(viewportBucket(768)).toBe("md");
    expect(viewportBucket(1199)).toBe("md");
    expect(viewportBucket(1200)).toBe("lg");
    expect(viewportBucket(1920)).toBe("lg");
  });

  it("eventContext reads the page language and width", () => {
    document.documentElement.lang = "fr";
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    expect(eventContext()).toMatchObject({ lang: "fr", vw: "lg", v: "ds1" });
  });
});

describe("isTrackingExcluded (unchanged)", () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl("");
  });

  it("is false by default", () => {
    expect(isTrackingExcluded()).toBe(false);
  });

  it("?nt=1 opts out and persists; ?nt=0 opts back in", () => {
    setUrl("?nt=1");
    expect(isTrackingExcluded()).toBe(true);
    setUrl("");
    expect(isTrackingExcluded()).toBe(true);
    expect(localStorage.getItem("mc_nt")).toBe("1");
    setUrl("?nt=0");
    expect(isTrackingExcluded()).toBe(false);
    expect(localStorage.getItem("mc_nt")).toBeNull();
  });
});
