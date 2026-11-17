// Shared helpers for the letters tests: an in-memory Store that mirrors the
// SQL constraints and the letters_guard trigger of 20261117_letters.sql, a
// mocked fetch for Supabase Auth and Pingen (staging and production), and
// synthetic fixtures. No real studio data here: the repo is public.
//
// Run: npm run test:letters  (node --experimental-strip-types --test 'tests/letters/*.test.mjs')
// The render tests also need pdf-lib, @pdf-lib/fontkit, qrcode-generator, jsqr
// and pngjs: set LETTERS_LIBS to a node_modules folder that has them (kept
// outside the repo), or they are skipped.

import { createRequire } from "node:module";
import { canTransition, DEFAULT_SETTINGS, canonicalJson } from "../../supabase/functions/letters/rules.ts";
import { mergedTexts } from "../../supabase/functions/letters/render.ts";

export const SUPA = "https://proj.supabase.test";
export const ORG = "11111111-2222-4333-8444-555555555555";
export const ADMIN = "jordan@massageclub.io";
export const ADMIN_ID = "d0d0d0d0-0000-4000-8000-00000000000a";
export const OTHER_ID = "d0d0d0d0-0000-4000-8000-00000000000b";
export const ADMIN_TOKEN = "tok_admin_aaaaaaaaaaaaaaaaaaaaaaaa";
export const OTHER_TOKEN = "tok_other_bbbbbbbbbbbbbbbbbbbbbbbb";
// A Supabase Auth user as GET /auth/v1/user returns it, signed in with Google.
export const googleUser = (id, email, extra = {}) => ({
  id, email, email_confirmed_at: "2026-01-01T00:00:00Z",
  identities: [{ provider: "google", identity_data: { email, email_verified: true } }], ...extra,
});
export const PASS = "correct horse battery";
export const SIGN_KEY = "test-sign-key-not-a-real-one-0123456789";
export const WH_SECRET = "whsec_test_0123456789abcdef";

export function loadLibs() {
  const dir = process.env.LETTERS_LIBS;
  if (!dir) return null;
  try {
    const req = createRequire(dir.endsWith("/") ? dir : dir + "/");
    const pdf = req("pdf-lib");
    return {
      libs: { PDFDocument: pdf.PDFDocument, rgb: pdf.rgb, grayscale: pdf.grayscale, fontkit: req("@pdf-lib/fontkit"), qrcode: req("qrcode-generator") },
      jsQR: req("jsqr"), PNG: req("pngjs").PNG,
    };
  } catch (e) {
    console.log("# render libraries not found in LETTERS_LIBS:", e.message);
    return null;
  }
}

export const uuid = () => crypto.randomUUID();
export const P1 = "a1a1a1a1-0000-4000-8000-000000000001";
export const P2 = "a1a1a1a1-0000-4000-8000-000000000002";
export const P3 = "a1a1a1a1-0000-4000-8000-000000000003";
export const P4 = "a1a1a1a1-0000-4000-8000-000000000004";

export function partners() {
  return [
    { id: P1, business_name: "Estudio Ficticio Alfa", slug: "estudio-ficticio-alfa", status: "pending", opted_out_at: null, outreach_status: "contacted", address: "Calle Ejemplo 1, 28004 Madrid", slots_link_v: 1 },
    { id: P2, business_name: "Centro Inventado Beta", slug: "centro-inventado-beta", status: "pending", opted_out_at: null, outreach_status: null, address: "Avenida Imaginaria 22, 28010 Madrid", slots_link_v: 3 },
    { id: P3, business_name: "Masajes Muestra Gamma", slug: null, status: "pending", opted_out_at: null, outreach_status: null, address: "Plaza Supuesta 5, 28013 Madrid", slots_link_v: 1 },
    { id: P4, business_name: "Spa Prueba Delta", slug: "spa-prueba-delta", status: "pending", opted_out_at: null, outreach_status: null, address: "Calle Ficticia 9, 28001 Madrid", slots_link_v: 1 },
  ];
}

