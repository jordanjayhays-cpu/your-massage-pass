// Letters (17 Nov 2026): the Pingen client. Read from Pingen's OpenAPI spec
// (api.pingen.com/documentation, v2.0.0), its help centre and its official
// SDKs on 17 Nov; Pingen itself was not called while this was written.
//
// Request builders are pure (they return { method, url, headers, body }) and
// the client takes fetch as an argument, so tests run it against a mock.
//
// Safety, in code and in tests:
//   - test mode (LETTERS_MODE unset, "test" or anything unknown) builds no
//     client at all: createPingenClient throws before any request exists;
//   - staging uses only the staging hosts, live only production;
//   - a letter is created with auto_send: false (the literal), so creating it
//     sends nothing; only sendLetter() posts, and only campaign_send calls it.

export type Mode = "test" | "staging" | "live";
export type PingenEnv = "staging" | "production";
export type Req = { method: string; url: string; headers: Record<string, string>; body?: string | Uint8Array; auth: boolean; noRetry?: boolean };

export const PINGEN_HOSTS: Record<PingenEnv, { identity: string; api: string }> = {
  staging: { identity: "https://identity-staging.pingen.com", api: "https://api-staging.pingen.com" },
  production: { identity: "https://identity.pingen.com", api: "https://api.pingen.com" },
};
// The token endpoint, in one place. Pingen's docs give the identity host; the
// official Python and JS SDKs post the same form to {api}/auth/access-tokens.
// Switch TOKEN_HOST to "api" only if staging shows the documented host fails.
export const TOKEN_HOST: "identity" | "api" = "identity";
export const TOKEN_PATH = "/auth/access-tokens";
export const SCOPES = "letter webhook organisation_read";
export const JSONAPI = "application/vnd.api+json";
export const WEBHOOK_CATEGORIES = ["issues", "sent", "undeliverable", "delivered"];

export function normalizeMode(v: unknown): Mode {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "live" ? "live" : s === "staging" ? "staging" : "test";
}
export function pingenEnvFor(mode: Mode): PingenEnv | null {
  return mode === "live" ? "production" : mode === "staging" ? "staging" : null;
}

const api = (env: PingenEnv) => PINGEN_HOSTS[env].api;
const org = (env: PingenEnv, orgId: string) => `${api(env)}/organisations/${encodeURIComponent(orgId)}`;
const jsonHeaders = (idem?: string): Record<string, string> => ({ Accept: JSONAPI, "Content-Type": JSONAPI, ...(idem ? { "Idempotency-Key": idem } : {}) });

