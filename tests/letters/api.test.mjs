// Letters: the JSON API end to end (supabase/functions/letters/api.ts) with an
// in-memory store that mirrors the SQL constraints and trigger, a stand-in
// renderer, and a mocked Supabase Auth and Pingen. Nothing reaches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { makeApi, listCsv, GOOD_SETTINGS, PASS, OTHER_TOKEN, ORG, WH_SECRET, P1, P2, P3, P4, SUPA, ADMIN, ADMIN_ID, OTHER_ID, googleUser } from "./_helpers.mjs";
import { defaultTemplate, useApprovedFeeWording } from "../../supabase/functions/letters/templates.ts";

const STAGING = { LETTERS_MODE: "staging", PINGEN_CLIENT_ID: "cid", PINGEN_CLIENT_SECRET: "csecret", PINGEN_ORGANISATION_ID: ORG };
const pingenCalls = (api) => api.net.calls.filter((c) => /pingen\.com/.test(c.url));

async function importList(api) {
  const r = await api.call("list_import", { csv: listCsv(), list_version: "2026-11-15", mode: "replace" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
async function recipientIds(api) {
  return (await api.call("eligible_list")).body.rows.map((r) => r.recipient_id);
}
// The page fetches the bytes, draws them, and only then says it was looked at
// (letter_seen); fetching alone no longer counts (review fix, 17 Nov).
async function look(api, letterId, how = "full") {
  const p = await api.call("letter_preview", { letter_id: letterId });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  if (p.body.sha256) {
    const s = await api.call("letter_seen", { letter_id: letterId, sha256: p.body.sha256, how });
    assert.equal(s.status, 200, JSON.stringify(s.body));
  }
  return p;
}
async function previewApprove(api, letterId, ack = true) {
  const p = await look(api, letterId);
  return await api.call("letter_approve", { letter_id: letterId, sha256: p.body.sha256, ack_warnings: ack });
}
// Settings filled, list imported, a campaign with the approved fee wording,
// and every eligible letter approved.
async function prepare(api) {
  assert.equal((await api.call("settings_update", { settings: GOOD_SETTINGS })).status, 200);
  await importList(api);
  const c = await api.call("campaign_create", { name: "Piloto noviembre", recipient_ids: await recipientIds(api), template: useApprovedFeeWording(defaultTemplate()) });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const campaignId = c.body.campaign.id;
  const letters = (await api.call("campaign_get", { campaign_id: campaignId })).body.letters;
  for (const l of letters) {
    const a = await previewApprove(api, l.id);
    assert.equal(a.status, 200, JSON.stringify(a.body));
  }
  return { campaignId, letters: (await api.call("campaign_get", { campaign_id: campaignId })).body.letters };
}
async function goStaging(api, campaignId) {
  Object.assign(api.env, STAGING);
  const q = await api.call("campaign_queue", { campaign_id: campaignId });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  return q.body;
}
async function dry(api, campaignId, ids) {
  const d = await api.call("campaign_dry_run", { campaign_id: campaignId, letter_ids: ids });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  return d.body;
}
function signedWebhook(api, body, secret = WH_SECRET) {
  const raw = JSON.stringify(body);
  return api.handler(new Request(`${SUPA}/functions/v1/letters?pingen_webhook=1`, { method: "POST", headers: { "content-type": "application/vnd.api+json", signature: createHmac("sha256", secret).update(raw).digest("hex") }, body: raw }));
}
function hook(category, pingenLetterId, eventId, o = {}) {
  return { data: { id: eventId, type: `webhook_${category}`, attributes: { reason: o.reason || "", url: "x", created_at: "2026-11-20T09:42:48+0100" }, relationships: { organisation: { data: { id: o.org || ORG, type: "organisations" } }, deliverable: { data: { id: pingenLetterId, type: "letters" } }, event: { data: { id: eventId, type: "letters_events" } } } } };
}

test("auth: no token 401, other account 403, GET 405, CORS only for the page's origin", async () => {
  const api = await makeApi();
  assert.equal((await api.call("whoami", {}, null)).status, 401);
  assert.equal((await api.call("whoami", {}, null)).body.error, "auth_required");
  const other = await api.call("whoami", {}, OTHER_TOKEN);
  assert.equal(other.status, 403);
  assert.equal(other.body.error, "not_allowed");
  assert.equal(other.body.user_id, OTHER_ID, "a Google account learns its own user id, to copy into the secret");
  const ok = await api.call("whoami");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.email, "jordan@massageclub.io");
  assert.equal(ok.body.user_id, ADMIN_ID);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://book.massageclub.io");
  const get = await api.handler(new Request(`${SUPA}/functions/v1/letters`, { method: "GET" }));
  assert.equal(get.status, 405);
  for (const origin of ["https://your-massage-pass-o5fo.vercel.app", "https://massageclub.io", "https://evil.example"]) {
    const pre = await api.handler(new Request(`${SUPA}/functions/v1/letters`, { method: "OPTIONS", headers: { origin } }));
    assert.equal(pre.headers.get("access-control-allow-origin"), null, origin);
    assert.equal(pre.status, 403);
  }
  const unknown = await api.call("drop_tables");
  assert.equal(unknown.status, 400);
  // The allowlist is user ids; listing the other user's id lets them in.
  const api2 = await makeApi({ env: { LETTERS_ADMIN_USER_IDS: `${OTHER_ID}` } });
  assert.equal((await api2.call("whoami")).status, 403);
  assert.equal((await api2.call("whoami", {}, OTHER_TOKEN)).status, 200);
});

test("auth (review H1): fails closed, user ids not emails, email confirmed and a Google identity", async () => {
  // No secret, or a typo in it: nobody gets in, and the answer says why.
  for (const v of [undefined, "", "jordan@massageclub.io", `${ADMIN_ID},not-a-uuid`]) {
    const api = await makeApi({ env: { LETTERS_ADMIN_USER_IDS: v } });
    const r = await api.call("whoami");
    assert.equal(r.status, 503, String(v));
    assert.equal(r.body.error, "admins_not_set");
    assert.equal(r.body.user_id, ADMIN_ID, "Jordan's own id, so he can set the secret");
  }
  // Someone who signed up with email and password as jordan@massageclub.io
  // (another user id, no Google identity) is refused even if confirmed.
  const T = (n) => `tok_${n}_${"z".repeat(24)}`;
  const api = await makeApi({ users: {
    [T("pw")]: { id: "e0e0e0e0-0000-4000-8000-000000000001", email: ADMIN, email_confirmed_at: "2026-11-17T00:00:00Z", identities: [{ provider: "email", identity_data: { email: ADMIN } }] },
    [T("pwsameid")]: { id: ADMIN_ID, email: ADMIN, email_confirmed_at: "2026-11-17T00:00:00Z", identities: [{ provider: "email", identity_data: { email: ADMIN } }] },
    [T("phone")]: { id: ADMIN_ID, email: ADMIN, email_confirmed_at: null, confirmed_at: "2026-11-17T00:00:00Z", identities: [{ provider: "google", identity_data: { email: ADMIN, email_verified: true } }] },
    [T("othergoogle")]: googleUser(ADMIN_ID, ADMIN, { identities: [{ provider: "google", identity_data: { email: "someone.else@gmail.com", email_verified: true } }] }),
    [T("unverified")]: googleUser(ADMIN_ID, ADMIN, { identities: [{ provider: "google", identity_data: { email: ADMIN, email_verified: false } }] }),
  } });
  for (const n of ["pw", "pwsameid", "phone", "othergoogle", "unverified"]) {
    const r = await api.call("whoami", {}, T(n));
    assert.equal(r.status, 403, n);
    assert.equal(r.body.error, "not_allowed", n);
    assert.equal(r.body.user_id, undefined, `${n}: an account that could never get in is not told its id`);
  }
  assert.equal((await api.call("whoami")).status, 200);
});

test("auth: an unconfirmed account is refused; 60 failed calls per IP are rate limited", async () => {
  const api = await makeApi({ users: { tok_unconfirmed_cccccccccccccccccccc: googleUser(ADMIN_ID, ADMIN, { email_confirmed_at: null }) } });
  assert.equal((await api.call("whoami", {}, "tok_unconfirmed_cccccccccccccccccccc")).status, 403);
  for (let i = 0; i < 60; i++) await api.call("whoami", {}, null, { "cf-connecting-ip": "203.0.113.9" });
  const r = await api.call("whoami", {}, null, { "cf-connecting-ip": "203.0.113.9" });
  assert.equal(r.status, 429);
  assert.equal((await api.call("whoami", {}, null, { "cf-connecting-ip": "203.0.113.10" })).status, 401);
});

test("test mode is the default: readiness says so and nothing can be queued or posted", async () => {
  const api = await makeApi();
  const w = await api.call("whoami");
  assert.equal(w.body.mode, "test");
  assert.ok(w.body.readiness.blocking_reasons[0].startsWith("Test mode: nothing is posted."));
  assert.equal(w.body.readiness.legal_sender, false);
  assert.equal(w.body.readiness.admin_ids_set, true);
  assert.deepEqual(w.body.limits, { max_per_send: 20, daily_cap: 50, posted_today: 0, daily_left: 50 });
  assert.equal(w.body.prices.estimate_eur, 0.97);
  assert.equal(w.body.prices.vat_rate, 21);
  const { campaignId, letters } = await prepare(api);
  const q = await api.call("campaign_queue", { campaign_id: campaignId });
  assert.equal(q.status, 409);
  assert.equal(q.body.error, "test_mode");
  const s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: letters.map((l) => l.id), confirm_count: 3, confirm_total: "2.91", passcode: PASS });
  assert.equal(s.status, 409);
  assert.equal(s.body.error, "test_mode");
  const d = await dry(api, campaignId);
  assert.equal(d.mode, "test");
  assert.equal(d.would_post.length, 3);
  assert.equal(d.confirm_total, "2.91");
  assert.equal(d.global.find((g) => g.check === "mode").ok, false);
  for (const op of ["pingen_refresh", "pingen_check"]) assert.equal((await api.call(op, { campaign_id: campaignId })).body.error, "test_mode");
  assert.equal((await api.call("price_check")).body.estimate, true);
  assert.equal(pingenCalls(api).length, 0, "no request reached any pingen.com host in test mode");
  assert.ok(api.db.letters.every((l) => l.status === "approved"), "a dry run changes nothing");
  assert.ok(api.db.events.some((e) => e.event === "dry_run"));
});

