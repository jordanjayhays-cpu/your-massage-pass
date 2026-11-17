// Letters: the Pingen request builders and client (supabase/functions/letters/
// pingen.ts) against a mocked fetch. Nothing here reaches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPingenClient, tokenRequest, createLetterRequest, sendLetterRequest, uploadPutRequest, priceRequest, webhookCreateRequest,
  idemKey, mapPingenStatus, postUploadChecks, addressMatches, normalizeMode, pingenEnvFor, PINGEN_HOSTS, SCOPES, PingenError,
} from "../../supabase/functions/letters/pingen.ts";

const ORG = "11111111-2222-4333-8444-555555555555";
const LID = "99999999-8888-4777-8666-555555555555";

function recorder(handler) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, ...init }); return handler(url, init, calls); };
  return { fetch, calls };
}
const res = (status, body, headers = {}) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const tokenOk = (n = 1) => res(200, { token_type: "Bearer", expires_in: 43200, access_token: `tok${n}` });

test("modes: unknown values are test; only staging and live have a Pingen environment", () => {
  for (const v of [undefined, "", "test", "TEST", "production", "prod", "yes"]) assert.equal(normalizeMode(v), "test");
  assert.equal(normalizeMode(" Live "), "live");
  assert.equal(pingenEnvFor("test"), null);
  assert.equal(pingenEnvFor("staging"), "staging");
  assert.equal(pingenEnvFor("live"), "production");
});

test("token: form body, scopes, documented identity host", () => {
  const r = tokenRequest("staging", "cid", "sec ret");
  assert.equal(r.method, "POST");
  assert.equal(r.url, "https://identity-staging.pingen.com/auth/access-tokens");
  assert.equal(r.headers["Content-Type"], "application/x-www-form-urlencoded");
  const f = new URLSearchParams(r.body);
  assert.equal(f.get("grant_type"), "client_credentials");
  assert.equal(f.get("client_id"), "cid");
  assert.equal(f.get("client_secret"), "sec ret");
  assert.equal(f.get("scope"), "letter webhook organisation_read");
  assert.equal(SCOPES.includes("batch"), false);
  assert.equal(tokenRequest("production", "a", "b").url, "https://identity.pingen.com/auth/access-tokens");
});

test("create: auto_send is the literal false and no print fields are sent", () => {
  const r = createLetterRequest("production", ORG, { fileName: "MC-ABC234.pdf", fileUrl: "https://u", fileUrlSignature: "s" }, "mc-c-x");
  assert.equal(r.url, `https://api.pingen.com/organisations/${ORG}/deliveries/letters`);
  assert.equal(r.headers["Content-Type"], "application/vnd.api+json");
  assert.equal(r.headers["Idempotency-Key"], "mc-c-x");
  const a = JSON.parse(r.body).data.attributes;
  assert.equal(a.auto_send, false);
  assert.equal(a.address_position, "left");
  for (const k of ["delivery_product", "print_mode", "print_spectrum", "meta_data"]) assert.equal(k in a, false, k);
  assert.equal(JSON.parse(r.body).data.type, "letters");
});

test("send, price and webhook bodies", () => {
  const s = sendLetterRequest("staging", ORG, LID, { delivery_product: "cheap", print_spectrum: "grayscale" }, "mc-s-x");
  assert.equal(s.method, "PATCH");
  assert.equal(s.url, `https://api-staging.pingen.com/organisations/${ORG}/deliveries/letters/${LID}/send`);
  assert.deepEqual(JSON.parse(s.body), { data: { id: LID, type: "letters", attributes: { delivery_product: "cheap", print_mode: "simplex", print_spectrum: "grayscale" } } });
  const p = JSON.parse(priceRequest("staging", ORG, { print_spectrum: "color", delivery_product: "cheap" }, "k").body);
  assert.deepEqual(p.data.attributes, { country: "ES", paper_types: ["normal"], print_mode: "simplex", print_spectrum: "color", delivery_product: "cheap" });
  const w = JSON.parse(webhookCreateRequest("staging", ORG, { category: "sent", url: "https://x/letters?pingen_webhook=1", signingKey: "k".repeat(24) }, "k").body);
  assert.deepEqual(w.data.attributes, { event_category: "sent", url: "https://x/letters?pingen_webhook=1", signing_key: "k".repeat(24) });
});

