#!/usr/bin/env node
// Partners column lock (migrations 20261124d + 20261124e): live accept check.
//
//   node tests/partners_lock_live.cjs                 public key only
//   MC_STUDIO_JWT=<access token> node tests/partners_lock_live.cjs
//   MC_STUDIO_EMAIL=... MC_STUDIO_PASSWORD=... node tests/partners_lock_live.cjs
//       also as a signed-in TEST studio (the email must look like a test
//       contact: test/prueba/+mctest/+uitest or a test domain; anything else
//       is refused). MC_ALLOW_TEST_WRITE=1 also runs the calendar disconnect
//       on that test account's own row (it sets google_calendar_connected to
//       false there and nothing else).
//   (behind the agent proxy: NODE_USE_ENV_PROXY=1 node ...)
//
// Expected: every line PASS after step 3 (20261124e). Before it, the "denied"
// lines fail, which is the exposure being closed.
//
// Safe to run any time. Reads use limit=0 or the caller's own row, so no
// secret value is ever fetched. The write probes target a random id that
// matches no row, so even where a write is allowed nothing changes: Postgres
// checks column privileges before looking for rows. Prints only status codes,
// error codes, row counts and function results, never the key, a token or a
// row's contents.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(REPO, "src/lib/supabase.ts"), "utf8");
const URL_ = (src.match(/const supabaseUrl = "([^"]+)"/) || [])[1];
const KEY = (src.match(/const supabaseKey = "([^"]+)"/) || [])[1];
if (!URL_ || !KEY) { console.error("could not read the public URL/key from src/lib/supabase.ts"); process.exit(2); }
if (!/^sb_publishable_|^eyJ/.test(KEY)) { console.error("key in src does not look like a public key; refusing"); process.exit(2); }
const jwtPayload = (jwt) => JSON.parse(Buffer.from(String(jwt).split(".")[1] || "", "base64url").toString() || "{}");
if (/^eyJ/.test(KEY) && jwtPayload(KEY).role !== "anon") { console.error("legacy key role is not anon; refusing"); process.exit(2); }

// The directory column list, read from the same file the site uses.
const colsSrc = fs.readFileSync(path.join(REPO, "src/lib/partnerColumns.ts"), "utf8");
const listBody = (colsSrc.match(/PARTNER_PUBLIC_COLUMN_LIST = \[([\s\S]*?)\] as const/) || [])[1] || "";
const COLS = [...listBody.matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]);
if (COLS.length !== 56) { console.error(`expected 56 public columns, found ${COLS.length}`); process.exit(2); }

const SECRETS = ["claim_token", "hours_token", "hours_code", "google_refresh_token", "google_access_token", "google_calendar_id", "google_token_expiry"];
const CLAIM_FIELDS = "id,business_name,email,address,phone,website,description,city,access_instructions,preferred_language,status,slug,opening_hours";
const P = "/rest/v1/partners";
const NO_ROW = () => crypto.randomUUID();