test("approval: placeholders, fee guard, stale bytes, warnings, re-render clears approval", async () => {
  const api = await makeApi();
  await importList(api);
  const el = (await api.call("eligible_list")).body;
  const delta = el.rows.find((r) => r.partner_id === P4);
  assert.equal(delta.eligible, false);
  assert.equal(delta.reasons[0].code, "test_studio");
  const c = await api.call("campaign_create", { name: "Borrador", recipient_ids: el.rows.map((r) => r.recipient_id) });
  assert.equal(c.body.created, 3);
  assert.equal(c.body.skipped.length, 1);
  const cid = c.body.campaign.id;
  const letters = (await api.call("campaign_get", { campaign_id: cid })).body.letters;
  const l1 = letters.find((l) => l.partner_id === P1);
  const l3 = letters.find((l) => l.partner_id === P3);
  // Missing legal sender: red placeholders, cannot approve.
  let p = await look(api, l1.id);
  assert.equal(p.body.can_approve, false);
  assert.ok(p.body.english.privacy.includes("MISSING: legal sender"));
  let a = await api.call("letter_approve", { letter_id: l1.id, sha256: p.body.sha256 });
  assert.equal(a.status, 422);
  assert.match(a.body.message, /placeholders/);
  // Settings filled: the old preview is stale.
  assert.equal((await api.call("settings_update", { settings: GOOD_SETTINGS })).status, 200);
  a = await api.call("letter_approve", { letter_id: l1.id, sha256: p.body.sha256 });
  assert.equal(a.status, 409);
  assert.equal(a.body.error, "stale");
  // The draft template's fee sentence blocks approval.
  p = await look(api, l1.id);
  a = await api.call("letter_approve", { letter_id: l1.id, sha256: p.body.sha256 });
  assert.equal(a.status, 422);
  assert.match(a.body.message, /fee sentence is not the approved wording/);
  // Approving without having opened this exact version is refused.
  const camp = (await api.call("campaign_get", { campaign_id: cid })).body.campaign;
  assert.equal((await api.call("campaign_update_template", { campaign_id: cid, template: useApprovedFeeWording(defaultTemplate()), expected_version: 7 })).body.error, "stale");
  const u = await api.call("campaign_update_template", { campaign_id: cid, template: useApprovedFeeWording(defaultTemplate()), expected_version: camp.template_version });
  assert.equal(u.status, 200, JSON.stringify(u.body));
  a = await api.call("letter_approve", { letter_id: l1.id, sha256: p.body.sha256 });
  assert.equal(a.body.error, "stale");
  a = await previewApprove(api, l1.id, false);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  // Warnings must be acknowledged.
  a = await previewApprove(api, l3.id, false);
  assert.equal(a.status, 422);
  assert.match(a.body.message, /Tick the warnings/);
  a = await previewApprove(api, l3.id, true);
  assert.equal(a.status, 200);
  // A greeting change re-renders and clears the approval.
  const g = await api.call("letter_set_greeting", { letter_id: l1.id, greeting_name: "Estudio Alfa" });
  assert.equal(g.status, 200);
  assert.equal(g.body.letter.status, "review");
  assert.equal(api.db.letters.find((l) => l.id === l1.id).approved_sha256, null);
  // A Spanish template change clears approvals; an English-only change does not.
  const t2 = useApprovedFeeWording(defaultTemplate());
  t2.body_en = t2.body_en + " ";
  const v = (await api.call("campaign_get", { campaign_id: cid })).body.campaign.template_version;
  assert.equal((await api.call("campaign_update_template", { campaign_id: cid, template: t2, expected_version: v })).body.approvals_cleared, 0);
  t2.body_es = t2.body_es.replace("Nosotros les buscamos centro.", "Nosotros les buscamos un centro.");
  const r = await api.call("campaign_update_template", { campaign_id: cid, template: t2, expected_version: v + 1 });
  assert.equal(r.body.approvals_cleared, 1);
  assert.equal(api.db.campaigns[0].template.body_en_stale, true);
  // A template with an unknown tag or a long dash cannot even be saved.
  const bad = { ...t2, body_es: t2.body_es.replace("{{nombre}}", "{{telefono}}") };
  assert.equal((await api.call("campaign_update_template", { campaign_id: cid, template: bad, expected_version: v + 2 })).status, 422);
  // Rejecting and reopening.
  const rej = await api.call("letter_reject", { letter_id: l3.id, reason: "wrong floor" });
  assert.equal(rej.body.letter.status, "rejected");
  assert.equal((await api.call("letter_reopen", { letter_id: l3.id })).body.letter.status, "review");
  // Every status change was audited.
  const statusChanges = api.db.events.filter((e) => e.from_status !== e.to_status && e.to_status);
  assert.ok(statusChanges.length >= 8);
  assert.ok(api.db.events.every((e) => !JSON.stringify(e).includes(PASS)));
});