test("upload PUT carries no Authorization and no Content-Type", () => {
  const r = uploadPutRequest("https://s3.example/x?sig=1", new Uint8Array([37, 80]));
  assert.equal(r.method, "PUT");
  assert.deepEqual(r.headers, {});
  assert.equal(r.auth, false);
});

test("idempotency keys", () => {
  const sha = "abcdef0123456789".repeat(4);
  assert.equal(idemKey("c", LID, sha), `mc-c-${LID}-abcdef012345`);
  assert.equal(idemKey("s", LID, sha), `mc-s-${LID}-abcdef012345`);
  assert.equal(idemKey("x", LID), `mc-x-${LID}`);
  assert.ok(idemKey("c", LID, sha).length <= 64);
});

test("test mode: no client exists, so no request can reach any pingen.com host", () => {
  const { fetch, calls } = recorder(() => res(200, {}));
  assert.throws(() => createPingenClient({ mode: "test", clientId: "a", clientSecret: "b", orgId: ORG, fetch }), (e) => e instanceof PingenError && e.code === "test_mode");
  assert.throws(() => createPingenClient({ mode: "staging", clientId: "", clientSecret: "b", orgId: ORG, fetch }), (e) => e.code === "pingen_not_configured");
  assert.equal(calls.length, 0);
});

test("staging uses only staging hosts, live only production hosts; the full upload flow", async () => {
  for (const [mode, hosts] of [["staging", PINGEN_HOSTS.staging], ["live", PINGEN_HOSTS.production]]) {
    const { fetch, calls } = recorder((url, init) => {
      if (url.endsWith("/auth/access-tokens")) return tokenOk();
      if (url.endsWith("/file-upload")) return res(200, { data: { attributes: { url: "https://upload.example/abc", url_signature: "sig", expires_at: "x" } } });
      if (url === "https://upload.example/abc") return new Response(null, { status: 200 });
      if (url.endsWith("/deliveries/letters") && init.method === "POST") return res(201, { data: { id: LID, attributes: { status: "validating" } } });
      return res(404, {});
    });
    const c = createPingenClient({ mode, clientId: "id", clientSecret: "sec", orgId: ORG, fetch, tokenCache: new Map() });
    const up = await c.uploadPdf(new Uint8Array([1, 2, 3]));
    const cr = await c.createLetter({ fileName: "MC-ABC234.pdf", fileUrl: up.url, fileUrlSignature: up.signature }, "mc-c-1");
    assert.equal(cr.id, LID);
    const hostsUsed = calls.map((x) => new URL(x.url).origin).filter((o) => o.includes("pingen"));
    assert.ok(hostsUsed.every((o) => o === hosts.api || o === hosts.identity), mode + " " + hostsUsed);
    const put = calls.find((x) => x.method === "PUT");
    assert.equal(Object.keys(put.headers).length, 0);
    assert.ok(calls.filter((x) => x.url.includes("pingen.com") && !x.url.endsWith("/auth/access-tokens")).every((x) => x.headers.Authorization === "Bearer tok1"));
    assert.equal(calls.some((x) => x.url.endsWith("/send")), false, "create never sends");
  }
});