function client(bearer) {
  const H = { apikey: KEY, Authorization: `Bearer ${bearer}`, Accept: "application/json" };
  return async function call(method, p, body, extra = {}) {
    const res = await fetch(`${URL_}${p}`, {
      method,
      headers: { ...H, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: res.status, json };
  };
}
const code = (r) => (r.json && !Array.isArray(r.json) && typeof r.json === "object" && r.json.code) || "";
const rows = (r) => (Array.isArray(r.json) ? r.json.length : -1);
const denied = (r) => r.status >= 400 && code(r) === "42501";

const results = [];
function check(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${detail})`); }
function skip(name, why) { console.log(`SKIP  ${name}  (${why})`); }

async function anonPass() {
  console.log("== public key");
  const call = client(KEY);
  for (const c of SECRETS) {
    const r = await call("GET", `${P}?select=${c}&limit=0`);
    check(`anon: select ${c} is denied`, denied(r), `${r.status} ${code(r)}`);
  }
  { const r = await call("GET", `${P}?select=*&limit=0`); check("anon: select=* is denied", denied(r), `${r.status} ${code(r)}`); }
  { const r = await call("GET", `${P}?select=id&claim_token=eq.${NO_ROW()}&limit=0`); check("anon: filter on claim_token is denied", denied(r), `${r.status} ${code(r)}`); }
  { const r = await call("GET", `${P}?select=id&hours_code=not.is.null&limit=0`); check("anon: filter on hours_code is denied", denied(r), `${r.status} ${code(r)}`); }
  {
    // fetchShops (homepage directory), exactly as the site sends it.
    const r = await call("GET", `${P}?select=${encodeURIComponent(COLS.join(","))}&status=in.(active,pending)&opted_out_at=is.null&limit=200`);
    check("anon: directory query (fetchShops) returns rows", r.status === 200 && rows(r) > 0, `${r.status} rows=${rows(r)}`);
  }
  { const r = await call("GET", `${P}?select=id,created_at,partner_services(count)&status=in.(active,pending)&opted_out_at=is.null&limit=5`); check("anon: directory count query returns rows", r.status === 200 && rows(r) > 0, `${r.status} rows=${rows(r)}`); }
  { const r = await call("GET", `${P}?select=business_name,phone,whatsapp,address,neighbourhood,opening_hours,slug,price_from,status&status=eq.active&limit=1`); check("anon: socios.html-style read works", r.status === 200 && rows(r) >= 0, `${r.status} rows=${rows(r)}`); }
  {
    // /claim/<slug> -> /studio-setup?claim_slug=<slug>: the claim page's read.
    const r = await call("GET", `${P}?select=${CLAIM_FIELDS}&slug=eq.no-such-studio-${NO_ROW()}&status=in.(pending,active)&limit=0`);
    check("anon: claim page read by slug works", r.status === 200 && rows(r) === 0, `${r.status} rows=${rows(r)}`);
  }
  { const r = await call("POST", "/rest/v1/rpc/match_studios", { p_area: null, p_want: null, p_exclude: null, p_limit: 3 }); check("anon: match_studios (/match) still works", r.status === 200 && rows(r) >= 0, `${r.status} rows=${rows(r)}`); }
  { const r = await call("POST", "/rest/v1/rpc/claim_lookup", { p_claim_token: NO_ROW() }); check("anon: claim_lookup(random uuid) returns nothing", r.status === 200 && rows(r) === 0, `${r.status} rows=${rows(r)}`); }
  {
    const r = await call("POST", "/rest/v1/rpc/claim_token_for_slug", { p_slug: `no-such-studio-${NO_ROW()}` });
    check("anon: no slug-to-token function exists", r.status === 404 && code(r) === "PGRST202", `${r.status} ${code(r)}`);
  }
  for (const [fn, body] of [["claim_release_prebuilt", { p_claim_token: NO_ROW() }], ["claim_release_verified", { p_prebuilt: NO_ROW() }], ["partner_disconnect_calendar", {}]]) {
    const r = await call("POST", `/rest/v1/rpc/${fn}`, body);
    check(`anon: ${fn} is denied`, r.status >= 400 && (code(r) === "42501" || r.status === 401), `${r.status} ${code(r)}`);
  }
  { const r = await call("GET", "/rest/v1/claim_reviews?select=id&limit=0"); check("anon: claim_reviews is not readable", denied(r), `${r.status} ${code(r)}`); }
  { const r = await call("PATCH", `${P}?id=eq.${NO_ROW()}`, { business_name: "x" }, { Prefer: "return=minimal" }); check("anon: update (no-row probe) is denied", denied(r), `${r.status} ${code(r)}`); }
  { const r = await call("DELETE", `${P}?id=eq.${NO_ROW()}`, undefined, { Prefer: "return=minimal" }); check("anon: delete (no-row probe) is denied", denied(r), `${r.status} ${code(r)}`); }
}

const TEST_EMAIL = /(test|prueba|\+mctest|\+uitest)|@(example|test|testing)\.com$|placeholder\.local$/i;

async function studioJwt() {
  if (process.env.MC_STUDIO_JWT) return process.env.MC_STUDIO_JWT;
  const email = process.env.MC_STUDIO_EMAIL, password = process.env.MC_STUDIO_PASSWORD;
  if (!email || !password) return null;
  if (!TEST_EMAIL.test(email)) { console.error("MC_STUDIO_EMAIL is not a test contact; refusing the studio pass"); process.exit(2); }
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) { console.error(`test studio sign-in failed (${res.status})`); process.exit(2); }
  return j.access_token;
}

async function studioPass(jwt) {
  const claims = jwtPayload(jwt);
  if (claims.role !== "authenticated" || !claims.sub) { console.error("studio JWT is not a signed-in user; refusing"); process.exit(2); }
  if (!TEST_EMAIL.test(String(claims.email || ""))) { console.error("studio JWT email is not a test contact; refusing the studio pass"); process.exit(2); }
  console.log("== signed-in test studio");
  const call = client(jwt);
  const me = claims.sub;
  for (const c of SECRETS) {
    const r = await call("GET", `${P}?select=${c}&id=eq.${me}&limit=0`);
    check(`studio: select own ${c} is denied`, denied(r), `${r.status} ${code(r)}`);
  }
  { const r = await call("GET", `${P}?select=*&id=eq.${me}&limit=0`); check("studio: select=* is denied", denied(r), `${r.status} ${code(r)}`); }
  {
    const r = await call("GET", `${P}?select=id,business_name,status,google_calendar_connected&id=eq.${me}`);
    check("studio: reads its own allowed columns", r.status === 200 && rows(r) >= 0, `${r.status} rows=${rows(r)}${rows(r) === 0 ? " (this account has no studio row yet)" : ""}`);
  }
  for (const [col, val] of [["hours_code", "x"], ["claim_token", NO_ROW()], ["google_access_token", null], ["outreach_status", "claimed"], ["match_boost", 0], ["fee_eur", 0]]) {
    const r = await call("PATCH", `${P}?id=eq.${NO_ROW()}`, { [col]: val }, { Prefer: "return=minimal" });
    check(`studio: update of ${col} (no-row probe) is denied`, denied(r), `${r.status} ${code(r)}`);
  }
  { const r = await call("PATCH", `${P}?id=eq.${NO_ROW()}`, { business_name: "x", preferred_language: "es" }, { Prefer: "return=minimal" }); check("studio: profile columns stay writable (no-row probe)", r.status === 204 || r.status === 200, `${r.status} ${code(r)}`); }
  { const r = await call("DELETE", `${P}?id=eq.${NO_ROW()}`, undefined, { Prefer: "return=minimal" }); check("studio: delete (no-row probe) is denied", denied(r), `${r.status} ${code(r)}`); }
  { const r = await call("POST", "/rest/v1/rpc/claim_release_prebuilt", { p_claim_token: NO_ROW() }); check("studio: claim_release_prebuilt is denied", denied(r), `${r.status} ${code(r)}`); }
  {
    const r = await call("POST", "/rest/v1/rpc/claim_release_verified", { p_prebuilt: NO_ROW() });
    check("studio: claim_release_verified(random id) changes nothing", r.status === 200 && ["not_found", "no_own_row", "already_claimed"].includes(r.json), `${r.status} ${JSON.stringify(r.json)}`);
  }
  { const r = await call("GET", "/rest/v1/claim_reviews?select=id&limit=0"); check("studio: claim_reviews is not readable", denied(r), `${r.status} ${code(r)}`); }
  { const r = await call("POST", "/rest/v1/rpc/claim_token_for_slug", { p_slug: "x" }); check("studio: no slug-to-token function exists", r.status === 404 && code(r) === "PGRST202", `${r.status} ${code(r)}`); }
  if (process.env.MC_ALLOW_TEST_WRITE === "1") {
    const r = await call("POST", "/rest/v1/rpc/partner_disconnect_calendar", {});
    check("studio: partner_disconnect_calendar works on its own row", r.status === 200 || r.status === 204, `${r.status} ${code(r)}`);
  } else skip("studio: partner_disconnect_calendar works on its own row", "set MC_ALLOW_TEST_WRITE=1 to run it on the test account");
}

(async () => {
  await anonPass();
  const jwt = await studioJwt();
  if (jwt) await studioPass(jwt);
  else skip("signed-in test studio pass", "set MC_STUDIO_JWT, or MC_STUDIO_EMAIL and MC_STUDIO_PASSWORD, for a test partner account");
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("error:", e.message); process.exit(2); });