export const CSV_HEADER = "id,name,line1,line2,line3,line4,line5,postcode,town,unit_status,confidence";
export function listCsv() {
  return [
    CSV_HEADER,
    `${P1},Estudio Ficticio Alfa,Estudio Ficticio Alfa,"Calle Ejemplo 1, 2º B",28004 Madrid,,,28004,Madrid,unit known,high`,
    `${P2},Centro Inventado Beta,Centro Inventado Beta,Local 3,Avenida Imaginaria 22,28010 Madrid,,28010,Madrid,unit known,high`,
    `${P3},Masajes Muestra Gamma,Masajes Muestra Gamma,Plaza Supuesta 5,28013 Madrid,,,28013,Madrid,unit unknown,medium`,
    `${P4},Spa Prueba Delta,Spa Prueba Delta,Calle Ficticia 9,28001 Madrid,,,28001,Madrid,unit known,high`,
  ].join("\n");
}

export const GOOD_SETTINGS = {
  sender_type: "company", legal_sender_name: "Remitente Ejemplo S.L.", legal_sender_nif: "B12345674",
  return_street: "Calle Remite 1", return_postcode: "28004", return_city: "Madrid",
  privacy_url: "https://massageclub.io/privacy#negocios",
};

const APPROVED = ["approved", "uploading", "checking", "ready", "sending", "submitted", "sent", "delivered", "undeliverable", "unprintable"];
const UPLOADED = ["checking", "ready", "sending", "submitted", "sent", "delivered", "undeliverable", "unprintable"];