test("bulk approve is all or nothing", async () => {
  const api = await makeApi();
  await api.call("settings_update", { settings: GOOD_SETTINGS });
  await importList(api);
  const c = await api.call("campaign_create", { name: "Bulk", recipient_ids: await recipientIds(api), template: useApprovedFeeWording(defaultTemplate()) });
  const letters = (await api.call("campaign_get", { campaign_id: c.body.campaign.id })).body.letters;
  const items = [];
  for (const l of letters.slice(0, 2)) items.push({ letter_id: l.id, sha256: (await look(api, l.id)).body.sha256 });
  items.push({ letter_id: letters[2].id, sha256: "0".repeat(64) });
  const r = await api.call("letters_approve_bulk", { items, ack_warnings: true });
  assert.equal(r.status, 422);
  assert.equal(api.db.letters.filter((l) => l.status === "approved").length, 0);
  const r2 = await api.call("letters_approve_bulk", { items: items.slice(0, 2), ack_warnings: true });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(r2.body.approved.length, 2);
});

test("staging: queue uploads with auto_send false, send needs passcode and the exact numbers", async () => {
  const api = await makeApi();
  const { campaignId, letters } = await prepare(api);
  const q = await goStaging(api, campaignId);
  assert.deepEqual(q.outcomes.map((o) => o.status), ["ready", "ready", "ready"], JSON.stringify(q));
  const creates = pingenCalls(api).filter((c) => c.method === "POST" && c.url.endsWith("/deliveries/letters"));
  assert.equal(creates.length, 3);
  for (const c of creates) {
    const a = JSON.parse(c.body).data.attributes;
    assert.equal(a.auto_send, false);
    assert.match(c.headers["idempotency-key"], /^mc-c-[0-9a-f-]{36}-[0-9a-f]{12}$/);
    assert.match(a.file_original_name, /^MC-[23456789A-HJ-NP-Z]{6}\.pdf$/);
  }
  assert.ok(pingenCalls(api).every((c) => new URL(c.url).hostname.endsWith("-staging.pingen.com")), "staging hosts only");
  assert.equal(pingenCalls(api).filter((c) => c.url.endsWith("/send")).length, 0, "queue never sends");
  assert.equal(api.db.campaigns[0].pingen_env, "staging");
  const ready = api.db.letters.filter((l) => l.status === "ready");
  assert.equal(ready.length, 3);
  assert.ok(ready.every((l) => l.uploaded_sha256 === l.approved_sha256 && l.approved_sha256 === l.pdf_sha256));
  // Settings cannot change while letters are with Pingen.
  assert.equal((await api.call("settings_update", { settings: { return_city: "Getafe" } })).body.error, "wrong_state");

  const ids = letters.slice(0, 2).map((l) => l.id);
  const d = await dry(api, campaignId, ids);
  assert.equal(d.confirm_count, 2);
  assert.equal(d.confirm_total, "1.94");
  // No passcode, wrong passcode, then locked after 5 failures.
  let s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 2, confirm_total: "1.94" });
  assert.equal(s.body.error, "wrong_passcode");
  for (let i = 0; i < 4; i++) s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 2, confirm_total: "1.94", passcode: "not the passcode" });
  assert.equal(s.body.error, "wrong_passcode");
  s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 2, confirm_total: "1.94", passcode: PASS });
  assert.equal(s.status, 423);
  assert.equal(s.body.error, "locked");
  assert.equal(api.db.events.filter((e) => e.event === "passcode_fail").length, 5);
  api.db.rate.clear();
  // Numbers that differ from the server's are refused, with the right numbers.
  s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 2, confirm_total: "1.00", passcode: PASS });
  assert.equal(s.body.error, "numbers_changed");
  assert.equal(s.body.confirm_total, "1.94");
  assert.equal(pingenCalls(api).filter((c) => c.url.endsWith("/send")).length, 0);
  // The real send.
  s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 2, confirm_total: "1.94", passcode: PASS });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.posted, 2);
  const sends = pingenCalls(api).filter((c) => c.url.endsWith("/send"));
  assert.equal(sends.length, 2);
  for (const c of sends) {
    assert.match(c.headers["idempotency-key"], /^mc-s-/);
    assert.deepEqual(JSON.parse(c.body).data.attributes, { delivery_product: "cheap", print_mode: "simplex", print_spectrum: "grayscale" });
  }
  const sub = api.db.letters.filter((l) => l.status === "submitted");
  assert.equal(sub.length, 2);
  assert.ok(sub.every((l) => l.submitted_by === "jordan@massageclub.io" && l.submitted_at));
  // Posting the same letters again finds nothing to post.
  s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 0, confirm_total: "0.00", passcode: PASS });
  assert.equal(s.status, 422);
  assert.equal(pingenCalls(api).filter((c) => c.url.endsWith("/send")).length, 2);

  // Webhooks: sent, a replay, undeliverable; a bad signature.
  const [a, b] = sub;
  let w = await signedWebhook(api, hook("sent", a.pingen_letter_id, "e-1"));
  assert.equal(w.status, 200);
  assert.equal(api.db.letters.find((l) => l.id === a.id).status, "sent");
  w = await signedWebhook(api, hook("sent", a.pingen_letter_id, "e-1"));
  assert.equal(w.status, 200);
  assert.equal((await w.json()).message, "duplicate");
  assert.equal(api.db.events.filter((e) => e.pingen_event_id === "e-1").length, 1);
  w = await signedWebhook(api, hook("undeliverable", a.pingen_letter_id, "e-2", { reason: "Unknown recipient" }));
  assert.equal(api.db.letters.find((l) => l.id === a.id).status, "undeliverable");
  assert.match(api.db.recipients.find((r) => r.id === a.recipient_id).needs_review, /^undeliverable on 2026-11-20/);
  w = await signedWebhook(api, hook("sent", b.pingen_letter_id, "e-3"), "the-wrong-secret-0000");
  assert.equal(w.status, 401);
  assert.equal(api.db.letters.find((l) => l.id === b.id).status, "submitted");
  w = await signedWebhook(api, hook("sent", b.pingen_letter_id, "e-4", { org: "00000000-0000-4000-8000-000000000000" }));
  assert.equal(w.status, 200);
  assert.equal(api.db.letters.find((l) => l.id === b.id).status, "submitted");
  // A "sent" for a letter we never posted is flagged, not applied.
  const third = api.db.letters.find((l) => l.status === "ready");
  w = await signedWebhook(api, hook("sent", third.pingen_letter_id, "e-5"));
  assert.equal(api.db.letters.find((l) => l.id === third.id).status, "ready");
  assert.ok(api.db.events.some((e) => e.event === "sent_outside_tool" && e.letter_id === third.id));
  // The studio whose letter came back is no longer eligible.
  const el = (await api.call("eligible_list")).body.rows.find((r) => r.recipient_id === a.recipient_id);
  assert.ok(el.reasons.some((r) => r.code === "needs_review"));
  // Cancel needs the passcode and asks Pingen.
  assert.equal((await api.call("letter_cancel", { letter_id: b.id })).body.error, "wrong_passcode");
  const cn = await api.call("letter_cancel", { letter_id: b.id, passcode: PASS });
  assert.equal(cn.status, 200, JSON.stringify(cn.body));
  assert.equal(api.db.letters.find((l) => l.id === b.id).pingen_status, "cancelling");
});