export function tokenRequest(env: PingenEnv, clientId: string, clientSecret: string): Req {
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: SCOPES }).toString();
  return { method: "POST", url: `${PINGEN_HOSTS[env][TOKEN_HOST]}${TOKEN_PATH}`, headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, auth: false };
}
export function fileUploadRequest(env: PingenEnv): Req {
  return { method: "GET", url: `${api(env)}/file-upload`, headers: { Accept: JSONAPI }, auth: true };
}
// The signed upload URL takes the raw bytes: no Authorization, no form
// encoding, no Content-Type (the SDKs send none).
export function uploadPutRequest(url: string, bytes: Uint8Array): Req {
  return { method: "PUT", url, headers: {}, body: bytes, auth: false };
}
export function createLetterRequest(env: PingenEnv, orgId: string, a: { fileName: string; fileUrl: string; fileUrlSignature: string }, idem: string): Req {
  const body = {
    data: {
      type: "letters",
      attributes: {
        file_original_name: a.fileName,
        file_url: a.fileUrl,
        file_url_signature: a.fileUrlSignature,
        address_position: "left",
        auto_send: false,
      },
    },
  };
  return { method: "POST", url: `${org(env, orgId)}/deliveries/letters`, headers: jsonHeaders(idem), body: JSON.stringify(body), auth: true };
}
export function getLetterRequest(env: PingenEnv, orgId: string, id: string): Req {
  return { method: "GET", url: `${org(env, orgId)}/deliveries/letters/${encodeURIComponent(id)}`, headers: { Accept: JSONAPI }, auth: true };
}
export function letterEventsRequest(env: PingenEnv, orgId: string, id: string): Req {
  return { method: "GET", url: `${org(env, orgId)}/deliveries/letters/${encodeURIComponent(id)}/events?language=en-GB`, headers: { Accept: JSONAPI }, auth: true };
}
export function sendLetterRequest(env: PingenEnv, orgId: string, id: string, o: { delivery_product: string; print_spectrum: string }, idem: string): Req {
  const body = { data: { id, type: "letters", attributes: { delivery_product: o.delivery_product, print_mode: "simplex", print_spectrum: o.print_spectrum } } };
  return { method: "PATCH", url: `${org(env, orgId)}/deliveries/letters/${encodeURIComponent(id)}/send`, headers: jsonHeaders(idem), body: JSON.stringify(body), auth: true, noRetry: true };
}
export function cancelLetterRequest(env: PingenEnv, orgId: string, id: string, idem: string): Req {
  return { method: "PATCH", url: `${org(env, orgId)}/deliveries/letters/${encodeURIComponent(id)}/cancel`, headers: jsonHeaders(idem), auth: true };
}
export function deleteLetterRequest(env: PingenEnv, orgId: string, id: string): Req {
  return { method: "DELETE", url: `${org(env, orgId)}/deliveries/letters/${encodeURIComponent(id)}`, headers: { Accept: JSONAPI }, auth: true };
}
export function priceRequest(env: PingenEnv, orgId: string, o: { print_spectrum: string; delivery_product: string }, idem: string): Req {
  const body = { data: { type: "letter_price_calculator", attributes: { country: "ES", paper_types: ["normal"], print_mode: "simplex", print_spectrum: o.print_spectrum, delivery_product: o.delivery_product } } };
  return { method: "POST", url: `${org(env, orgId)}/deliveries/letters/price-calculator`, headers: jsonHeaders(idem), body: JSON.stringify(body), auth: true };
}
export function organisationRequest(env: PingenEnv, orgId: string): Req {
  return { method: "GET", url: org(env, orgId), headers: { Accept: JSONAPI }, auth: true };
}
export function webhooksListRequest(env: PingenEnv, orgId: string): Req {
  return { method: "GET", url: `${org(env, orgId)}/webhooks`, headers: { Accept: JSONAPI }, auth: true };
}
export function webhookCreateRequest(env: PingenEnv, orgId: string, o: { category: string; url: string; signingKey: string }, idem: string): Req {
  const body = { data: { type: "webhooks", attributes: { event_category: o.category, url: o.url, signing_key: o.signingKey } } };
  return { method: "POST", url: `${org(env, orgId)}/webhooks`, headers: jsonHeaders(idem), body: JSON.stringify(body), auth: true };
}

// Idempotency keys (1 to 64 characters): create mc-c-<letter>-<12 hex of the
// PDF sha256>, send mc-s-<letter>-<12 hex>, cancel mc-x-<letter>.
export function idemKey(kind: "c" | "s" | "x" | "p" | "w", id: string, sha = ""): string {
  const k = `mc-${kind}-${id}${sha ? `-${sha.slice(0, 12)}` : ""}`;
  return k.slice(0, 64);
}

// ---------------------------------------------------------------------------
// Status mapping (5.5)
// ---------------------------------------------------------------------------
export const PINGEN_STATUS_MAP: Record<string, string> = {
  validating: "checking", processing: "checking", inspection: "checking", fixing: "checking",
  valid: "ready", action_required: "blocked", invalid: "blocked",
  submitted: "submitted", awaiting_credits: "submitted", accepted: "submitted", transferring: "submitted", printing: "submitted", cancelling: "submitted",
  sent: "sent", delivered: "delivered", undeliverable: "undeliverable",
  unprintable: "unprintable", rejected: "unprintable",
  cancelled: "cancelled", cancelled_expired: "cancelled", expired: "cancelled",
};
// Unknown Pingen values are stored as they are and shown as "Pingen: <value>";
// they never move our status.
export const mapPingenStatus = (s: string): string | null => PINGEN_STATUS_MAP[String(s || "")] ?? null;
export const PINGEN_POSTED = ["submitted", "awaiting_credits", "accepted", "transferring", "printing", "cancelling", "sent", "delivered", "undeliverable"];