export function memStore() {
  const db = {
    settings: {
      ...DEFAULT_SETTINGS, optout_route_confirmed_by: null, pingen_price: null, pingen_currency: null, pingen_checked_at: null,
      privacy_checked_at: null, privacy_checked_url: null, privacy_check_ok: null, privacy_check_note: null,
      pingen_retention_addresses: null, pingen_retention_pdf: null, pingen_retention_checked_at: null, pingen_retention_env: null,
    },
    partners: partners(), recipients: [], campaigns: [], letters: [], events: [], optouts: [], rate: new Map(), pdfs: new Map(),
    funnel: [], signups: [], pdfDeletions: [],
  };
  let eid = 0;
  // The store's clock: the handler's clock when makeApi sets it (so the
  // 12-month purge can be tested), else the real time.
  let clockFn = () => new Date();
  const nowFn = () => clockFn().toISOString();
  const now = () => nowFn();
  const clone = (x) => (x == null ? x : structuredClone(x));
  const winStart = (s) => Math.floor(Date.now() / 1000 / s) * s;

  const optedOutLetters = (pid) => db.optouts.some((o) => o.partner_id === pid && !o.undone_at && !o.test);
  // Mirrors letters_guard and the two CHECK constraints.
  function guard(old, next) {
    if (next.status !== old.status && !canTransition(old.status, next.status)) throw Object.assign(new Error(`letters: ${old.status} cannot become ${next.status}`), { db: true });
    if (["uploading", "sending"].includes(next.status) && next.status !== old.status) {
      const s = db.settings;
      if (!s.legal_sender_name || !s.sender_type || !s.return_street || !s.return_postcode || !s.return_city || !s.privacy_url || (s.sender_type === "company" && !s.legal_sender_nif)) throw new Error("letters: legal sender, return address or privacy page is empty");
      if (next.partner_id) {
        const p = db.partners.find((x) => x.id === next.partner_id);
        if (!p || p.opted_out_at || ["suspended", "archived", "active"].includes(p.status) || p.outreach_status === "opted_out") throw new Error("letters: studio is opted out or not writable");
        if (optedOutLetters(next.partner_id)) throw new Error("letters: studio asked for no more letters (BAJA)");
      }
      if (!next.approved_sha256 || next.approved_sha256 !== next.pdf_sha256) throw new Error("letters: not approved for these bytes");
    }
    if (APPROVED.includes(next.status) && !(next.approved_sha256 && next.approved_sha256 === next.pdf_sha256)) throw new Error(`letters_approved_bytes violated (${next.status})`);
    if (UPLOADED.includes(next.status) && !(next.uploaded_sha256 === next.approved_sha256 && next.pingen_letter_id)) throw new Error(`letters_uploaded_bytes violated (${next.status})`);
  }

  const blankLetter = () => ({
    status_reason: null, greeting_name: null, address_lines: null, qr_url: null, link_v: null, render_inputs_sha256: null, renderer_version: null,
    pdf_path: null, pdf_sha256: null, pdf_bytes: null, layout: null, rendered_at: null, previewed_sha256: null, previewed_at: null, previewed_by: null,
    approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false, rejected_at: null, rejected_by: null, reject_reason: null,
    pingen_env: null, pingen_letter_id: null, pingen_status: null, pingen_address: null, pingen_pages: null, pingen_fonts: null, pingen_price: null,
    pingen_currency: null, uploaded_sha256: null, uploaded_at: null, submitted_at: null, submitted_by: null, sent_at: null, delivered_at: null,
    undeliverable_at: null, cancelled_at: null, last_error: null,
  });

  const store = {
    async getSettings() { return clone(db.settings); },
    async updateSettings(p) { Object.assign(db.settings, p, { updated_at: now() }); return clone(db.settings); },
    async listRecipients({ activeOnly, kind }) { return clone(db.recipients.filter((r) => (!activeOnly || r.active) && (!kind || r.kind === kind))); },
    async getRecipients(ids) { return clone(db.recipients.filter((r) => ids.includes(r.id))); },
    async insertRecipients(rows) {
      const out = rows.map((r) => ({ id: uuid(), imported_at: now(), note: null, ...r }));
      for (const r of out) {
        if (r.active && r.kind === "studio" && db.recipients.some((x) => x.active && x.kind === "studio" && x.partner_id === r.partner_id)) throw new Error("letter_recipients_one_active violated");
        if (r.address_lines != null && (r.address_lines.length < 3 || r.address_lines.length > 7)) throw new Error("letter_recipients_lines violated");
        db.recipients.push(r);
      }
      return clone(out);
    },
    async deactivateRecipients({ kind, partner_ids }) {
      let n = 0;
      for (const r of db.recipients) if (r.active && (partner_ids ? partner_ids.includes(r.partner_id) : !kind || r.kind === kind)) { r.active = false; n++; }
      return n;
    },
    async updateRecipient(id, p) { Object.assign(db.recipients.find((r) => r.id === id) || {}, p); },
    async getPartners(ids) { return clone(db.partners.filter((p) => ids.includes(p.id))); },
    async countPartnersWithSlug(slug) { return db.partners.filter((p) => p.slug === slug).length; },
    async setPartnerOptedOut(id, at) {
      const p = db.partners.find((x) => x.id === id);
      if (!p) return { partner: null, previous: null, changed: false };
      if (!p.opted_out_at) { p.opted_out_at = at; return { partner: clone(p), previous: null, changed: true }; }
      return { partner: clone(p), previous: p.opted_out_at, changed: false };
    },
    async restorePartnerOptedOut(id, previous, current) {
      const p = db.partners.find((x) => x.id === id);
      if (!p || p.opted_out_at !== current) return false;
      p.opted_out_at = previous;
      return true;
    },
    async bumpPartnerLink(id) { const p = db.partners.find((x) => x.id === id); if (!p) return null; p.slots_link_v = Number(p.slots_link_v || 1) + 1; return p.slots_link_v; },
    async recipientsForPartners(ids) { return clone(db.recipients.filter((r) => ids.includes(r.partner_id))); },
    async listCampaigns() { return clone([...db.campaigns].reverse()); },
    async getCampaign(id) { return clone(db.campaigns.find((c) => c.id === id) ?? null); },
    async insertCampaign(row) { const c = { id: uuid(), created_at: now(), updated_at: now(), ...row }; db.campaigns.push(c); return clone(c); },
    async updateCampaign(id, p, expectedVersion) {
      const c = db.campaigns.find((x) => x.id === id);
      if (!c || (expectedVersion !== undefined && c.template_version !== expectedVersion)) return null;
      Object.assign(c, p, { updated_at: now() });
      return clone(c);
    },
    async listLetters(f) {
      let ls = db.letters;
      if (f.campaign_id) ls = ls.filter((l) => l.campaign_id === f.campaign_id);
      if (f.ids) ls = ls.filter((l) => f.ids.includes(l.id));
      if (f.partner_ids) ls = ls.filter((l) => f.partner_ids.includes(l.partner_id));
      if (f.statuses) ls = ls.filter((l) => f.statuses.includes(l.status));
      return clone(ls.slice(0, f.limit ?? 5000));
    },
    async getLetter(id) { return clone(db.letters.find((l) => l.id === id) ?? null); },
    async insertLetters(rows) {
      const out = rows.map((r) => ({ id: uuid(), ...blankLetter(), created_at: now(), updated_at: now(), ...r }));
      for (const l of out) {
        if (l.status !== "draft") throw new Error("letters: a new letter starts as draft");
        if (db.letters.some((x) => x.ref_code === l.ref_code)) throw new Error("ref_code unique violated");
        if (db.letters.some((x) => x.campaign_id === l.campaign_id && x.recipient_id === l.recipient_id)) throw new Error("unique (campaign_id, recipient_id) violated");
        db.letters.push(l);
      }
      return clone(out);
    },
    async updateLetter(id, p, expect) {
      const l = db.letters.find((x) => x.id === id);
      if (!l) return null;
      if (expect !== undefined && !(Array.isArray(expect) ? expect : [expect]).includes(l.status)) return null;
      const next = { ...l, ...p };
      guard(l, next);
      Object.assign(l, p, { updated_at: now() });
      return clone(l);
    },
    async findLetterByPingenId(pid) { return clone(db.letters.find((l) => l.pingen_letter_id === pid) ?? null); },
    async findLetterByRef(ref) { return clone(db.letters.find((l) => l.ref_code === ref) ?? null); },
    async refCodesTaken(codes) { return db.letters.filter((l) => codes.includes(l.ref_code)).map((l) => l.ref_code); },
    async countSubmittedSince(iso) { return db.letters.filter((l) => l.submitted_at && l.submitted_at >= iso).length; },
    async insertEvent(e) {
      if (e.pingen_event_id && db.events.some((x) => x.pingen_event_id === e.pingen_event_id)) return false;
      db.events.push({ id: ++eid, created_at: now(), ...clone(e) });
      return true;
    },
    async listEvents({ campaign_id, letter_id, limit }) {
      return clone(db.events.filter((e) => (!campaign_id || e.campaign_id === campaign_id) && (!letter_id || e.letter_id === letter_id)).reverse().slice(0, limit));
    },
    async insertOptout(row) { const o = { id: uuid(), created_at: now(), test: false, undone_at: null, ...row }; db.optouts.push(o); return clone(o); },
    async activeOptoutsFor(ids) { return clone(db.optouts.filter((o) => ids.includes(o.partner_id) && !o.undone_at && !o.test)); },
    async latestTestOptout(since) { return clone([...db.optouts].filter((o) => o.test && o.channel === "whatsapp" && o.created_at >= since).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null); },
    async listOptouts(limit) { return clone([...db.optouts].reverse().slice(0, limit)); },
    async getOptout(id) { return clone(db.optouts.find((o) => o.id === id) ?? null); },
    async updateOptout(id, p) { Object.assign(db.optouts.find((o) => o.id === id) || {}, p); },
    async rateHit(actor, kind, windowS, limit) {
      const k = `${actor}|${kind}|${winStart(windowS)}`;
      const n = (db.rate.get(k) || 0) + 1;
      db.rate.set(k, n);
      return n <= limit;
    },
    async ratePeek(actor, kind, windowS) { return db.rate.get(`${actor}|${kind}|${winStart(windowS)}`) || 0; },
    async putPdf(path, bytes) { db.pdfs.set(path, new Uint8Array(bytes)); },
    async getPdf(path) { const b = db.pdfs.get(path); return b ? new Uint8Array(b) : null; },
    async deletePdf(path) { db.pdfs.delete(path); },
    // Mirrors letters_purge_expired() in 20261117_letters.sql.
    async purgeExpired() {
      const cutoff = new Date(Date.parse(nowFn()) - 365 * 86400e3).toISOString();
      const busy = ["uploading", "checking", "ready", "blocked", "sending", "submitted", "error"];
      const done = ["withdrawn", "rejected", "sent", "delivered", "undeliverable", "unprintable", "cancelled"];
      const out = new Set([...db.partners.filter((p) => p.opted_out_at || p.outreach_status === "opted_out").map((p) => p.id), ...db.optouts.filter((o) => o.partner_id && !o.undone_at && !o.test).map((o) => o.partner_id)]);
      const r = { withdrawn: 0, pdfs_queued: 0, letters: 0, recipients: 0, optouts: 0, events: 0 };
      for (const l of db.letters) if (["draft", "review", "approved", "rejected"].includes(l.status) && out.has(l.partner_id)) { l.status = "withdrawn"; l.status_reason = "Studio asked not to be contacted (BAJA)."; r.withdrawn++; }
      for (const l of db.letters) {
        if (l.purged_at || busy.includes(l.status)) continue;
        if (!((l.submitted_at || l.created_at) < cutoff || (done.includes(l.status) && out.has(l.partner_id)))) continue;
        if (l.pdf_path && !db.pdfDeletions.includes(l.pdf_path)) { db.pdfDeletions.push(l.pdf_path); r.pdfs_queued++; }
        Object.assign(l, { address_lines: null, greeting_name: null, qr_url: null, pingen_address: null, pdf_path: null, status_reason: null, last_error: null, purged_at: nowFn() });
        r.letters++;
      }
      for (const x of db.recipients) {
        if (x.purged_at || db.letters.some((l) => l.recipient_id === x.id && busy.includes(l.status))) continue;
        const old = x.imported_at < cutoff && !db.letters.some((l) => l.recipient_id === x.id && (l.submitted_at || l.created_at) >= cutoff);
        if (!old && !out.has(x.partner_id)) continue;
        Object.assign(x, { address_lines: null, postcode: "", town: "", partner_address_at_import: null, needs_review: null, active: false, purged_at: nowFn() });
        r.recipients++;
      }
      for (const o of db.optouts) if (o.created_at < cutoff && (o.message || o.message_en || o.from_ref)) { o.message = null; o.message_en = null; o.from_ref = null; r.optouts++; }
      for (const e of db.events) if (e.created_at < cutoff && e.detail) { e.detail = null; r.events++; }
      return r;
    },
    async pdfDeletions(limit) { return db.pdfDeletions.slice(0, limit); },
    async pdfDeleted(path) { db.pdfDeletions = db.pdfDeletions.filter((p) => p !== path); },
    async funnelStats(pids) { return pids.map((pid) => ({ partner_id: pid, opened: db.funnel.filter((f) => f === pid).length, signed_up: db.signups.filter((f) => f === pid).length })); },
  };
  return { db, store, setClock: (fn) => { clockFn = fn; } };
}