test("webhook: 503 without a secret, 401 for a missing signature", async () => {
  const api = await makeApi({ env: { LETTERS_WEBHOOK_SECRET: "" } });
  assert.equal((await signedWebhook(api, hook("sent", P1, "e-9"))).status, 503);
  const api2 = await makeApi({ env: STAGING });
  const r = await api2.handler(new Request(`${SUPA}/functions/v1/letters?pingen_webhook=1`, { method: "POST", body: JSON.stringify(hook("sent", P1, "e-9")) }));
  assert.equal(r.status, 401);
  const unknown = await signedWebhook(api2, hook("sent", "77777777-7777-4777-8777-777777777777", "e-10"));
  assert.equal(unknown.status, 200);
  assert.ok(api2.db.events.some((e) => e.event === "webhook_unknown_letter"));
});

test("send refusals: settings, Pingen keys, passcode secret, BAJA route, caps, studio state, changed inputs, unapproved", async () => {
  const api = await makeApi();
  const { campaignId, letters } = await prepare(api);
  await goStaging(api, campaignId);
  const ids = letters.map((l) => l.id);
  const send = (extra = {}) => api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 3, confirm_total: "2.91", passcode: PASS, ...extra });
  const saved = { ...api.db.settings };

  api.db.settings.legal_sender_name = "";
  let s = await send();
  assert.equal(s.status, 412);
  assert.equal(s.body.error, "settings_incomplete");
  Object.assign(api.db.settings, saved);

  delete api.env.PINGEN_CLIENT_SECRET;
  assert.equal((await send()).body.error, "pingen_not_configured");
  api.env.PINGEN_CLIENT_SECRET = "csecret";

  api.env.LETTERS_PASSCODE = "short";
  assert.equal((await send()).body.error, "passcode_not_set");
  api.env.LETTERS_PASSCODE = PASS;

  api.env.LETTERS_MODE = "live";
  assert.equal((await send()).body.error, "optout_route_not_confirmed");
  api.env.LETTERS_MODE = "staging";

  api.db.settings.max_per_send = 2;
  assert.equal((await send()).body.error, "over_cap");
  api.db.settings.max_per_send = 20;
  api.db.settings.daily_cap = 2;
  assert.equal((await send()).body.error, "over_cap");
  api.db.settings.daily_cap = 50;

  // A BAJA that arrived another way (the bot sets opted_out_at), a suspended
  // studio, and a changed sign key: each letter is refused and nothing posts.
  api.db.partners.find((p) => p.id === P1).opted_out_at = "2026-11-17T09:00:00Z";
  api.db.partners.find((p) => p.id === P2).status = "suspended";
  s = await send();
  assert.equal(s.body.error, "numbers_changed");
  assert.equal(s.body.confirm_count, 1);
  const reasons = Object.fromEntries(s.body.refused.map((r) => [api.db.letters.find((l) => l.id === r.letter_id).partner_id, r.reason]));
  assert.match(reasons[P1], /Asked not to be contacted/);
  assert.match(reasons[P2], /Suspended or archived/);
  api.env.MC_SIGN_KEY = "a-different-sign-key-0000000000000000";
  s = await send({ confirm_count: 1, confirm_total: "0.97" });
  assert.equal(s.body.error, "numbers_changed");
  assert.equal(s.body.confirm_count, 0);
  assert.match(s.body.refused.find((r) => api.db.letters.find((l) => l.id === r.letter_id).partner_id === P3).reason, /changed since it was approved/);
  assert.equal(pingenCalls(api).filter((c) => c.url.endsWith("/send")).length, 0, "nothing was posted");
});

