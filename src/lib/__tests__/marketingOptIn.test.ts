import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/siteVisit", () => ({ trackEvent: vi.fn() }));

import { trackEvent } from "@/lib/siteVisit";
import {
  CONSENT_COPY,
  CONSENT_URL,
  consentBody,
  consentLang,
  saveConsent,
  withdrawConsent,
} from "@/lib/marketingOptIn";
// Same rule as src/__tests__/noDashes.test.ts (importing it would re-run its suites here).
const dashProblem = (t: string) => (/[\u2013\u2014]/.test(t) || /\p{L} - \p{L}/u.test(t) ? "dash" : null);

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("the consent contract", () => {
  beforeEach(() => vi.mocked(trackEvent).mockClear());
  afterEach(() => vi.restoreAllMocks());

  it("sends the exact notice, its language and a clean contact", () => {
    const b = consentBody({
      choice: "yes", source: "go_page", lang: "es",
      email: "  Some@Example.COM ", phone: "+34 600-000 000", requestId: "4242",
    });
    expect(b).toEqual({
      choice: "yes", source: "go_page", lang: "es",
      wording: CONSENT_COPY.es.notice,
      email: "some@example.com", phone: "34600000000", token: undefined,
      booking_ref: undefined, request_id: 4242,
    });
  });

  it("refuses to post an answer that names nobody", async () => {
    const f = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(consentBody({ choice: "yes", source: "profile", lang: "en" })).toBeNull();
    const r = await saveConsent({ choice: "yes", source: "profile", lang: "en" }, { fetchImpl: f, retryDelayMs: 0 });
    expect(r).toEqual({ ok: false, error: "no_contact" });
    expect(f).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("consent_save_error", expect.anything());
  });

  it("a booking token alone is enough (review page)", async () => {
    const f = vi.fn(async () => res(200, { ok: true }));
    const r = await saveConsent({ choice: "no", source: "review_page", lang: "en", token: "tok123" }, { fetchImpl: f as unknown as typeof fetch, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CONSENT_URL);
    expect(JSON.parse(String(init.body))).toMatchObject({ choice: "no", source: "review_page", token: "tok123", wording: CONSENT_COPY.en.notice });
    expect(trackEvent).toHaveBeenCalledWith("consent_saved", { meta: { source: "review_page", choice: "no" } });
  });

  it("retries once, then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(500, { ok: false })).mockResolvedValueOnce(res(200, { ok: true }));
    const r = await saveConsent({ choice: "yes", source: "profile", lang: "en", email: "a@b.co" }, { fetchImpl: f, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("two failures: not ok, tracked and logged, never more than two tries", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(res(200, { ok: false }));
    const r = await saveConsent({ choice: "yes", source: "quiz", lang: "en", email: "a@b.co" }, { fetchImpl: f, retryDelayMs: 0 });
    expect(r.ok).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenCalledWith("consent_save_error", { meta: { source: "quiz", choice: "yes", error: "http_200" } });
    expect(err).toHaveBeenCalled();
  });

  it("an ok status without {ok:true} is a failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn(async () => res(200, {}));
    const r = await saveConsent({ choice: "no", source: "profile", lang: "en", email: "a@b.co" }, { fetchImpl: f as unknown as typeof fetch, retryDelayMs: 0 });
    expect(r.ok).toBe(false);
  });

  it("withdraw posts {action, u, s} and rejects a malformed signature without posting", async () => {
    const f = vi.fn(async () => res(200, { ok: true }));
    const sig = "0123456789abcdef0123456789abcdef";
    expect((await withdrawConsent("a@b.co", sig, { fetchImpl: f as unknown as typeof fetch, retryDelayMs: 0 })).ok).toBe(true);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ action: "withdraw", u: "a@b.co", s: sig });
    f.mockClear();
    expect(await withdrawConsent("a@b.co", "nope", { fetchImpl: f as unknown as typeof fetch })).toEqual({ ok: false, error: "bad_link" });
    expect(f).not.toHaveBeenCalled();
  });

  it("Spanish pages get Spanish, every other language English", () => {
    expect(consentLang("es")).toBe("es");
    expect(consentLang("es-ES")).toBe("es");
    for (const l of ["en", "fr", "de", "it", "pt", "zh", undefined, null]) expect(consentLang(l)).toBe("en");
  });

  it("uses the fixed wording, with no dashes and no health claims", () => {
    expect(CONSENT_COPY.en.notice).toBe(
      "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.",
    );
    expect(CONSENT_COPY.es.notice).toBe(
      "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.",
    );
    expect([CONSENT_COPY.en.yes, CONSENT_COPY.en.no, CONSENT_COPY.es.yes, CONSENT_COPY.es.no]).toEqual([
      "Yes, send me offers", "No thanks", "Sí, quiero ofertas", "No, gracias",
    ]);
    for (const lang of ["en", "es"] as const) {
      for (const [k, v] of Object.entries(CONSENT_COPY[lang])) {
        expect(dashProblem(v), `${lang}.${k}`).toBeNull();
        expect(/detox|toxin|immun|discount|descuento/i.test(v), `${lang}.${k}`).toBe(false);
      }
    }
  });
});