// A stand-in renderer for the API tests: deterministic bytes that change
// whenever anything printed changes, and the same placeholder count the real
// renderer reports (missing settings, unsigned QR).
export async function stubRender(inp) {
  const t = mergedTexts(inp);
  const missing = [...t.body, ...t.optout, ...t.privacy].filter((r) => r.style === "missing").length + (inp.qrUrl ? 0 : 1);
  const bytes = new TextEncoder().encode("%PDF-stub\n" + canonicalJson({ ...inp, settings: undefined, printed: [t.privacy.map((r) => r.text).join(""), t.optout.map((r) => r.text).join("")] }));
  return { ok: true, bytes, layout: { renderer: "stub", sizes: { body: 10.5 }, line_counts: {}, placeholders: missing, placeholder_texts: [], body_space_left_mm: 10, boxes: [], qr: null, fonts: [], spectrum: inp.spectrum } };
}
export function stubPayload(bytes) {
  const s = new TextDecoder().decode(bytes);
  return JSON.parse(s.slice(s.indexOf("\n") + 1));
}

// Mocked network. Records every request; answers Supabase Auth and a small
// Pingen that keeps letters in memory.
export function mockNet(opts = {}) {
  const calls = [];
  const pingen = { letters: new Map(), uploads: new Map(), webhooks: [], failSendOnce: false, validStatus: "valid", addressOverride: null, tokenCount: 0 };
  const users = { [ADMIN_TOKEN]: googleUser(ADMIN_ID, ADMIN), [OTHER_TOKEN]: googleUser(OTHER_ID, "someone@example.com"), ...(opts.users || {}) };
  const org = { name: "Massage Club test org", status: "active", billing_mode: "prepaid", billing_currency: "EUR", billing_balance: 25, missing_credits: 0, default_address_position: "left", data_retention_addresses: 12, data_retention_pdf: 12, ...(opts.org || {}) };
  const pages = { "https://massageclub.io/privacy": '<!doctype html><html><body><section id="negocios"><h2>Negocios</h2></section></body></html>', ...(opts.pages || {}) };
  const json = (status, body, headers = {}) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-request-id": `req-${calls.length}`, ...headers } });
  async function fetch(url, init = {}) {
    const method = (init.method || "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    calls.push({ url, method, headers, body: init.body });
    if (url === `${SUPA}/auth/v1/user`) {
      const tok = String(headers.authorization || "").replace(/^Bearer /, "");
      return users[tok] ? json(200, users[tok]) : json(401, { msg: "bad jwt" });
    }
    const u = new URL(url);
    if (/(^|\.)massageclub\.io$/.test(u.hostname)) return pages[url] != null ? new Response(pages[url], { status: 200, headers: { "content-type": "text/html" } }) : new Response("not found", { status: 404 });
    if (u.hostname === "upload.pingen.test") { pingen.uploads.set(url, init.body); return new Response(null, { status: 200 }); }
    if (!/(^|\.)pingen\.com$/.test(u.hostname)) return json(404, { error: "unexpected host " + u.hostname });
    if (u.pathname === "/auth/access-tokens") { pingen.tokenCount++; return json(200, { token_type: "Bearer", expires_in: 43200, access_token: `ptok${pingen.tokenCount}` }); }
    if (!String(headers.authorization || "").startsWith("Bearer ptok")) return json(401, { errors: [{ title: "unauthenticated" }] });
    if (u.pathname === "/file-upload") return json(200, { data: { id: uuid(), type: "file_uploads", attributes: { url: `https://upload.pingen.test/f/${uuid()}`, url_signature: "sig-" + calls.length, expires_at: "2026-11-17T12:00:00+0100" } } });
    const m = u.pathname.match(/^\/organisations\/([^/]+)(\/.*)?$/);
    if (!m) return json(404, {});
    const rest = m[2] || "";
    if (rest === "" && method === "GET") return json(200, { data: { id: ORG, attributes: org } });
    if (rest === "/webhooks" && method === "GET") return json(200, { data: pingen.webhooks });
    if (rest === "/webhooks" && method === "POST") { const b = JSON.parse(init.body); const w = { id: uuid(), attributes: { event_category: b.data.attributes.event_category, url: b.data.attributes.url } }; pingen.webhooks.push(w); return json(201, { data: w }); }
    if (rest === "/deliveries/letters/price-calculator") return json(200, { data: { attributes: { price: 0.97, currency: "EUR" } } });
    if (rest === "/deliveries/letters" && method === "POST") {
      const b = JSON.parse(init.body).data.attributes;
      const bytes = pingen.uploads.get(b.file_url);
      // The stand-in renderer's bytes carry their inputs; real PDFs (the
      // screenshot harness) are read through pingen.addressOf when given.
      let inp = { addressLines: [] };
      try { inp = bytes ? stubPayload(bytes) : inp; } catch { inp = { addressLines: pingen.addressOf ? await pingen.addressOf(bytes) : [] }; }
      const id = uuid();
      pingen.letters.set(id, { status: "validating", polls: 0, address: (pingen.addressOverride ?? inp.addressLines).join("\n") + "\nSpain", name: b.file_original_name, auto_send: b.auto_send });
      return json(201, { data: { id, type: "letters", attributes: { status: "validating" } } });
    }
    const lm = rest.match(/^\/deliveries\/letters\/([^/]+)(\/[a-z-]+)?$/);
    if (lm) {
      const L = pingen.letters.get(lm[1]);
      if (!L) return json(404, { errors: [{ title: "not found" }] });
      const sub = lm[2] || "";
      if (sub === "" && method === "GET") {
        if (L.status === "validating" && ++L.polls >= 2) L.status = pingen.validStatus;
        return json(200, { data: { id: lm[1], type: "letters", attributes: { status: L.status, file_pages: 1, address: L.address, address_position: "left", country: "ES", paper_types: ["normal"], fonts: [{ name: "MC-Outfit-Regular", is_embedded: true }], price_value: 0.97, price_currency: "EUR" }, meta: { abilities: { self: { cancel: ["submitted", "accepted", "awaiting_credits"].includes(L.status) ? "ok" : "state" } } } } });
      }
      if (sub === "" && method === "DELETE") { pingen.letters.delete(lm[1]); return new Response(null, { status: 204 }); }
      if (sub === "/events") return json(200, { data: [{ attributes: { name: "Address invalid", reason: "postcode" } }] });
      if (sub === "/send" && method === "PATCH") {
        if (pingen.failSendOnce) { pingen.failSendOnce = false; return json(500, { errors: [{ title: "boom" }] }); }
        if (L.status !== "valid") return json(422, { errors: [{ title: "not valid" }] });
        L.status = "submitted";
        return json(200, { data: { id: lm[1], attributes: { status: "submitted" } } });
      }
      if (sub === "/cancel" && method === "PATCH") { L.status = "cancelling"; return json(202, null); }
    }
    return json(404, { errors: [{ title: "no route " + method + " " + u.pathname }] });
  }
  return { fetch, calls, pingen, org, pages };
}

export async function makeApi(o = {}) {
  const { createHandler } = await import("../../supabase/functions/letters/api.ts");
  const { db, store, setClock } = memStore();
  const net = mockNet(o);
  const env = { SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: "service-role-test", LETTERS_PASSCODE: PASS, MC_SIGN_KEY: SIGN_KEY, LETTERS_WEBHOOK_SECRET: WH_SECRET, LETTERS_ADMIN_USER_IDS: ADMIN_ID, ...(o.env || {}) };
  let clock = o.now ? new Date(o.now) : new Date("2026-11-17T10:00:00Z");
  setClock(() => clock);
  const handler = createHandler({
    env: (k) => env[k],
    store,
    fetch: net.fetch,
    now: () => clock,
    sleep: async () => {},
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    render: o.render || stubRender,
    fontHashes: { "Outfit-Regular.ttf": "x" },
    authCache: new Map(),
    tokenCache: new Map(),
    pollMs: 1, pollMaxMs: 1000,
  });
  async function call(op, body = {}, token = ADMIN_TOKEN, headers = {}) {
    const req = new Request("https://proj.supabase.test/functions/v1/letters", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://book.massageclub.io", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: JSON.stringify({ op, ...body }),
    });
    const res = await handler(req);
    return { status: res.status, body: await res.json(), headers: res.headers };
  }
  return { handler, call, db, store, net, env, setNow: (d) => { clock = new Date(d); } };
}