test("unapproved letters and changed bytes are never queued or posted", async () => {
  const api = await makeApi();
  await api.call("settings_update", { settings: GOOD_SETTINGS });
  await importList(api);
  const c = await api.call("campaign_create", { name: "Mixto", recipient_ids: await recipientIds(api), template: useApprovedFeeWording(defaultTemplate()) });
  const cid = c.body.campaign.id;
  const letters = (await api.call("campaign_get", { campaign_id: cid })).body.letters;
  const [l1, l2] = letters;
  assert.equal((await previewApprove(api, l1.id)).status, 200);
  await look(api, l2.id); // seen, not approved
  // Changed bytes: the stored PDF no longer matches the approval.
  const stored = api.db.letters.find((l) => l.id === l1.id);
  api.db.pdfs.set(stored.pdf_path, new TextEncoder().encode("%PDF-tampered"));
  const d = await dry(api, cid);
  assert.equal(d.would_post.length, 0);
  assert.match(d.letters.find((x) => x.letter_id === l1.id).reason, /not the approved one/);
  Object.assign(api.env, STAGING);
  const q = await api.call("campaign_queue", { campaign_id: cid });
  assert.equal(q.status, 200);
  assert.equal(q.body.outcomes.length, 1, "only the approved letter is considered");
  assert.match(q.body.outcomes[0].message, /not the approved one/);
  assert.equal(api.db.letters.find((l) => l.id === l1.id).status, "approved");
  assert.equal(api.db.letters.find((l) => l.id === l2.id).status, "review");
  assert.equal(pingenCalls(api).filter((x) => x.url.endsWith("/deliveries/letters")).length, 0);
  // Even a hand-made claim cannot skip approval: the store (like the DB trigger) refuses.
  await assert.rejects(api.store.updateLetter(l2.id, { status: "uploading" }), /cannot become uploading/);
  await assert.rejects(api.store.updateLetter(l2.id, { status: "approved" }), /letters_approved_bytes/);
  // A send naming an unapproved letter is refused for that letter.
  const s = await api.call("campaign_send", { campaign_id: cid, letter_ids: [l2.id], confirm_count: 0, confirm_total: "0.00", passcode: PASS });
  assert.equal(s.status, 422);
  assert.match(s.body.refused[0].reason, /Status is review, not ready/);
});