export type LetterAttrs = {
  status?: string; file_pages?: number; address?: string; address_position?: string; country?: string;
  paper_types?: string[]; fonts?: { name: string; is_embedded: boolean }[]; price_value?: number; price_currency?: string;
};

const COUNTRY_LINE = /^(spain|españa|espana|spanien|espagne|es)$/i;
export function normAddressLines(text: string): string[] {
  const lines = String(text || "").normalize("NFC").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);
  if (lines.length && COUNTRY_LINE.test(lines[lines.length - 1])) lines.pop();
  return lines;
}
export function addressMatches(pingenAddress: string, ours: string[]): boolean {
  const a = normAddressLines(pingenAddress);
  const b = normAddressLines(ours.join("\n"));
  return a.length === b.length && a.every((l, i) => l === b[i]);
}

// Our checks after Pingen validated the upload (5.2 step 5). All must pass
// for "ready"; otherwise the letter is "blocked" with these reasons.
export function postUploadChecks(a: LetterAttrs, o: { addressLines: string[]; maxPrice: number }): { ok: boolean; problems: string[] } {
  const p: string[] = [];
  if (a.status !== "valid") p.push(`Pingen status is ${a.status || "unknown"}, not valid.`);
  if (a.file_pages !== 1) p.push(`Pingen counts ${a.file_pages ?? "?"} pages, not 1.`);
  const fonts = Array.isArray(a.fonts) ? a.fonts : [];
  const notEmb = fonts.filter((f) => !f.is_embedded).map((f) => f.name);
  if (notEmb.length) p.push(`Fonts not embedded: ${notEmb.join(", ")}.`);
  if (a.country !== "ES") p.push(`Pingen reads the country as ${a.country || "unknown"}, not ES.`);
  if (a.address_position !== "left") p.push(`Address position is ${a.address_position || "unknown"}, not left.`);
  if (!Array.isArray(a.paper_types) || a.paper_types.length !== 1 || a.paper_types[0] !== "normal") p.push(`Paper types are ${JSON.stringify(a.paper_types ?? null)}, not ["normal"].`);
  if (!addressMatches(a.address || "", o.addressLines)) p.push(`Pingen read the address as "${String(a.address || "").replace(/\n/g, " / ")}", which is not the address we printed. Take it back. Then correct or shorten that line in the CSV and import the list again in Settings, Mailing list: the letter is prepared again for you to look at.`);
  const price = Number(a.price_value);
  if (!(price > 0) || price > o.maxPrice) p.push(`Price ${a.price_value ?? "?"} ${a.price_currency || ""} is outside 0 to ${o.maxPrice.toFixed(2)}.`);
  return { ok: p.length === 0, problems: p };
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------
export class PingenError extends Error {
  status: number;
  requestId: string;
  code: string;
  detail: string;
  constructor(code: string, message: string, status = 0, requestId = "", detail = "") {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.detail = detail;
  }
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string | Uint8Array; signal?: AbortSignal }) => Promise<Response>;
export type TokenCache = Map<string, { token: string; exp: number }>;
const defaultTokenCache: TokenCache = new Map();

export type PingenResult = { status: number; json: Record<string, unknown> | null; requestId: string };