test("token cache, 401 refresh once, 429 Retry-After, 503 backoff", async () => {
  let n = 0, letterCalls = 0;
  const slept = [];
  const { fetch, calls } = recorder((url) => {
    if (url.endsWith("/auth/access-tokens")) return tokenOk(++n);
    letterCalls++;
    if (letterCalls === 1) return res(401, { errors: [{ title: "expired" }] });
    if (letterCalls === 2) return res(429, {}, { "retry-after": "30" });
    if (letterCalls === 3) return res(503, {});
    return res(200, { data: { id: LID, attributes: { status: "valid" } } });
  });
  const c = createPingenClient({ mode: "staging", clientId: "id", clientSecret: "sec", orgId: ORG, fetch, tokenCache: new Map(), sleep: async (ms) => { slept.push(ms); } });
  const g = await c.getLetter(LID);
  assert.equal(g.attrs.status, "valid");
  assert.equal(n, 2, "one refresh after the 401");
  assert.deepEqual(slept, [10000, 1000], "Retry-After capped at 10 s, then 503 backoff 1 s");
  await c.getLetter(LID);
  assert.equal(calls.filter((x) => x.url.endsWith("/auth/access-tokens")).length, 2, "token reused from cache");
  // A second 401 after the refresh is an error, not a loop.
  const r2 = recorder((url) => (url.endsWith("/auth/access-tokens") ? tokenOk() : res(401, {})));
  const c2 = createPingenClient({ mode: "staging", clientId: "id", clientSecret: "sec", orgId: ORG, fetch: r2.fetch, tokenCache: new Map() });
  await assert.rejects(c2.getLetter(LID), (e) => e instanceof PingenError && e.status === 401);
  assert.equal(r2.calls.length, 4);
  // Wrong credentials fail closed at the token call.
  const r3 = recorder(() => res(401, { error: "invalid_client" }));
  const c3 = createPingenClient({ mode: "live", clientId: "id", clientSecret: "bad", orgId: ORG, fetch: r3.fetch, tokenCache: new Map() });
  await assert.rejects(c3.getLetter(LID), (e) => e.code === "pingen_auth");
  assert.equal(r3.calls.length, 1);
});

test("status mapping table", () => {
  const want = {
    validating: "checking", processing: "checking", inspection: "checking", fixing: "checking", valid: "ready", action_required: "blocked", invalid: "blocked",
    submitted: "submitted", awaiting_credits: "submitted", accepted: "submitted", transferring: "submitted", printing: "submitted", cancelling: "submitted",
    sent: "sent", delivered: "delivered", undeliverable: "undeliverable", unprintable: "unprintable", rejected: "unprintable",
    cancelled: "cancelled", cancelled_expired: "cancelled", expired: "cancelled",
  };
  for (const [p, o] of Object.entries(want)) assert.equal(mapPingenStatus(p), o, p);
  assert.equal(mapPingenStatus("something_new"), null);
});

test("post-upload checks: pages, fonts, country, position, paper, address, price", () => {
  const lines = ["Estudio Ficticio Alfa", "Calle Ejemplo 1, 2º B", "28004 Madrid"];
  const good = { status: "valid", file_pages: 1, fonts: [{ name: "A", is_embedded: true }], country: "ES", address_position: "left", paper_types: ["normal"], address: lines.join("\n"), price_value: 0.97, price_currency: "EUR" };
  assert.deepEqual(postUploadChecks(good, { addressLines: lines, maxPrice: 3 }).problems, []);
  assert.equal(postUploadChecks({ ...good, address: lines.join("\n") + "\nSpain" }, { addressLines: lines, maxPrice: 3 }).ok, true);
  assert.equal(postUploadChecks({ ...good, address: "  estudio ficticio  ALFA\nCalle Ejemplo 1, 2º B\n28004 Madrid\nEspaña" }, { addressLines: lines, maxPrice: 3 }).ok, true);
  const bad = (patch) => postUploadChecks({ ...good, ...patch }, { addressLines: lines, maxPrice: 3 }).ok;
  assert.equal(bad({ status: "action_required" }), false);
  assert.equal(bad({ file_pages: 2 }), false);
  assert.equal(bad({ fonts: [{ name: "Helvetica", is_embedded: false }] }), false);
  assert.equal(bad({ country: "CH" }), false);
  assert.equal(bad({ address_position: "right" }), false);
  assert.equal(bad({ paper_types: ["normal", "qr"] }), false);
  assert.equal(bad({ address: "Estudio Ficticio Alfa\n28004 Madrid" }), false);
  assert.equal(bad({ price_value: 0 }), false);
  assert.equal(bad({ price_value: 3.5 }), false);
  assert.equal(addressMatches("A\nB\nES", ["A", "B"]), true);
  assert.equal(addressMatches("A\nB\nFrance", ["A", "B"]), false);
});