test("queue: Pingen's address must match ours, or the letter is blocked; unqueue deletes it in Pingen", async () => {
  const api = await makeApi();
  const { campaignId } = await prepare(api);
  api.net.pingen.addressOverride = ["Otro Nombre", "Calle Distinta 1", "28004 Madrid"];
  const q = await goStaging(api, campaignId);
  assert.ok(q.outcomes.every((o) => o.status === "blocked"));
  assert.match(api.db.letters[0].status_reason, /which is not the address we printed/);
  const r = await api.call("letter_unqueue", { letter_id: api.db.letters[0].id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.letter.status, "approved");
  assert.equal(r.body.letter.pingen_letter_id, null);
  assert.equal(pingenCalls(api).filter((c) => c.method === "DELETE").length, 1);
});

test("BAJA: optout_mark sets opted_out_at, records it, withdraws unsent letters and removes them from Pingen", async () => {
  const api = await makeApi();
  const { campaignId } = await prepare(api);
  await goStaging(api, campaignId);
  const r = await api.call("optout_mark", { partner_id: P2, channel: "email", message: "BAJA por favor" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(api.db.partners.find((p) => p.id === P2).opted_out_at);
  assert.equal(api.db.optouts.length, 1);
  const l = api.db.letters.find((x) => x.partner_id === P2);
  assert.equal(l.status, "withdrawn");
  assert.equal(pingenCalls(api).filter((c) => c.method === "DELETE").length, 1);
  // Only what is needed not to write again is kept: its list row loses the
  // address and leaves the active list, and an import of it again is refused.
  assert.equal((await api.call("eligible_list")).body.rows.find((x) => x.partner_id === P2), undefined);
  const rec = api.db.recipients.find((x) => x.partner_id === P2);
  assert.equal(rec.address_lines, null);
  assert.equal(rec.active, false);
  assert.equal(api.db.pdfDeletions.length, 0, "its PDFs were queued and deleted at once");
  assert.ok(![...api.db.pdfs.keys()].some((k) => k.includes(l.id)));
  await api.call("list_import", { csv: listCsv(), list_version: "2026-11-16", mode: "replace" });
  assert.equal((await api.call("eligible_list")).body.rows.find((x) => x.partner_id === P2).reasons[0].code, "opted_out");
  // A BAJA message typed in later can be matched to a studio.
  api.db.optouts.push({ id: "0b0b0b0b-0000-4000-8000-000000000001", channel: "whatsapp", from_ref: "34600000000", message: "BAJA ABC234", ref_code: "ABC234", partner_id: null, matched_by: null, matched_at: null, created_at: "2026-11-21T10:00:00Z" });
  const m = await api.call("optout_match", { optout_id: "0b0b0b0b-0000-4000-8000-000000000001", partner_id: P3 });
  assert.equal(m.status, 200);
  assert.equal(api.db.optouts.find((o) => o.id === "0b0b0b0b-0000-4000-8000-000000000001").partner_id, P3);
});

test("list import: all or nothing, unknown studios, live mode needs the passcode", async () => {
  const api = await makeApi();
  const bad = listCsv() + "\n" + "a1a1a1a1-0000-4000-8000-0000000000ff,X,Estudio X,Calle 1,28004 Madrid,,,28004,Madrid,,high";
  const r = await api.call("list_import", { csv: bad, list_version: "2026-11-15", mode: "replace" });
  assert.equal(r.status, 422);
  assert.equal(r.body.errors[0].line, 6);
  assert.equal(api.db.recipients.length, 0);
  api.env.LETTERS_MODE = "live";
  assert.equal((await api.call("list_import", { csv: listCsv(), list_version: "2026-11-15", mode: "replace" })).body.error, "wrong_passcode");
  assert.equal((await api.call("list_import", { csv: listCsv(), list_version: "2026-11-15", mode: "replace", passcode: PASS })).status, 200);
  // Replace keeps history: old rows are deactivated, not deleted.
  api.env.LETTERS_MODE = "test";
  assert.equal((await api.call("list_import", { csv: listCsv(), list_version: "2026-11-16", mode: "replace" })).body.deactivated, 4);
  assert.equal(api.db.recipients.length, 8);
  assert.equal(api.db.recipients.filter((x) => x.active).length, 4);
});

test("audit_list returns events newest first; whoami never returns secrets", async () => {
  const api = await makeApi({ env: STAGING });
  await importList(api);
  const w = await api.call("whoami");
  const text = JSON.stringify(w.body);
  for (const secret of [PASS, "csecret", "service-role-test", WH_SECRET]) assert.equal(text.includes(secret), false, secret);
  assert.equal(w.body.readiness.pingen_client_secret, true);
  const ev = (await api.call("audit_list")).body.events;
  assert.equal(ev[0].event, "list_imported");
});

test("send: an unknown outcome is never retried blindly; Refresh from Pingen reconciles it", async () => {
  const api = await makeApi();
  const { campaignId, letters } = await prepare(api);
  await goStaging(api, campaignId);
  api.net.pingen.failSendOnce = true;
  const id = letters[0].id;
  const s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: [id], confirm_count: 1, confirm_total: "0.97", passcode: PASS });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.posted, 0);
  const l = api.db.letters.find((x) => x.id === id);
  assert.equal(l.status, "error");
  assert.match(l.last_error, /Send outcome unknown/);
  assert.equal(pingenCalls(api).filter((c) => c.url.endsWith("/send")).length, 1, "tried once, not retried");
  // An errored letter is not posted again by a send; refresh brings it back to ready.
  const again = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: [id], confirm_count: 0, confirm_total: "0.00", passcode: PASS });
  assert.equal(again.status, 422);
  const r = await api.call("pingen_refresh", { campaign_id: campaignId });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(api.db.letters.find((x) => x.id === id).status, "ready");
  assert.deepEqual(api.db.events.filter((e) => e.letter_id === id && e.to_status).map((e) => e.to_status).slice(-3), ["error", "checking", "ready"]);
});

