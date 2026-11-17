// Letters: the fixes from the 17 Nov security, UX and test reviews, end to end
// through the real handler (api.ts) with the in-memory store and mocked
// network of _helpers.mjs. Nothing reaches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { makeApi, listCsv, GOOD_SETTINGS, PASS, ORG, WH_SECRET, P1, P2, P3, SUPA, CSV_HEADER } from "./_helpers.mjs";
import { defaultTemplate, useApprovedFeeWording } from "../../supabase/functions/letters/templates.ts";

const STAGING = { LETTERS_MODE: "staging", PINGEN_CLIENT_ID: "cid", PINGEN_CLIENT_SECRET: "csecret", PINGEN_ORGANISATION_ID: ORG };
const LIVE = { ...STAGING, LETTERS_MODE: "live" };
const PROOF_ROW = "proof,Jordan Ejemplo,Jordan Ejemplo,Calle Remite 1,28004 Madrid,,,28004,Madrid,unit known,high";
const pingenCalls = (api) => api.net.calls.filter((c) => /pingen\.com/.test(c.url));
const sends = (api) => pingenCalls(api).filter((c) => c.url.endsWith("/send"));

async function look(api, id, how = "full") {
  const p = await api.call("letter_preview", { letter_id: id });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const s = await api.call("letter_seen", { letter_id: id, sha256: p.body.sha256, how });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  return p;
}
async function approve(api, id) {
  const p = await look(api, id);
  const a = await api.call("letter_approve", { letter_id: id, sha256: p.body.sha256, ack_warnings: true });
  assert.equal(a.status, 200, JSON.stringify(a.body));
}
async function prepare(api, { csv = listCsv(), approveAll = true } = {}) {
  assert.equal((await api.call("settings_update", { settings: GOOD_SETTINGS })).status, 200);
  assert.equal((await api.call("list_import", { csv, list_version: "2026-11-15", mode: "replace" })).status, 200);
  const ids = (await api.call("eligible_list")).body.rows.map((r) => r.recipient_id);
  const c = await api.call("campaign_create", { name: "Piloto", recipient_ids: ids, template: useApprovedFeeWording(defaultTemplate()) });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const cid = c.body.campaign.id;
  const letters = (await api.call("campaign_get", { campaign_id: cid })).body.letters;
  if (approveAll) for (const l of letters) await approve(api, l.id);
  return { cid, letters };
}
const testBaja = (api, at = "2026-11-17T09:00:00Z") => api.db.optouts.push({ id: crypto.randomUUID(), channel: "whatsapp", from_ref: "+15550000000", message: "BAJA", message_en: "UNSUBSCRIBE", ref_code: null, partner_id: null, matched_by: null, matched_at: null, test: true, undone_at: null, created_at: at });

test("UX H3 / security L14: fetching a letter is not looking at it; letter_seen after drawing is", async () => {
  const api = await makeApi();
  const { letters } = await prepare(api, { approveAll: false });
  const l = letters[0];
  const p = await api.call("letter_preview", { letter_id: l.id });
  let a = await api.call("letter_approve", { letter_id: l.id, sha256: p.body.sha256, ack_warnings: true });
  assert.equal(a.body.error, "stale", "bytes fetched but never drawn");
  assert.equal((await api.call("letter_seen", { letter_id: l.id, sha256: "0".repeat(64), how: "full" })).body.error, "stale");
  assert.equal((await api.call("letter_seen", { letter_id: l.id, sha256: p.body.sha256, how: "glance" })).status, 400);
  assert.equal((await api.call("letter_seen", { letter_id: l.id, sha256: p.body.sha256, how: "crops" })).status, 200);
  a = await api.call("letter_approve", { letter_id: l.id, sha256: p.body.sha256, ack_warnings: true });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(api.db.events.find((e) => e.event === "previewed" && e.letter_id === l.id).detail.how, "crops");
});

test("test report: template_validate is the server's check; lists never carry the QR bearer link", async () => {
  const api = await makeApi();
  const v = await api.call("template_validate", { template: defaultTemplate() });
  assert.equal(v.status, 200);
  assert.deepEqual(v.body.check.errors.map((e) => e.code), ["fee_sentence"]);
  assert.equal((await api.call("template_validate", { template: useApprovedFeeWording(defaultTemplate()) })).body.check.ok, true);
  assert.equal((await api.call("template_validate", { template: "x" })).status, 400);
  const { cid, letters } = await prepare(api, { approveAll: false });
  await look(api, letters[0].id);
  const g = await api.call("campaign_get", { campaign_id: cid });
  assert.ok(g.body.letters.every((l) => !("qr_url" in l)));
  assert.ok(g.body.letters.every((l) => l.town === "Madrid"));
  assert.ok((await api.call("letter_preview", { letter_id: letters[0].id })).body.qr_url.startsWith("https://book.massageclub.io/socios?"));
});