export function createPingenClient(o: {
  mode: Mode; clientId: string; clientSecret: string; orgId: string; fetch: Fetch;
  sleep?: (ms: number) => Promise<void>; now?: () => number; tokenCache?: TokenCache; timeoutMs?: number;
}) {
  const env = pingenEnvFor(o.mode);
  if (!env) throw new PingenError("test_mode", "Test mode: no Pingen request is ever made.");
  if (!o.clientId || !o.clientSecret || !o.orgId) throw new PingenError("pingen_not_configured", "PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET and PINGEN_ORGANISATION_ID must all be set.");
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now ?? (() => Date.now());
  const cache = o.tokenCache ?? defaultTokenCache;
  const cacheKey = `${env}:${o.clientId}`;
  const timeoutMs = o.timeoutMs ?? 25000;

  const doFetch = async (r: Req, token?: string): Promise<Response> => {
    const headers = { ...r.headers, ...(r.auth && token ? { Authorization: `Bearer ${token}` } : {}) };
    let signal: AbortSignal | undefined;
    try { signal = AbortSignal.timeout(timeoutMs); } catch { signal = undefined; }
    try {
      return await o.fetch(r.url, { method: r.method, headers, body: r.body, signal });
    } catch (e) {
      throw new PingenError("pingen_unreachable", `Pingen did not answer (${String((e as Error)?.name || e)}).`);
    }
  };

  async function token(force = false): Promise<string> {
    const c = cache.get(cacheKey);
    if (!force && c && now() < c.exp) return c.token;
    const res = await doFetch(tokenRequest(env!, o.clientId, o.clientSecret));
    const j = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok || !j || typeof j.access_token !== "string") {
      cache.delete(cacheKey);
      throw new PingenError("pingen_auth", `Pingen refused the credentials (${res.status}). Check that the keys belong to ${env === "staging" ? "the staging" : "the production"} account.`, res.status, res.headers.get("x-request-id") || "");
    }
    const ttl = Math.max(0, Number(j.expires_in || 0) - 60) * 1000;
    cache.set(cacheKey, { token: j.access_token, exp: now() + ttl });
    return j.access_token;
  }

  // One authorised call: a 401 refreshes the token once; a 429 waits
  // Retry-After (at most 10 s) and tries again; a 503 backs off 1, 5, 10 s.
  async function call(r: Req, ok: number[] = [200, 201, 202, 204]): Promise<PingenResult> {
    let refreshed = false, tries429 = 0, tries503 = 0;
    for (;;) {
      const res = await doFetch(r, r.auth ? await token() : undefined);
      const requestId = res.headers.get("x-request-id") || "";
      if (res.status === 401 && r.auth && !refreshed) { refreshed = true; cache.delete(cacheKey); await token(true); continue; }
      if (res.status === 429 && tries429 < 2) {
        tries429++;
        const ra = Number(res.headers.get("retry-after") || "1");
        await sleep(Math.min(10, Math.max(0, Number.isFinite(ra) ? ra : 1)) * 1000);
        continue;
      }
      // Review fix (17 Nov): a send is never retried blindly (spec 10.4), not
      // even on a 503 with the same Idempotency-Key: campaign_send reads the
      // letter back and decides.
      if (res.status === 503 && tries503 < 3 && !r.noRetry) { await sleep([1000, 5000, 10000][tries503++]); continue; }
      const text = res.status === 204 ? "" : await res.text().catch(() => "");
      let json: Record<string, unknown> | null = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      if (!ok.includes(res.status)) {
        const errs = (json?.errors as { title?: string; detail?: string; code?: string }[] | undefined) || [];
        const detail = errs.map((e) => [e.code, e.title, e.detail].filter(Boolean).join(": ")).join("; ").slice(0, 500);
        throw new PingenError("pingen_error", `Pingen answered ${res.status}${detail ? `: ${detail}` : ""}.`, res.status, requestId, detail);
      }
      return { status: res.status, json, requestId };
    }
  }

  const attrs = (r: PingenResult) => ((r.json?.data as Record<string, unknown> | undefined)?.attributes || {}) as Record<string, unknown>;

  return {
    env,
    token,
    call,
    async uploadPdf(bytes: Uint8Array): Promise<{ url: string; signature: string; requestId: string }> {
      const u = await call(fileUploadRequest(env));
      const a = attrs(u);
      if (typeof a.url !== "string" || typeof a.url_signature !== "string") throw new PingenError("pingen_error", "Pingen gave no upload URL.", u.status, u.requestId);
      const put = await doFetch(uploadPutRequest(a.url, bytes));
      if (!put.ok) throw new PingenError("pingen_upload", `The PDF upload failed (${put.status}).`, put.status, put.headers.get("x-request-id") || "");
      return { url: a.url, signature: a.url_signature, requestId: u.requestId };
    },
    async createLetter(a: { fileName: string; fileUrl: string; fileUrlSignature: string }, idem: string): Promise<{ id: string; status: string; requestId: string }> {
      const r = await call(createLetterRequest(env, o.orgId, a, idem), [200, 201]);
      const d = (r.json?.data || {}) as Record<string, unknown>;
      if (typeof d.id !== "string") throw new PingenError("pingen_error", "Pingen created no letter id.", r.status, r.requestId);
      return { id: d.id, status: String(attrs(r).status || ""), requestId: r.requestId };
    },
    async getLetter(id: string): Promise<{ attrs: LetterAttrs; abilities: Record<string, string>; requestId: string }> {
      const r = await call(getLetterRequest(env, o.orgId, id), [200]);
      const meta = (r.json?.data as Record<string, unknown> | undefined)?.meta as { abilities?: { self?: Record<string, string> } } | undefined;
      return { attrs: attrs(r) as LetterAttrs, abilities: meta?.abilities?.self || {}, requestId: r.requestId };
    },
    async getLetterEvents(id: string): Promise<string[]> {
      const r = await call(letterEventsRequest(env, o.orgId, id), [200]);
      const data = (r.json?.data || []) as { attributes?: { name?: string; reason?: string; code?: string } }[];
      return data.map((e) => [e.attributes?.name, e.attributes?.reason].filter(Boolean).join(": ")).filter(Boolean).slice(0, 10);
    },
    async sendLetter(id: string, p: { delivery_product: string; print_spectrum: string }, idem: string): Promise<PingenResult> {
      return await call(sendLetterRequest(env, o.orgId, id, p, idem), [200, 201, 202]);
    },
    async cancelLetter(id: string, idem: string): Promise<PingenResult> {
      return await call(cancelLetterRequest(env, o.orgId, id, idem), [200, 202, 204]);
    },
    async deleteLetter(id: string): Promise<PingenResult> {
      return await call(deleteLetterRequest(env, o.orgId, id), [200, 204, 404]);
    },
    async price(p: { print_spectrum: string; delivery_product: string }, idem: string): Promise<{ price: number; currency: string }> {
      const r = await call(priceRequest(env, o.orgId, p, idem), [200, 201]);
      const a = attrs(r);
      return { price: Number(a.price), currency: String(a.currency || "") };
    },
    async organisation(): Promise<Record<string, unknown>> {
      return attrs(await call(organisationRequest(env, o.orgId), [200]));
    },
    async listWebhooks(): Promise<{ id: string; category: string; url: string }[]> {
      const r = await call(webhooksListRequest(env, o.orgId), [200]);
      const data = (r.json?.data || []) as { id: string; attributes?: { event_category?: string; url?: string } }[];
      return data.map((w) => ({ id: w.id, category: String(w.attributes?.event_category || ""), url: String(w.attributes?.url || "") }));
    },
    async createWebhook(category: string, url: string, signingKey: string, idem: string): Promise<string> {
      const r = await call(webhookCreateRequest(env, o.orgId, { category, url, signingKey }, idem), [200, 201]);
      return String((r.json?.data as Record<string, unknown> | undefined)?.id || "");
    },
  };
}
export type PingenClient = ReturnType<typeof createPingenClient>;