test("a staging rehearsal does not count as writing; its copy can run live; Pingen stuck validating is left to refresh", async () => {
  const api = await makeApi();
  const { campaignId, letters } = await prepare(api);
  await goStaging(api, campaignId);
  const ids = letters.map((l) => l.id);
  const s = await api.call("campaign_send", { campaign_id: campaignId, letter_ids: ids, confirm_count: 3, confirm_total: "2.91", passcode: PASS });
  assert.equal(s.body.posted, 3);
  const copy = await api.call("campaign_duplicate", { campaign_id: campaignId, name: "Piloto en vivo" });
  assert.equal(copy.status, 200, JSON.stringify(copy.body));
  assert.equal(copy.body.created, 3, JSON.stringify(copy.body.skipped));
  assert.match(copy.body.note, /new reference code/);
  // A test-mode campaign with approved letters does block another campaign until it is closed.
  const api2 = await makeApi();
  const p2 = await prepare(api2);
  const rids = (await api2.call("eligible_list")).body.rows.map((r) => r.recipient_id);
  const blocked = await api2.call("campaign_create", { name: "Segunda", recipient_ids: rids });
  assert.equal(blocked.status, 422);
  assert.equal((await api2.call("campaign_set_status", { campaign_id: p2.campaignId, status: "closed" })).status, 200);
  assert.equal((await api2.call("campaign_create", { name: "Segunda", recipient_ids: rids })).body.created, 3);
  // Pingen still validating after every poll: the letter stays "checking".
  const api3 = await makeApi();
  const p3 = await prepare(api3);
  api3.net.pingen.validStatus = "validating";
  const q = await goStaging(api3, p3.campaignId);
  assert.ok(q.outcomes.every((o) => o.status === "checking"), JSON.stringify(q.outcomes));
});