test("UX M8: a settings dry run says how many approvals a printed change clears, and saves nothing", async () => {
  const api = await makeApi();
  await prepare(api);
  const d = await api.call("settings_update", { settings: { return_street: "Calle Remite 2" }, dry_run: true });
  assert.equal(d.status, 200);
  assert.equal(d.body.printed_changed, true);
  assert.equal(d.body.would_clear, 3);
  assert.equal(api.db.settings.return_street, "Calle Remite 1", "nothing saved");
  assert.equal(api.db.letters.filter((l) => l.status === "approved").length, 3);
  const d2 = await api.call("settings_update", { settings: { daily_cap: 40 }, dry_run: true });
  assert.equal(d2.body.printed_changed, false);
  assert.equal(d2.body.would_clear, 0);
});

test("UX M7: the privacy page is fetched and must have its #section and no FALTA", async () => {
  const api = await makeApi();
  await api.call("settings_update", { settings: GOOD_SETTINGS });
  let w = (await api.call("whoami")).body.readiness;
  assert.equal(w.privacy_url, false, "set but not checked is not green");
  let c = await api.call("privacy_check");
  assert.equal(c.body.ok, true, JSON.stringify(c.body));
  assert.equal((await api.call("whoami")).body.readiness.privacy_url, true);
  // A new URL needs a new check; a page without the section or with FALTA fails.
  api.net.pages["https://book.massageclub.io/privacidad"] = '<html><body><h1>Privacidad</h1><section id="clientes"></section></body></html>';
  await api.call("settings_update", { settings: { privacy_url: "https://book.massageclub.io/privacidad#negocios" } });
  assert.equal((await api.call("whoami")).body.readiness.privacy_url, false);
  c = await api.call("privacy_check");
  assert.equal(c.body.ok, false);
  assert.match(c.body.note, /no section with id "negocios"/);
  api.net.pages["https://book.massageclub.io/privacidad"] = '<html><body><section id="negocios">Responsable: [FALTA: remitente legal]</section></body></html>';
  assert.match((await api.call("privacy_check")).body.note, /FALTA/);
  api.net.pages["https://book.massageclub.io/privacidad"] = '<html><body><section id="negocios">Responsable: Remitente Ejemplo S.L.</section></body></html>';
  assert.equal((await api.call("privacy_check")).body.ok, true);
});

test("security and UX H2: the BAJA route is confirmed only after a test BAJA came through WhatsApp", async () => {
  const api = await makeApi();
  let r = await api.call("optout_route_confirm", { confirmed: true });
  assert.equal(r.status, 412);
  assert.equal(r.body.error, "optout_route_not_tested");
  testBaja(api, "2026-11-01T09:00:00Z");
  assert.equal((await api.call("optout_route_confirm", { confirmed: true })).body.error, "optout_route_not_tested", "older than 7 days");
  testBaja(api);
  r = await api.call("optout_route_confirm", { confirmed: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.test_seen_at, "2026-11-17T09:00:00Z");
  assert.ok(api.db.settings.optout_route_confirmed_at);
  // A test BAJA never matches a studio.
  const t = api.db.optouts.find((o) => o.test);
  assert.equal((await api.call("optout_match", { optout_id: t.id, partner_id: P1 })).status, 422);
});

test("security M1: a BAJA needs a letter studio; an active partner's stops letters only; undo restores", async () => {
  const api = await makeApi();
  await prepare(api);
  // Not on the list and no letter: refused.
  api.db.partners.push({ id: "a1a1a1a1-0000-4000-8000-000000000009", business_name: "Socio Activo Ejemplo", slug: "socio-activo", status: "active", opted_out_at: null, outreach_status: null, address: "Calle Activa 1", slots_link_v: 1 });
  let r = await api.call("optout_mark", { partner_id: "a1a1a1a1-0000-4000-8000-000000000009", channel: "email" });
  assert.equal(r.status, 422);
  assert.equal(api.db.partners.at(-1).opted_out_at, null);
  // An active partner on the list: letters only, bookings untouched.
  api.db.partners.find((p) => p.id === P1).status = "active";
  r = await api.call("optout_mark", { partner_id: P1, channel: "whatsapp", message: "BAJA" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.scope, "letters");
  assert.equal(api.db.partners.find((p) => p.id === P1).opted_out_at, null);
  assert.equal(api.db.letters.find((l) => l.partner_id === P1).status, "withdrawn");
  // Stopping every contact for an active partner needs an explicit yes.
  assert.equal((await api.call("optout_mark", { partner_id: P1, channel: "email", scope: "all" })).status, 422);
  // A prospect: every contact stops, and the old value is kept for an undo.
  r = await api.call("optout_mark", { partner_id: P2, channel: "email", message: "No nos escribáis" });
  assert.equal(r.body.scope, "all");
  const at = api.db.partners.find((p) => p.id === P2).opted_out_at;
  assert.ok(at);
  const row = api.db.optouts.find((o) => o.partner_id === P2);
  assert.equal(row.opted_out_set_at, at);
  assert.equal(row.prev_opted_out_at, null);
  assert.equal((await api.call("optout_undo", { optout_id: row.id })).status, 400, "a reason is needed");
  const u = await api.call("optout_undo", { optout_id: row.id, reason: "matched to the wrong studio" });
  assert.equal(u.body.opted_out_restored, true);
  assert.equal(api.db.partners.find((p) => p.id === P2).opted_out_at, null);
  assert.ok(api.db.optouts.find((o) => o.id === row.id).undone_at);
  const list = (await api.call("optouts_list")).body.optouts;
  assert.equal(list.find((o) => o.partner_id === P1).partner_name, "Estudio Ficticio Alfa");
});

test("security M2: a letter that comes back revokes the studio's signed link", async () => {
  const api = await makeApi();
  const { cid } = await prepare(api);
  Object.assign(api.env, STAGING);
  await api.call("campaign_queue", { campaign_id: cid });
  const d = await api.call("campaign_dry_run", { campaign_id: cid });
  const s = await api.call("campaign_send", { campaign_id: cid, letter_ids: d.body.batch, confirm_count: d.body.confirm_count, confirm_total: d.body.confirm_total, passcode: PASS });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const l = api.db.letters.find((x) => x.partner_id === P2);
  const before = api.db.partners.find((p) => p.id === P2).slots_link_v;
  const body = { data: { id: "ev-1", type: "webhook_undeliverable", attributes: { reason: "unknown recipient", url: "x", created_at: "2026-11-20T09:42:48+0100" }, relationships: { organisation: { data: { id: ORG, type: "organisations" } }, deliverable: { data: { id: l.pingen_letter_id, type: "letters" } }, event: { data: { id: "ev-1", type: "letters_events" } } } } };
  const raw = JSON.stringify(body);
  const res = await api.handler(new Request(`${SUPA}/functions/v1/letters?pingen_webhook=1`, { method: "POST", headers: { signature: createHmac("sha256", WH_SECRET).update(raw).digest("hex") }, body: raw }));
  assert.equal(res.status, 200);
  assert.equal(api.db.letters.find((x) => x.id === l.id).status, "undeliverable");
  assert.equal(api.db.partners.find((p) => p.id === P2).slots_link_v, before + 1);
  assert.ok(api.db.events.some((e) => e.event === "link_revoked" && e.detail.partner_id === P2));
});

test("test report m and e: refused letters never starve the upload; the simulation selector works", async () => {
  const api = await makeApi();
  const { cid, letters } = await prepare(api);
  // The first letter's studio wrote BAJA (letters only): it is refused at the
  // front of the list, and the others are still uploaded.
  const first = letters[0];
  api.db.optouts.push({ id: crypto.randomUUID(), channel: "whatsapp", partner_id: first.partner_id, test: false, undone_at: null, scope: "letters", created_at: "2026-11-17T09:00:00Z" });
  Object.assign(api.env, STAGING);
  const q = await api.call("campaign_queue", { campaign_id: cid, simulate: "undeliverable" });
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.done, true);
  assert.equal(q.body.uploaded, 2);
  assert.equal(q.body.refused, 1);
  assert.match(q.body.outcomes.find((o) => o.letter_id === first.id).message, /no more letters/);
  assert.ok([...api.net.pingen.letters.values()].every((x) => /_simulate_undeliverable\.pdf$/.test(x.name)));
});

test("test report a and b, UX M9: the dry run picks the batch the server takes; one refused letter does not block", async () => {
  const api = await makeApi();
  const { cid } = await prepare(api);
  Object.assign(api.env, STAGING);
  await api.call("campaign_queue", { campaign_id: cid });
  api.db.settings.max_per_send = 2;
  // One studio opted out after the upload: it is listed as refused.
  api.db.partners.find((p) => p.id === P3).opted_out_at = "2026-11-17T09:30:00Z";
  const d = (await api.call("campaign_dry_run", { campaign_id: cid })).body;
  assert.equal(d.would_post.length, 2);
  assert.equal(d.batch.length, 2);
  assert.equal(d.confirm_count, 2);
  assert.equal(d.confirm_total, "1.94");
  assert.equal(d.letters.filter((x) => !x.ok).length, 1);
  const s = await api.call("campaign_send", { campaign_id: cid, letter_ids: d.batch, confirm_count: d.confirm_count, confirm_total: d.confirm_total, passcode: PASS });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(s.body.posted, 2);
  assert.equal((await api.call("whoami")).body.limits.posted_today, 2);
});

test("security L6: a closed campaign is never uploaded or posted", async () => {
  const api = await makeApi();
  const { cid, letters } = await prepare(api);
  Object.assign(api.env, STAGING);
  await api.call("campaign_queue", { campaign_id: cid });
  // Closing is refused while letters are at Pingen; force it as an old row would be.
  api.db.campaigns[0].status = "closed";
  assert.equal((await api.call("campaign_queue", { campaign_id: cid })).body.error, "wrong_state");
  const s = await api.call("campaign_send", { campaign_id: cid, letter_ids: letters.map((l) => l.id), confirm_count: 3, confirm_total: "2.91", passcode: PASS });
  assert.equal(s.body.error, "wrong_state");
  assert.equal(sends(api).length, 0);
});

test("UX H2 and M3, security M3: live posts the proof first, then studios; credit, privacy and retention are checked", async () => {
  const api = await makeApi();
  const { cid, letters } = await prepare(api, { csv: listCsv() + "\n" + PROOF_ROW });
  const proof = letters.find((l) => l.kind === "proof");
  assert.ok(proof, "the proof row is in the campaign");
  Object.assign(api.env, LIVE);
  testBaja(api);
  assert.equal((await api.call("optout_route_confirm", { confirmed: true })).status, 200);
  await api.call("campaign_queue", { campaign_id: cid });
  const post = async (d) => await api.call("campaign_send", { campaign_id: cid, letter_ids: d.batch, confirm_count: d.confirm_count, confirm_total: d.confirm_total, passcode: PASS });
  let d = (await api.call("campaign_dry_run", { campaign_id: cid })).body;
  // Live needs the privacy page checked and Pingen's retention read first.
  assert.equal((await post(d)).body.error, "privacy_not_checked");
  assert.equal((await api.call("privacy_check")).body.ok, true);
  assert.equal((await post(d)).body.error, "retention_not_checked");
  api.net.org.data_retention_addresses = 18;
  assert.equal((await api.call("pingen_check")).body.retention.ok, false);
  assert.match((await post(d)).body.message, /addresses 18 months/);
  api.net.org.data_retention_addresses = 12;
  assert.equal((await api.call("pingen_check")).body.retention.ok, true);
  // Only the proof is in the batch until it is confirmed.
  d = (await api.call("campaign_dry_run", { campaign_id: cid })).body;
  assert.deepEqual(d.batch, [proof.id]);
  assert.equal(d.proof.needed, true);
  assert.ok(d.letters.filter((x) => x.kind === "studio").every((x) => /proof letter/.test(x.reason)));
  // Studio letters sent directly are refused too.
  const studios = letters.filter((l) => l.kind === "studio").map((l) => l.id);
  let s = await api.call("campaign_send", { campaign_id: cid, letter_ids: studios, confirm_count: 3, confirm_total: "2.91", passcode: PASS });
  assert.equal(s.body.error, "numbers_changed");
  assert.equal(s.body.confirm_count, 0);
  assert.equal((await api.call("campaign_proof_confirm", { campaign_id: cid, confirmed: true, arrived: true, looks_right: true, qr_opens: true })).body.error, "wrong_state", "not posted yet");
  s = await post(d);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(sends(api).length, 1);
  assert.equal((await api.call("campaign_proof_confirm", { campaign_id: cid, confirmed: true, arrived: true })).status, 400, "all three ticks");
  assert.equal((await api.call("campaign_proof_confirm", { campaign_id: cid, confirmed: true, arrived: true, looks_right: true, qr_opens: true })).status, 200);
  d = (await api.call("campaign_dry_run", { campaign_id: cid })).body;
  assert.equal(d.batch.length, 3);
  // Pingen credit lower than the post: refused before anything is sent.
  api.net.org.billing_balance = 1;
  s = await post(d);
  assert.equal(s.body.error, "insufficient_credits");
  assert.match(s.body.message, /credit is 1\.00 EUR and this post costs 2\.91 EUR/);
  assert.equal(sends(api).length, 1);
  api.net.org.billing_balance = 25;
  s = await post(d);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal(sends(api).length, 4);
});

test("UX M4 and M5: list warnings accepted at import; a corrected row reaches the letter and clears its approval", async () => {
  const api = await makeApi();
  await api.call("settings_update", { settings: GOOD_SETTINGS });
  await api.call("list_import", { csv: listCsv(), list_version: "v1", mode: "replace", accept_warnings: true });
  const gamma = (await api.call("eligible_list")).body.rows.find((r) => r.partner_id === P3);
  assert.deepEqual(gamma.warnings, [], "unit unknown and medium confidence were decided at import");
  assert.ok(gamma.warnings_acked_at);
  const ids = (await api.call("eligible_list")).body.rows.map((r) => r.recipient_id);
  const c = await api.call("campaign_create", { name: "Piloto", recipient_ids: ids, template: useApprovedFeeWording(defaultTemplate()) });
  const cid = c.body.campaign.id;
  const lp = (await api.call("campaign_get", { campaign_id: cid })).body.letters.find((l) => l.partner_id === P1);
  await approve(api, lp.id);
  assert.equal(api.db.letters.find((l) => l.id === lp.id).status, "approved");
  const fixed = listCsv().replace("Calle Ejemplo 1, 2º B", "Calle Ejemplo 3, 2º B");
  const r = await api.call("list_import", { csv: fixed, list_version: "v2", mode: "replace" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.letters_updated >= 1);
  const after = api.db.letters.find((l) => l.id === lp.id);
  assert.equal(after.status, "review");
  assert.equal(after.approved_sha256, null);
  const p = await look(api, lp.id);
  assert.ok(p.body.address_lines.includes("Calle Ejemplo 3, 2º B"));
});

test("security M3: 12 months after the mailing the address, QR link and PDF go; the guard refuses a letter born posted", async () => {
  const api = await makeApi();
  const { cid } = await prepare(api);
  Object.assign(api.env, STAGING);
  await api.call("campaign_queue", { campaign_id: cid });
  const d = (await api.call("campaign_dry_run", { campaign_id: cid })).body;
  await api.call("campaign_send", { campaign_id: cid, letter_ids: d.batch, confirm_count: d.confirm_count, confirm_total: d.confirm_total, passcode: PASS });
  const posted = api.db.letters.filter((l) => l.status === "submitted");
  assert.equal(posted.length, 3);
  assert.ok(posted.every((l) => l.pdf_path && l.qr_url && l.address_lines));
  // Six months on: nothing is purged.
  api.setNow("2027-05-17T10:00:00Z");
  assert.equal((await api.call("retention_purge")).body.letters, 0);
  // Thirteen months on (letters still submitted at Pingen are left alone).
  api.setNow("2027-12-20T10:00:00Z");
  for (const l of api.db.letters) if (l.status === "submitted") { l.status = "delivered"; l.sent_at = l.submitted_at; }
  const r = await api.call("retention_purge");
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.letters, 3);
  assert.equal(r.body.pdfs_deleted, 3);
  assert.ok(api.db.letters.filter((l) => l.status === "delivered").every((l) => !l.pdf_path && !l.qr_url && !l.address_lines && l.purged_at));
  assert.equal(api.db.pdfs.size, 0);
  assert.ok(api.db.recipients.every((x) => x.address_lines === null && !x.active));
  // The guard (mirrored in memory) refuses a letter inserted as anything but a draft.
  await assert.rejects(api.store.insertLetters([{ campaign_id: cid, recipient_id: api.db.recipients[0].id, partner_id: P1, ref_code: "ZZZ234", status: "sending" }]), /draft/);
});

test("CSV header is unchanged (the proof row uses the same columns)", () => {
  assert.equal(CSV_HEADER, "id,name,line1,line2,line3,line4,line5,postcode,town,unit_status,confidence");
});
