// Letters (17 Nov 2026): the JSON API behind book.massageclub.io/letters.html
// and the Pingen webhook receiver. Everything it needs comes in through Ctx
// (env, storage, fetch, clock, renderer), so the Node tests run the real
// handler against an in-memory store and a mocked fetch.
//
// Nothing reaches a studio unless Jordan has looked at the exact PDF bytes,
// approved them, and then pressed "Post" with the passcode while LETTERS_MODE
// is live. Approving, rendering, uploading (auto_send false) and dry runs
// never post. Every status change goes through move(), which only allows the
// transitions in rules.ts and writes an audit event.

import {
  canTransition, eligibility, validateTemplate, validateSettingsPatch, settingsMissing, printedSettings, spanishTemplate,
  canonicalJson, refCodes, costEstimate, toCents, fmtEur, madridDayStart, parseListCsv, greetingProblems, mergeText, tagValues,
  cleanTemplate, markStale, TAGS, EDITABLE, IN_PINGEN, DASH_RE, squash, nfc, UUID_RE, PRIVACY_URL_RE,
} from "./rules.ts";
import type { Settings, Recipient, Partner, Problem, Reason, LetterLite } from "./rules.ts";
import { defaultTemplate, FEE_SENTENCES, DRAFT_FEE_SENTENCE, CURRENT_FEE_VERSION, MISSING, useApprovedFeeWording } from "./templates.ts";
import type { Template } from "./templates.ts";
import { sha256Hex, socLinkFor, SLUG_RE, PROOF_QR_URL, bytesToBase64 } from "./sign.ts";
import {
  createPingenClient, normalizeMode, pingenEnvFor, postUploadChecks, mapPingenStatus, idemKey, PingenError, PINGEN_POSTED, WEBHOOK_CATEGORIES,
} from "./pingen.ts";
import type { Fetch, TokenCache, PingenClient, LetterAttrs, Mode } from "./pingen.ts";
import { verifySignature, parseWebhook, planWebhook } from "./webhook.ts";
import { corsHeaders, bearerToken, clientIp, ipHash, verifyUser, parseAdminIds, passcodeOk, PASSCODE_MIN } from "./auth.ts";
import type { AuthCache } from "./auth.ts";
import { RENDERER_VERSION } from "./render.ts";
import type { RenderInput, RenderResult } from "./render.ts";
import type { Store, Letter, Campaign, Optout } from "./types.ts";

export type Ctx = {
  env: (k: string) => string | undefined;
  store: Store;
  fetch: Fetch;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  randomBytes: (n: number) => Uint8Array;
  render: (inp: RenderInput) => Promise<RenderResult>;
  fontHashes: Record<string, string>;
  authCache?: AuthCache;
  tokenCache?: TokenCache;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
  pollMs?: number;
  pollMaxMs?: number;
};

const HTTP: Record<string, number> = {
  bad_request: 400, auth_required: 401, not_allowed: 403, not_found: 404, method_not_allowed: 405,
  wrong_state: 409, stale: 409, test_mode: 409, numbers_changed: 409, over_cap: 409, env_mismatch: 409,
  settings_incomplete: 412, pingen_not_configured: 412, passcode_not_set: 412, optout_route_not_confirmed: 412, sign_key_missing: 412, webhook_secret_missing: 412,
  optout_route_not_tested: 412, proof_not_confirmed: 412, privacy_not_checked: 412, retention_not_checked: 412, insufficient_credits: 412,
  validation_failed: 422, wrong_passcode: 422, locked: 423, rate_limited: 429, pingen_error: 502, not_configured: 503, admins_not_set: 503,
};
export class ApiError extends Error {
  code: string;
  status: number;
  extra: Record<string, unknown>;
  constructor(code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = HTTP[code] ?? 400;
    this.extra = extra;
  }
}

// Review fix (17 Nov, UX M1): staging first, then live.
export const TEST_MODE_MSG = "Test mode: nothing is posted. Rehearse in Pingen's test system first (set LETTERS_MODE to staging in Supabase, Edge Functions, Secrets), then set it to live to post for real.";
export const PROOF_MSG = "Waiting for your proof letter: post it alone first, and once it has arrived, looks right and its QR opens, confirm it in Step 2. Then the studio letters can be posted.";
const DAY = 86400e3;
const uniq = <T>(a: T[]): T[] => [...new Set(a)];
const strIds = (v: unknown, max = 500): string[] => {
  if (!Array.isArray(v)) return [];
  const out = uniq(v.map((x) => String(x ?? "").trim().toLowerCase()).filter((x) => UUID_RE.test(x)));
  if (out.length > max) throw new ApiError("bad_request", `At most ${max} at a time.`);
  return out;
};
const reqId = (v: unknown, what: string): string => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!UUID_RE.test(s)) throw new ApiError("bad_request", `${what} is missing or not an id.`);
  return s;
};
const SAVE_BLOCKING = ["unknown_tag", "stray_braces", "dash", "too_long", "missing", "control_chars", "link_host"];

export function createHandler(ctx: Ctx): (req: Request) => Promise<Response> {
  const S = ctx.store;
  const E = (k: string): string => String(ctx.env(k) ?? "").trim();
  const nowIso = () => ctx.now().toISOString();
  const log = ctx.log ?? (() => {});
  const mode = (): Mode => normalizeMode(E("LETTERS_MODE"));
  const keys = () => ({ id: E("PINGEN_CLIENT_ID"), secret: E("PINGEN_CLIENT_SECRET"), org: E("PINGEN_ORGANISATION_ID") });
  const pingenConfigured = () => { const k = keys(); return !!(k.id && k.secret && k.org); };
  const webhookUrl = () => `${E("SUPABASE_URL")}/functions/v1/letters?pingen_webhook=1`;

  function client(): PingenClient {
    if (mode() === "test") throw new ApiError("test_mode", TEST_MODE_MSG);
    if (!pingenConfigured()) throw new ApiError("pingen_not_configured", "PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET and PINGEN_ORGANISATION_ID must be set in Supabase, Edge Functions, Secrets.");
    const k = keys();
    return createPingenClient({ mode: mode(), clientId: k.id, clientSecret: k.secret, orgId: k.org, fetch: ctx.fetch, sleep: ctx.sleep, now: () => ctx.now().getTime(), tokenCache: ctx.tokenCache });
  }

  // ------------------------------------------------------------------------
  // Audit and transitions
  // ------------------------------------------------------------------------
  async function audit(e: { actor: string; event: string; campaign_id?: string | null; letter_id?: string | null; from?: string | null; to?: string | null; detail?: Record<string, unknown>; pingen_event_id?: string | null }): Promise<boolean> {
    return await S.insertEvent({ campaign_id: e.campaign_id ?? null, letter_id: e.letter_id ?? null, actor: e.actor, event: e.event, from_status: e.from ?? null, to_status: e.to ?? null, detail: e.detail ?? null, pingen_event_id: e.pingen_event_id ?? null });
  }
  async function move(l: Letter, to: string, patch: Partial<Letter>, actor: string, event: string, detail: Record<string, unknown> = {}): Promise<Letter> {
    if (!canTransition(l.status, to)) throw new ApiError("wrong_state", `A letter that is ${l.status} cannot become ${to}.`, { letter_id: l.id, status: l.status });
    const u = await S.updateLetter(l.id, { ...patch, status: to }, l.status);
    if (!u) throw new ApiError("wrong_state", "This letter changed meanwhile. Reload and try again.", { letter_id: l.id });
    await audit({ actor, event, campaign_id: l.campaign_id, letter_id: l.id, from: l.status, to, detail });
    return u;
  }

  // ------------------------------------------------------------------------
  // Context for eligibility and rendering
  // ------------------------------------------------------------------------
  type LCtx = { recip: Map<string, Recipient>; partner: Map<string, Partner>; byPartner: Map<string, LetterLite[]>; campaignStatus: Record<string, string>; settings: Settings; optouts: Map<string, Optout[]> };
  async function loadCtx(recipientIds: string[], settings?: Settings): Promise<LCtx> {
    const recips = recipientIds.length ? await S.getRecipients(uniq(recipientIds)) : [];
    const pids = uniq(recips.map((r) => r.partner_id).filter((x): x is string => !!x));
    const partners = pids.length ? await S.getPartners(pids) : [];
    const letters = pids.length ? await S.listLetters({ partner_ids: pids }) : [];
    const optouts = new Map<string, Optout[]>();
    for (const o of pids.length ? await S.activeOptoutsFor(pids) : []) {
      if (!o.partner_id) continue;
      if (!optouts.has(o.partner_id)) optouts.set(o.partner_id, []);
      optouts.get(o.partner_id)!.push(o);
    }
    const campaigns = await S.listCampaigns();
    const stagingCampaigns = new Set(campaigns.filter((c) => c.pingen_env === "staging").map((c) => c.id));
    const byPartner = new Map<string, LetterLite[]>();
    for (const l of letters) {
      if (!l.partner_id) continue;
      // Letters that went to Pingen's staging system were never printed: they
      // do not count as "written to" (a staging rehearsal is then copied with
      // campaign_duplicate and run live).
      if (l.pingen_env === "staging" || stagingCampaigns.has(l.campaign_id)) continue;
      if (!byPartner.has(l.partner_id)) byPartner.set(l.partner_id, []);
      byPartner.get(l.partner_id)!.push({ id: l.id, campaign_id: l.campaign_id, status: l.status, submitted_at: l.submitted_at, partner_id: l.partner_id });
    }
    const campaignStatus: Record<string, string> = {};
    for (const c of campaigns) campaignStatus[c.id] = c.status;
    return {
      recip: new Map(recips.map((r) => [r.id, r])), partner: new Map(partners.map((p) => [p.id, p])), byPartner, campaignStatus,
      settings: settings ?? await S.getSettings(), optouts,
    };
  }
  function elig(c: LCtx, recipientId: string, letter?: Letter) {
    const r = c.recip.get(recipientId) ?? null;
    const p = r?.partner_id ? c.partner.get(r.partner_id) ?? null : null;
    return eligibility({
      recipient: r, partner: p, letters: r?.partner_id ? c.byPartner.get(r.partner_id) ?? [] : [], campaignStatus: c.campaignStatus,
      cooldownDays: c.settings.cooldown_days, now: ctx.now(), selfLetterId: letter?.id, greeting: letter?.greeting_name ?? undefined,
      optouts: r?.partner_id ? c.optouts.get(r.partner_id) ?? [] : [],
    });
  }

  async function renderInputs(l: Letter, camp: Campaign, settings: Settings, r: Recipient, p: Partner | null) {
    let qrUrl: string | null = null, qrProblem: string | null = null, linkV: number | null = null;
    if (r.kind === "proof") qrUrl = PROOF_QR_URL;
    else if (p) {
      const slug = String(p.slug ?? "");
      const slugCount = SLUG_RE.test(slug) ? await S.countPartnersWithSlug(slug) : 0;
      const link = await socLinkFor(E("MC_SIGN_KEY"), p, slugCount);
      if (link.ok) { qrUrl = link.url; linkV = link.link_v; } else { qrProblem = link.message; linkV = Number(p.slots_link_v || 1); }
    } else qrProblem = "The studio is no longer in our records.";
    const greeting = squash(nfc(l.greeting_name ?? r.greeting_name));
    // English-only edits do not change a letter: only what is printed is hashed.
    const inputs = {
      renderer: RENDERER_VERSION, template: spanishTemplate(camp.template), settings: printedSettings(settings), greeting,
      address_lines: r.address_lines, qr_url: qrUrl, qr_problem: qrProblem, link_v: linkV, print_spectrum: settings.print_spectrum,
      ref_code: l.ref_code, fonts: ctx.fontHashes, created_at: camp.created_at,
    };
    return { inputs, sha: await sha256Hex(canonicalJson(inputs)), qrUrl, qrProblem, linkV, greeting };
  }

  // Renders the letter if its inputs changed. A change clears the preview and
  // the approval (the approval is of the old bytes) unless the bytes come out
  // identical.
  async function ensureRendered(l: Letter, camp: Campaign, c: LCtx, actor: string): Promise<Letter> {
    if (!["draft", "review", "approved"].includes(l.status)) return l;
    const r = c.recip.get(l.recipient_id);
    if (!r) throw new ApiError("not_found", "This letter's mailing-list row is gone.");
    const p = r.partner_id ? c.partner.get(r.partner_id) ?? null : null;
    const ri = await renderInputs(l, camp, c.settings, r, p);
    if (l.render_inputs_sha256 === ri.sha && (l.pdf_sha256 || (l.layout && (l.layout as Record<string, unknown>).error))) return l;
    const res: RenderResult = !r.address_lines?.length
      ? { ok: false, error: { code: "address_purged", message: "This studio's address was deleted (12 months passed, or it opted out). Import it again to write to it." } } as RenderResult
      : await ctx.render({
      greeting: ri.greeting, addressLines: r.address_lines, qrUrl: ri.qrUrl, qrProblem: ri.qrProblem ?? undefined, refCode: l.ref_code,
      template: spanishTemplate(camp.template), settings: c.settings, spectrum: c.settings.print_spectrum, createdAt: camp.created_at,
    });
    const base: Partial<Letter> = { render_inputs_sha256: ri.sha, renderer_version: RENDERER_VERSION, address_lines: r.address_lines, qr_url: ri.qrUrl, link_v: ri.linkV, rendered_at: nowIso() };
    if (res.ok) {
      const sha = await sha256Hex(res.bytes);
      if (sha === l.pdf_sha256 && l.pdf_path) {
        const u = await S.updateLetter(l.id, { ...base, layout: res.layout as unknown as Record<string, unknown> }, l.status);
        return u ?? l;
      }
      const path = `letters/${l.id}/${sha}.pdf`;
      await S.putPdf(path, res.bytes);
      return await move(l, "review", {
        ...base, pdf_path: path, pdf_sha256: sha, pdf_bytes: res.bytes.length, layout: res.layout as unknown as Record<string, unknown>, status_reason: null,
        previewed_sha256: null, previewed_at: null, previewed_by: null, approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false,
      }, actor, "rendered", { sha256: sha, bytes: res.bytes.length, sizes: res.layout.sizes, placeholders: res.layout.placeholders, approval_cleared: l.status === "approved" });
    }
    return await move(l, "review", {
      ...base, pdf_path: null, pdf_sha256: null, pdf_bytes: null, layout: { error: res.error }, status_reason: res.error.message,
      previewed_sha256: null, previewed_at: null, previewed_by: null, approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false,
    }, actor, "render_failed", { code: res.error.code, message: res.error.message });
  }

  // ------------------------------------------------------------------------
  // Readiness
  // ------------------------------------------------------------------------
  async function readiness(settings: Settings) {
    const k = keys();
    const wh = E("LETTERS_WEBHOOK_SECRET");
    const pc = E("LETTERS_PASSCODE");
    const listCount = (await S.listRecipients({ activeOnly: true })).length;
    const m = mode();
    const missing = settingsMissing(settings);
    const testBaja = await S.latestTestOptout(new Date(ctx.now().getTime() - 30 * DAY).toISOString());
    const privacyOk = privacyChecked(settings);
    const ret = retentionState(settings);
    const blocking: string[] = [];
    if (m === "test") blocking.push(TEST_MODE_MSG);
    blocking.push(...missing);
    if (m !== "test" && !pingenConfigured()) blocking.push("Pingen keys are missing (PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET, PINGEN_ORGANISATION_ID).");
    if (pc.length < PASSCODE_MIN) blocking.push(`LETTERS_PASSCODE is not set (at least ${PASSCODE_MIN} characters).`);
    if (!E("MC_SIGN_KEY")) blocking.push("MC_SIGN_KEY is not set, so studios' QR links cannot be signed.");
    if (m === "live" && !settings.optout_route_confirmed_at) blocking.push("BAJA routing is not confirmed: send a test BAJA by WhatsApp, then confirm it in Settings.");
    if (m === "live" && settings.privacy_url && !privacyOk) blocking.push("The privacy page has not passed its check: press Check the privacy page in Settings.");
    if (m === "live" && !ret.ok) blocking.push(ret.message);
    if (!listCount) blocking.push("No mailing list imported yet.");
    const warnings: string[] = [];
    if (!wh) warnings.push("LETTERS_WEBHOOK_SECRET is not set: Pingen cannot tell us when letters are sent or come back.");
    else if (wh.length < 20 || wh.length > 32) warnings.push("LETTERS_WEBHOOK_SECRET must be 20 to 32 characters.");
    if (m === "staging" && settings.privacy_url && !privacyOk) warnings.push("The privacy page has not passed its check yet (needed before live).");
    return {
      mode: m,
      legal_sender: !!(settings.sender_type && squash(settings.legal_sender_name) && (settings.sender_type !== "company" || squash(settings.legal_sender_nif))),
      return_address: !!(squash(settings.return_street) && squash(settings.return_postcode) && squash(settings.return_city)),
      privacy_url: !!settings.privacy_url && privacyOk,
      privacy_url_set: !!settings.privacy_url,
      privacy_check: { ok: privacyOk, checked_at: settings.privacy_checked_at ?? null, note: settings.privacy_check_note ?? null },
      pingen_client_id: !!k.id, pingen_client_secret: !!k.secret, pingen_organisation_id: !!k.org,
      webhook_secret: !!wh, webhook_secret_length_ok: wh.length >= 20 && wh.length <= 32,
      passcode_set: pc.length >= PASSCODE_MIN,
      sign_key_set: !!E("MC_SIGN_KEY"),
      admin_ids_set: parseAdminIds(ctx.env("LETTERS_ADMIN_USER_IDS")).ok,
      optout_route_confirmed: !!settings.optout_route_confirmed_at,
      optout_test_seen_at: testBaja?.created_at ?? null,
      retention: ret,
      list_count: listCount,
      blocking_reasons: blocking,
      warnings,
    };
  }
  const privacyChecked = (s: Settings): boolean => !!s.privacy_url && s.privacy_check_ok === true && s.privacy_checked_url === s.privacy_url;
  // Review fix (17 Nov, security M3): the letter promises at most 12 months,
  // so Pingen must not keep addresses or PDFs longer (its own settings, read
  // by "Check the Pingen account").
  function retentionState(s: Settings): { ok: boolean; checked: boolean; addresses: number | null; pdf: number | null; message: string } {
    const a = s.pingen_retention_addresses ?? null, p = s.pingen_retention_pdf ?? null;
    const checked = !!s.pingen_retention_checked_at && s.pingen_retention_env === "production";
    if (!checked) return { ok: false, checked, addresses: a, pdf: p, message: "Pingen's data retention is not checked yet: in live mode press Check the Pingen account in Settings (it must be 12 months or less for addresses and PDFs, as the letter promises)." };
    const over = [a == null || a > 12 ? `addresses ${a ?? "?"} months` : "", p == null || p > 12 ? `PDFs ${p ?? "?"} months` : ""].filter(Boolean);
    if (over.length) return { ok: false, checked, addresses: a, pdf: p, message: `Pingen keeps ${over.join(" and ")}: set both to 12 months or less in Pingen (organisation settings, data retention), then check the Pingen account again. The letter promises at most 12 months.` };
    return { ok: true, checked, addresses: a, pdf: p, message: `Pingen keeps addresses ${a} months and PDFs ${p} months.` };
  }

  async function requirePasscode(given: unknown, actor: string, campaignId?: string) {
    const secret = E("LETTERS_PASSCODE");
    if (secret.length < PASSCODE_MIN) throw new ApiError("passcode_not_set", `LETTERS_PASSCODE is not set (at least ${PASSCODE_MIN} characters) in Supabase, Edge Functions, Secrets.`);
    if ((await S.ratePeek(actor, "passfail", 900)) >= 5 || (await S.ratePeek("all", "passfail_day", 86400)) >= 20) {
      throw new ApiError("locked", "Too many wrong passcodes. Posting is locked for 15 minutes (after 20 in a day, until tomorrow).");
    }
    if (!(await passcodeOk(given, secret))) {
      await S.rateHit(actor, "passfail", 900, 5);
      await S.rateHit("all", "passfail_day", 86400, 20);
      await audit({ actor, event: "passcode_fail", campaign_id: campaignId ?? null });
      throw new ApiError("wrong_passcode", "Wrong passcode.");
    }
  }

  const unitPrice = (l: Letter | null, s: Settings): number =>
    Number(l?.pingen_price ?? s.pingen_price ?? (s.print_spectrum === "color" ? Math.max(1.06, s.price_estimate_eur) : s.price_estimate_eur));

  const layoutSummary = (l: Letter) => {
    const lay = (l.layout || {}) as Record<string, unknown>;
    return { sizes: lay.sizes ?? null, placeholders: lay.placeholders ?? 0, placeholder_texts: lay.placeholder_texts ?? [], error: lay.error ?? null, body_space_left_mm: lay.body_space_left_mm ?? null };
  };
  // Review fix (17 Nov, security L13): the printed QR link is a bearer link,
  // so lists never carry it; only letter_preview returns it, for one letter.
  const letterOut = (l: Letter) => {
    const { layout: _layout, qr_url: _qr, ...rest } = l;
    return { ...rest, layout: layoutSummary(l) };
  };

  async function getCampaign(id: unknown): Promise<Campaign> {
    const c = await S.getCampaign(reqId(id, "campaign_id"));
    if (!c) throw new ApiError("not_found", "No such campaign.");
    return c;
  }
  async function getLetter(id: unknown): Promise<Letter> {
    const l = await S.getLetter(reqId(id, "letter_id"));
    if (!l) throw new ApiError("not_found", "No such letter.");
    return l;
  }

  function templateForSave(input: unknown, base: Template): { template: Template; check: ReturnType<typeof validateTemplate> } {
    if (!input || typeof input !== "object") throw new ApiError("bad_request", "template must be an object.");
    const t = cleanTemplate(input as Record<string, unknown>, base);
    const check = validateTemplate(t);
    const hard = check.errors.filter((e) => SAVE_BLOCKING.includes(e.code));
    if (hard.length) throw new ApiError("validation_failed", "The template cannot be saved: " + hard.map((e) => `${e.field}: ${e.message}`).join(" "), { errors: hard });
    return { template: t, check };
  }

  async function newLetters(camp: Campaign, recipientIds: string[], actor: string) {
    const c = await loadCtx(recipientIds);
    const existing = await S.listLetters({ campaign_id: camp.id });
    const have = new Set(existing.map((l) => l.recipient_id));
    const ok: Recipient[] = [];
    const skipped: { recipient_id: string; reasons: Reason[] }[] = [];
    for (const id of recipientIds) {
      const r = c.recip.get(id);
      if (have.has(id)) { skipped.push({ recipient_id: id, reasons: [{ code: "already_in_campaign", text: "Already in this campaign." }] }); continue; }
      const e = elig(c, id);
      if (!r || !e.eligible) { skipped.push({ recipient_id: id, reasons: e.reasons }); continue; }
      ok.push(r);
    }
    if (!ok.length) return { created: [] as Letter[], skipped };
    let codes = refCodes(ok.length, new Set(), ctx.randomBytes);
    for (let tries = 0; ; tries++) {
      const clash = await S.refCodesTaken(codes);
      if (!clash.length) break;
      if (tries >= 5) throw new ApiError("wrong_state", "Could not make unique reference codes. Try again.");
      const keep = codes.filter((x) => !clash.includes(x));
      codes = [...keep, ...refCodes(clash.length, new Set([...keep, ...clash]), ctx.randomBytes)];
    }
    const rows = ok.map((r, i) => ({ campaign_id: camp.id, recipient_id: r.id, partner_id: r.partner_id, ref_code: codes[i], status: "draft", greeting_name: null }));
    const created = await S.insertLetters(rows as Partial<Letter>[]);
    for (const l of created) await audit({ actor, event: "created", campaign_id: camp.id, letter_id: l.id, to: "draft" });
    return { created, skipped };
  }

  // ------------------------------------------------------------------------
  // Pingen results onto our letter (queue poll, refresh)
  // ------------------------------------------------------------------------
  async function reconcile(l: Letter, attrs: LetterAttrs, cl: PingenClient, actor: string): Promise<Letter> {
    const s = await S.getSettings();
    const fields: Partial<Letter> = {
      pingen_status: attrs.status ?? null, pingen_address: attrs.address ?? null, pingen_pages: attrs.file_pages ?? null,
      pingen_fonts: attrs.fonts ?? null, pingen_price: attrs.price_value ?? null, pingen_currency: attrs.price_currency ?? null,
    };
    const mapped = attrs.status ? mapPingenStatus(attrs.status) : null;
    const step = async (cur: Letter, to: string, patch: Partial<Letter>, event: string, detail: Record<string, unknown> = {}) => await move(cur, to, { ...fields, ...patch }, actor, event, { pingen_status: attrs.status, ...detail });
    let cur = l;
    if (cur.status === "error") {
      if (mapped === "ready" || mapped === "blocked" || mapped === "checking") cur = await step(cur, "checking", { last_error: null }, "reconciled");
      else if (mapped && ["submitted", "sent", "delivered", "undeliverable", "unprintable", "cancelled"].includes(mapped)) cur = await step(cur, "submitted", { last_error: null, submitted_at: cur.submitted_at ?? nowIso() }, "reconciled");
      else { await S.updateLetter(cur.id, fields); return cur; }
    }
    if (cur.status === "checking") {
      if (mapped === "ready") {
        const chk = postUploadChecks(attrs, { addressLines: cur.address_lines || [], maxPrice: Number(s.max_price_per_letter) });
        return chk.ok ? await step(cur, "ready", { status_reason: null }, "pingen_checked") : await step(cur, "blocked", { status_reason: chk.problems.join(" ") }, "pingen_checked", { problems: chk.problems });
      }
      if (mapped === "blocked") {
        const why = await cl.getLetterEvents(cur.pingen_letter_id!).catch(() => [] as string[]);
        return await step(cur, "blocked", { status_reason: `Pingen: ${attrs.status}${why.length ? `. ${why.join("; ")}` : ""}` }, "pingen_checked", { events: why });
      }
      if (mapped && ["submitted", "sent", "delivered", "undeliverable"].includes(mapped)) {
        await S.updateLetter(cur.id, { ...fields, last_error: "Pingen says this letter was posted, but it was not posted from this tool (someone used the Pingen web app)." });
        await audit({ actor, event: "sent_outside_tool", campaign_id: cur.campaign_id, letter_id: cur.id, detail: { pingen_status: attrs.status } });
        return (await S.getLetter(cur.id)) ?? cur;
      }
      if (mapped === "cancelled" || mapped === "unprintable") return await step(cur, "blocked", { status_reason: `Pingen: ${attrs.status}` }, "pingen_checked");
      await S.updateLetter(cur.id, fields);
      return (await S.getLetter(cur.id)) ?? cur;
    }
    if (cur.status === "submitted") {
      if (mapped === "sent") return await step(cur, "sent", { sent_at: cur.sent_at ?? nowIso() }, "pingen_status");
      if (mapped === "delivered" || mapped === "undeliverable") {
        cur = await step(cur, "sent", { sent_at: cur.sent_at ?? nowIso() }, "pingen_status");
      } else if (mapped === "unprintable") return await step(cur, "unprintable", { status_reason: `Pingen: ${attrs.status}` }, "pingen_status");
      else if (mapped === "cancelled") return await step(cur, "cancelled", { cancelled_at: nowIso() }, "pingen_status");
      else {
        if (attrs.status !== cur.pingen_status) {
          await S.updateLetter(cur.id, fields);
          await audit({ actor, event: "pingen_status", campaign_id: cur.campaign_id, letter_id: cur.id, detail: { pingen_status: attrs.status } });
        }
        return (await S.getLetter(cur.id)) ?? cur;
      }
    }
    if (cur.status === "sent") {
      if (mapped === "delivered") return await step(cur, "delivered", { delivered_at: nowIso() }, "pingen_status");
      if (mapped === "undeliverable") {
        const u = await step(cur, "undeliverable", { undeliverable_at: nowIso() }, "pingen_status");
        await S.updateRecipient(cur.recipient_id, { needs_review: `undeliverable on ${nowIso().slice(0, 10)}` });
        await revokeLink(u, actor);
        return u;
      }
    }
    return cur;
  }

  // Review fix (17 Nov, security M2): the QR on a letter that came back is the
  // studio's signed sign-up link on paper that may now be anywhere, so the
  // link is revoked (slots_link_v + 1, which also changes its times page
  // link). Jordan sends the studio a new one when he reaches it.
  async function revokeLink(l: Letter, actor: string) {
    if (!l.partner_id) return;
    const v = await S.bumpPartnerLink(l.partner_id).catch(() => null);
    await audit({ actor, event: "link_revoked", campaign_id: l.campaign_id, letter_id: l.id, detail: { partner_id: l.partner_id, slots_link_v: v, why: "letter came back undeliverable" } });
  }

  async function pollUntilChecked(l: Letter, cl: PingenClient, actor: string): Promise<Letter> {
    const pollMs = ctx.pollMs ?? 2000, maxMs = ctx.pollMaxMs ?? 20000;
    const deadline = ctx.now().getTime() + maxMs;
    const maxPolls = Math.ceil(maxMs / pollMs) + 1;
    let cur = l;
    for (let n = 1; ; n++) {
      const g = await cl.getLetter(cur.pingen_letter_id!);
      if (mapPingenStatus(String(g.attrs.status)) !== "checking" || n >= maxPolls || ctx.now().getTime() + pollMs > deadline) {
        return await reconcile(cur, g.attrs, cl, actor);
      }
      await ctx.sleep(pollMs);
    }
  }

  // ------------------------------------------------------------------------
  // Send preflight (10.4): per-letter checks shared by dry run and send.
  // ------------------------------------------------------------------------
  async function letterChecks(l: Letter, camp: Campaign, c: LCtx, want: "approved" | "ready"): Promise<string | null> {
    if (l.campaign_id !== camp.id) return "Not in this campaign.";
    if (l.status !== want && !(want === "approved" && l.status === "ready")) return `Status is ${l.status}, not ${want}.`;
    if (!l.pdf_sha256 || l.pdf_sha256 !== l.approved_sha256) return "Not approved for the current PDF.";
    if (l.status === "ready" && l.uploaded_sha256 !== l.approved_sha256) return "What Pingen holds is not what was approved.";
    const r = c.recip.get(l.recipient_id);
    if (!r) return "The mailing-list row is gone.";
    const p = r.partner_id ? c.partner.get(r.partner_id) ?? null : null;
    const ri = await renderInputs(l, camp, c.settings, r, p);
    if (ri.sha !== l.render_inputs_sha256) return "Something printed on it changed since it was approved (settings, template, studio link or address). Look at it again.";
    if (!ri.qrUrl) return ri.qrProblem || "The QR link cannot be signed.";
    const e = elig(c, l.recipient_id, l);
    if (!e.eligible) return e.reasons.map((x) => x.text).join(" ");
    if (Number((l.layout as Record<string, unknown> | null)?.placeholders ?? 0) > 0) return "The letter still has red placeholders.";
    return null;
  }
  // Review fix (17 Nov, UX H2): in live, a studio letter waits until the
  // campaign's proof letter (Jordan's own address) has arrived and he said so.
  function proofGate(m: Mode, camp: Campaign, c: LCtx, l: Letter): string | null {
    if (m !== "live" || camp.proof_confirmed_at) return null;
    return c.recip.get(l.recipient_id)?.kind === "proof" ? null : PROOF_MSG;
  }

  async function globalChecks(m: Mode, settings: Settings): Promise<{ check: string; ok: boolean; message: string }[]> {
    const out: { check: string; ok: boolean; message: string }[] = [];
    out.push({ check: "mode", ok: m !== "test", message: m === "test" ? TEST_MODE_MSG : m === "staging" ? "Staging: Pingen's test system, nothing is printed." : "Live: letters are printed and posted." });
    out.push({ check: "passcode_set", ok: E("LETTERS_PASSCODE").length >= PASSCODE_MIN, message: "LETTERS_PASSCODE set." });
    out.push({ check: "pingen_keys", ok: pingenConfigured(), message: "Pingen keys set." });
    const miss = settingsMissing(settings);
    out.push({ check: "settings", ok: !miss.length, message: miss.length ? miss.join(" ") : "Legal sender, return address and privacy page set." });
    out.push({ check: "optout_route", ok: m !== "live" || !!settings.optout_route_confirmed_at, message: settings.optout_route_confirmed_at ? "BAJA routing confirmed." : "BAJA routing not confirmed (needed for live)." });
    out.push({ check: "sign_key", ok: !!E("MC_SIGN_KEY"), message: "MC_SIGN_KEY set." });
    if (m === "live") {
      out.push({ check: "privacy_page", ok: privacyChecked(settings), message: privacyChecked(settings) ? "Privacy page checked." : "The privacy page has not passed its check (Settings)." });
      const ret = retentionState(settings);
      out.push({ check: "pingen_retention", ok: ret.ok, message: ret.message });
    }
    return out;
  }

  // ------------------------------------------------------------------------
  // Operations
  // ------------------------------------------------------------------------
  type Op = (b: Record<string, unknown>, actor: string, userId?: string) => Promise<Record<string, unknown>>;
  // Plain labels for settings fields in messages (review L5).
  const SETTING_LABEL: Record<string, string> = {
    sender_type: "Sender type", legal_sender_name: "Legal sender name", legal_sender_nif: "NIF", return_name: "Name on the address",
    return_street: "Street", return_postcode: "Postcode", return_city: "City", contact_email: "Contact email", contact_whatsapp: "WhatsApp",
    privacy_url: "Privacy page", print_spectrum: "Print", delivery_product: "Delivery", price_estimate_eur: "Price estimate",
    max_price_per_letter: "Highest Pingen price", vat_rate: "IVA rate", max_per_send: "Most letters in one post", daily_cap: "Most letters in one day",
    cooldown_days: "Days between letters to a studio",
  };
  const OPS: Record<string, Op> = {
    // Review fix (17 Nov, test report a): the page gets the prices and limits
    // the server uses, instead of hardcoding 0.97, 21% and 20.
    async whoami(_b, actor, uid) {
      const currentUserId = uid ?? null;
      const st = await S.getSettings();
      const today = await S.countSubmittedSince(madridDayStart(ctx.now()).toISOString());
      return {
        email: actor, user_id: currentUserId, mode: mode(), readiness: await readiness(st),
        prices: { estimate_eur: unitPrice(null, st), grayscale_eur: Math.max(0.97, Number(st.price_estimate_eur)), color_eur: Math.max(1.06, Number(st.price_estimate_eur)), vat_rate: Number(st.vat_rate), pingen_price: st.pingen_price ?? null, print_spectrum: st.print_spectrum },
        limits: { max_per_send: Math.min(st.max_per_send, 20), daily_cap: st.daily_cap, posted_today: today, daily_left: Math.max(0, st.daily_cap - today) },
      };
    },

    // Review fix (17 Nov, test report): the editor's live check. The same
    // validateTemplate that approval runs, so the page shows what counts.
    async template_validate(b) {
      if (!b.template || typeof b.template !== "object" || Array.isArray(b.template)) throw new ApiError("bad_request", "template must be an object.");
      const t = cleanTemplate(b.template as Record<string, unknown>, defaultTemplate());
      return { check: validateTemplate(t) };
    },

    async template_defaults() {
      return { template: defaultTemplate(), approved_template: useApprovedFeeWording(defaultTemplate()), fee_sentences: FEE_SENTENCES, current_fee_version: CURRENT_FEE_VERSION, draft_fee_sentence: DRAFT_FEE_SENTENCE, missing_placeholders: MISSING };
    },

    async settings_get() {
      const s = await S.getSettings();
      return { settings: s, readiness: await readiness(s) };
    },

    async settings_update(b, actor) {
      const v = validateSettingsPatch((b.settings || {}) as Record<string, unknown>);
      if (!v.ok) throw new ApiError("validation_failed", v.errors.map((e) => `${SETTING_LABEL[e.field || ""] || e.field}: ${e.message}`).join(" "), { errors: v.errors });
      const before = await S.getSettings();
      const printedChanged = canonicalJson(printedSettings(before)) !== canonicalJson(printedSettings({ ...before, ...v.clean } as Settings));
      // Review fix (17 Nov, UX M8): the page asks first. A dry run says
      // whether anything printed changes and how many approvals that clears.
      if (b.dry_run === true) {
        const changed = Object.keys(v.clean).filter((k) => (before as Record<string, unknown>)[k] !== (v.clean as Record<string, unknown>)[k]);
        const wouldClear = printedChanged ? (await S.listLetters({ statuses: ["approved"] })).length : 0;
        const toRedo = printedChanged ? (await S.listLetters({ statuses: ["draft", "review", "approved"] })).length : 0;
        return { dry_run: true, changed, printed_changed: printedChanged, would_clear: wouldClear, would_prepare_again: toRedo };
      }
      const busy = await S.listLetters({ statuses: IN_PINGEN, limit: 1 });
      if (busy.length) throw new ApiError("wrong_state", "Some letters are with Pingen. Remove them from Pingen (or post them) before changing settings.");
      // A new privacy URL needs its own check.
      const resetPrivacy = v.clean.privacy_url !== undefined && v.clean.privacy_url !== before.privacy_url ? { privacy_check_ok: null, privacy_checked_at: null, privacy_checked_url: null, privacy_check_note: null } : {};
      const after = await S.updateSettings({ ...v.clean, ...resetPrivacy, updated_by: actor });
      const changed = Object.keys(v.clean).filter((k) => (before as Record<string, unknown>)[k] !== (after as Record<string, unknown>)[k]);
      await audit({ actor, event: "settings_updated", detail: { changed, values: Object.fromEntries(changed.map((k) => [k, (after as Record<string, unknown>)[k]])) } });
      let cleared = 0;
      if (canonicalJson(printedSettings(before)) !== canonicalJson(printedSettings(after))) {
        for (const l of await S.listLetters({ statuses: ["approved"] })) {
          await move(l, "review", { approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false, previewed_sha256: null }, actor, "approval_cleared", { reason: "settings printed on the letter changed" });
          cleared++;
        }
      }
      return { settings: after, readiness: await readiness(after), approvals_cleared: cleared };
    },

    // Review fix (17 Nov, security and UX H2): the tick is no longer taken on
    // trust. It needs a test BAJA that really came through WhatsApp and was
    // recorded by the bot (a letter_optouts row with test true, written for
    // the bot's test numbers only) in the last 7 days.
    async optout_route_confirm(b, actor) {
      const yes = b.confirmed === true;
      let testRow: Optout | null = null;
      if (yes) {
        testRow = await S.latestTestOptout(new Date(ctx.now().getTime() - 7 * DAY).toISOString());
        if (!testRow) throw new ApiError("optout_route_not_tested", "No test BAJA has come through WhatsApp in the last 7 days. From one of the bot's test numbers, send BAJA to the bot's WhatsApp, wait for your card about it, then confirm again.");
      }
      const s = await S.updateSettings({ optout_route_confirmed_at: yes ? nowIso() : null, optout_route_confirmed_by: yes ? actor : null, updated_by: actor });
      await audit({ actor, event: yes ? "optout_route_confirmed" : "optout_route_unconfirmed", detail: testRow ? { test_optout_id: testRow.id, test_at: testRow.created_at } : undefined });
      return { settings: s, test_seen_at: testRow?.created_at ?? null };
    },

    // Review fix (17 Nov, UX M7): the privacy page every letter links to is
    // fetched and must have its section for businesses (the #fragment of the
    // URL as an element id) and no FALTA placeholder left in it.
    async privacy_check(_b, actor) {
      const st = await S.getSettings();
      const url = String(st.privacy_url || "");
      if (!url || !PRIVACY_URL_RE.test(url)) throw new ApiError("settings_incomplete", "Set the privacy page URL (on massageclub.io) in Settings first.");
      const [page, frag] = url.split("#");
      let ok = false, note = "";
      if (!frag) note = "The URL has no #section (for example #negocios), so the letter cannot point at the part for businesses.";
      else {
        try {
          const r = await ctx.fetch(page, { method: "GET", headers: { accept: "text/html" } });
          const html = r.ok ? await r.text() : "";
          const idRe = new RegExp(`\\sid\\s*=\\s*["']${frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
          if (!r.ok) note = `The page answered ${r.status}.`;
          else if (!idRe.test(html)) note = `The page has no section with id "${frag}". A page drawn by the app in the browser cannot be checked: use the static page (for example /privacidad).`;
          else if (/FALTA\b/.test(html)) note = "The page still has a FALTA (missing) placeholder: fill in the legal sender on it first.";
          else { ok = true; note = `Found the section "${frag}".`; }
        } catch (e) { note = `Could not open the page: ${(e as Error).message}`; }
      }
      const u = await S.updateSettings({ privacy_check_ok: ok, privacy_checked_at: nowIso(), privacy_checked_url: url, privacy_check_note: note });
      await audit({ actor, event: "privacy_checked", detail: { url, ok, note } });
      return { ok, note, url, settings: u, readiness: await readiness(u) };
    },

    async list_import(b, actor) {
      if (mode() === "live") await requirePasscode(b.passcode, actor);
      const listVersion = String(b.list_version ?? "").trim();
      if (!/^[0-9A-Za-z._-]{1,40}$/.test(listVersion)) throw new ApiError("bad_request", "list_version: letters, digits, dots, dashes (for example 2026-11-15).");
      const how = b.mode === "add" ? "add" : b.mode === "replace" ? "replace" : "";
      if (!how) throw new ApiError("bad_request", "mode must be replace or add.");
      const csv = String(b.csv ?? "");
      if (csv.length > 2_000_000) throw new ApiError("bad_request", "The file is too big.");
      const parsed = parseListCsv(csv);
      if (!parsed.ok) throw new ApiError("validation_failed", `The list has ${parsed.errors.length} problem${parsed.errors.length === 1 ? "" : "s"}. Nothing was imported.`, { errors: parsed.errors, warnings: parsed.warnings });
      const ids = parsed.rows.map((r) => r.partner_id).filter((x): x is string => !!x);
      const partners = new Map((await S.getPartners(ids)).map((p) => [p.id, p]));
      const errs: Problem[] = [];
      const warns: Problem[] = [...parsed.warnings];
      for (const r of parsed.rows) {
        if (!r.partner_id) continue;
        const p = partners.get(r.partner_id);
        if (!p) errs.push({ code: "unknown_studio", line: r.line, message: `Line ${r.line}: no studio with id ${r.partner_id}.` });
        else if (!squash(String(p.address ?? ""))) warns.push({ code: "no_partner_address", line: r.line, message: `Line ${r.line}: the studio has no address in our records, so address changes cannot be noticed.` });
      }
      if (errs.length) throw new ApiError("validation_failed", `The list has ${errs.length} problem${errs.length === 1 ? "" : "s"}. Nothing was imported.`, { errors: errs, warnings: warns });
      let deactivated = 0;
      if (how === "replace") {
        deactivated += await S.deactivateRecipients({ kind: "studio" });
        if (parsed.rows.some((r) => r.kind === "proof")) deactivated += await S.deactivateRecipients({ kind: "proof" });
      } else {
        deactivated += await S.deactivateRecipients({ partner_ids: ids });
        if (parsed.rows.some((r) => r.kind === "proof")) {
          const activeProofs = (await S.listRecipients({ activeOnly: true, kind: "proof" })).length;
          if (activeProofs + parsed.rows.filter((r) => r.kind === "proof").length > 3) throw new ApiError("validation_failed", "At most 3 proof addresses can be active.");
        }
      }
      // Review fix (17 Nov, UX M4): "unit unknown" and "medium confidence" are
      // decided once, here, for the rows Jordan has checked (accept_warnings),
      // instead of a tick on every letter.
      const accept = b.accept_warnings === true;
      const risky = (r: { unit_status: string; confidence: string }) => r.unit_status === "unit unknown" || (!!r.confidence && r.confidence !== "high");
      const rows = parsed.rows.map((r) => ({
        kind: r.kind, partner_id: r.partner_id, list_version: listVersion, display_name: r.address_lines[0], greeting_name: r.address_lines[0],
        address_lines: r.address_lines, postcode: r.postcode, town: r.town, unit_status: r.unit_status, confidence: r.confidence,
        partner_address_at_import: r.partner_id ? String(partners.get(r.partner_id)?.address ?? "") : null, needs_review: null, active: true,
        imported_by: actor, warnings_acked_at: accept && risky(r) ? nowIso() : null, warnings_acked_by: accept && risky(r) ? actor : null,
      }));
      const inserted = await S.insertRecipients(rows as unknown as Omit<Recipient, "id">[]);
      // Review fix (17 Nov, UX M5): a corrected address reaches the letters not
      // posted yet. Their studio's new list row replaces the old one, so the
      // letter is prepared again (an approval of the old address is cleared).
      let repointed = 0;
      for (const r of inserted) {
        if (r.kind !== "studio" || !r.partner_id) continue;
        for (const l of await S.listLetters({ partner_ids: [r.partner_id], statuses: EDITABLE })) {
          if (l.recipient_id === r.id) continue;
          let cur = l;
          if (cur.status === "approved") cur = await move(cur, "review", { approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false, previewed_sha256: null }, actor, "approval_cleared", { reason: "mailing list row replaced" });
          await S.updateLetter(cur.id, { recipient_id: r.id }, cur.status);
          await audit({ actor, event: "recipient_replaced", campaign_id: cur.campaign_id, letter_id: cur.id, detail: { list_version: listVersion } });
          repointed++;
        }
      }
      await audit({ actor, event: "list_imported", detail: { list_version: listVersion, mode: how, rows: inserted.length, deactivated, warnings: warns.length, accepted: accept ? rows.filter((r) => r.warnings_acked_at).length : 0, letters_updated: repointed } });
      return { imported: inserted.length, deactivated, list_version: listVersion, warnings: warns, accepted: accept ? rows.filter((r) => r.warnings_acked_at).length : 0, letters_updated: repointed };
    },

    async eligible_list() {
      const recips = await S.listRecipients({ activeOnly: true });
      const c = await loadCtx(recips.map((r) => r.id));
      const allLetters = await S.listLetters({ partner_ids: [...c.partner.keys()] });
      const rows = recips.map((r) => {
        const p = r.partner_id ? c.partner.get(r.partner_id) ?? null : null;
        const e = elig(c, r.id);
        const last = allLetters.filter((l) => l.partner_id && l.partner_id === r.partner_id && l.status !== "withdrawn").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        return {
          recipient_id: r.id, kind: r.kind, partner_id: r.partner_id, display_name: r.display_name, greeting_name: r.greeting_name, address_lines: r.address_lines,
          postcode: r.postcode, town: r.town, unit_status: r.unit_status, confidence: r.confidence, list_version: r.list_version,
          warnings_acked_at: r.warnings_acked_at ?? null,
          partner: p ? { business_name: p.business_name, status: p.status, outreach_status: p.outreach_status, opted_out_at: p.opted_out_at } : null,
          eligible: e.eligible, reasons: e.reasons, warnings: e.warnings, infos: e.infos,
          last_letter: last ? { campaign_id: last.campaign_id, status: last.status, ref_code: last.ref_code, submitted_at: last.submitted_at } : null,
        };
      });
      const unit = unitPrice(null, c.settings);
      const n = rows.filter((r) => r.eligible).length;
      return { rows, eligible_count: n, unit_price_eur: unit, estimate_all_eligible: costEstimate(Array(n).fill(unit), c.settings.vat_rate) };
    },

    async campaigns_list() {
      const s = await S.getSettings();
      const out = [];
      for (const c of await S.listCampaigns()) {
        const ls = await S.listLetters({ campaign_id: c.id });
        const counts: Record<string, number> = {};
        for (const l of ls) counts[l.status] = (counts[l.status] || 0) + 1;
        const toPost = ls.filter((l) => l.status === "approved" || l.status === "ready");
        out.push({ ...c, template: undefined, counts, total: ls.length, approved: counts.approved || 0, estimate_to_post: costEstimate(toPost.map((l) => unitPrice(l, s)), s.vat_rate) });
      }
      return { campaigns: out };
    },

    async campaign_create(b, actor) {
      const name = squash(nfc(b.name));
      if (name.length < 3 || name.length > 80 || DASH_RE.test(name)) throw new ApiError("bad_request", "Campaign name: 3 to 80 characters, no long dashes.");
      const ids = strIds(b.recipient_ids);
      if (!ids.length) throw new ApiError("bad_request", "Choose at least one studio.");
      const base = defaultTemplate();
      const { template } = b.template ? templateForSave(b.template, base) : { template: base };
      // Check eligibility before creating anything.
      const c0 = await loadCtx(ids);
      if (!ids.some((id) => elig(c0, id).eligible)) {
        throw new ApiError("validation_failed", "None of the chosen studios can be written to.", { skipped: ids.map((id) => ({ recipient_id: id, reasons: elig(c0, id).reasons })) });
      }
      const camp = await S.insertCampaign({ name, status: "open", template, template_version: 1, pingen_env: null, copied_from: null, created_by: actor });
      await audit({ actor, event: "campaign_created", campaign_id: camp.id, detail: { name, recipients: ids.length } });
      const r = await newLetters(camp, ids, actor);
      return { campaign: camp, created: r.created.length, skipped: r.skipped };
    },

    async campaign_get(b) {
      const camp = await getCampaign(b.campaign_id);
      const letters = await S.listLetters({ campaign_id: camp.id });
      const c = await loadCtx(letters.map((l) => l.recipient_id));
      const counts: Record<string, number> = {};
      for (const l of letters) counts[l.status] = (counts[l.status] || 0) + 1;
      return {
        campaign: camp,
        template_check: validateTemplate(camp.template),
        counts,
        letters: letters.map((l) => {
          const r = c.recip.get(l.recipient_id);
          return { ...letterOut(l), display_name: r?.display_name ?? null, kind: r?.kind ?? null, town: r?.town ?? null, eligibility: elig(c, l.recipient_id, l) };
        }),
        proof: {
          letter_ids: letters.filter((l) => c.recip.get(l.recipient_id)?.kind === "proof").map((l) => l.id),
          confirmed_at: camp.proof_confirmed_at ?? null, confirmed_by: camp.proof_confirmed_by ?? null,
        },
      };
    },

    async campaign_update_template(b, actor) {
      const camp = await getCampaign(b.campaign_id);
      const letters = await S.listLetters({ campaign_id: camp.id });
      if (letters.some((l) => !EDITABLE.includes(l.status) && l.status !== "withdrawn")) throw new ApiError("wrong_state", "Letters of this campaign are already with Pingen or posted, so its text is fixed. Duplicate the campaign to change it.");
      const { template: next, check } = templateForSave(b.template, camp.template);
      const merged = markStale(camp.template, next);
      const u = await S.updateCampaign(camp.id, { template: merged, template_version: camp.template_version + 1 }, Number(b.expected_version));
      if (!u) throw new ApiError("stale", "The template was changed elsewhere. Reload it first.");
      const spanishChanged = canonicalJson(spanishTemplate(camp.template)) !== canonicalJson(spanishTemplate(merged));
      let cleared = 0;
      if (spanishChanged) {
        for (const l of letters.filter((x) => x.status === "approved")) {
          await move(l, "review", { approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false, previewed_sha256: null }, actor, "approval_cleared", { reason: "letter text changed" });
          cleared++;
        }
      }
      await audit({ actor, event: "template_updated", campaign_id: camp.id, detail: { version: u.template_version, spanish_changed: spanishChanged, approvals_cleared: cleared } });
      return { campaign: u, template_check: check, approvals_cleared: cleared };
    },

    // Closing a campaign takes its approved letters out of the "already being
    // written to" check for other campaigns; nothing else changes.
    async campaign_set_status(b, actor) {
      const camp = await getCampaign(b.campaign_id);
      const to = b.status === "closed" ? "closed" : b.status === "open" ? "open" : "";
      if (!to) throw new ApiError("bad_request", "status must be open or closed.");
      const letters = await S.listLetters({ campaign_id: camp.id, statuses: IN_PINGEN });
      if (to === "closed" && letters.length) throw new ApiError("wrong_state", "Some letters of this campaign are with Pingen. Post them or take them back first.");
      const u = await S.updateCampaign(camp.id, { status: to });
      await audit({ actor, event: `campaign_${to}`, campaign_id: camp.id });
      return { campaign: u };
    },

    async campaign_add_recipients(b, actor) {
      const camp = await getCampaign(b.campaign_id);
      if (camp.status !== "open") throw new ApiError("wrong_state", "This campaign is closed.");
      const r = await newLetters(camp, strIds(b.recipient_ids), actor);
      return { created: r.created.length, skipped: r.skipped };
    },

    async letter_remove(b, actor) {
      const ids = strIds(b.letter_ids ?? (b.letter_id ? [b.letter_id] : []));
      if (!ids.length) throw new ApiError("bad_request", "letter_ids is empty.");
      const done: string[] = [];
      const refused: { letter_id: string; reason: string }[] = [];
      for (const id of ids) {
        const l = await S.getLetter(id);
        if (!l) { refused.push({ letter_id: id, reason: "No such letter." }); continue; }
        if (!EDITABLE.includes(l.status)) { refused.push({ letter_id: id, reason: `It is ${l.status}. Remove it from Pingen first (letter_unqueue).` }); continue; }
        await move(l, "withdrawn", {}, actor, "withdrawn", { reason: "removed by Jordan" });
        done.push(id);
      }
      return { withdrawn: done, refused };
    },

    async campaign_duplicate(b, actor) {
      const src = await getCampaign(b.campaign_id);
      const name = squash(nfc(b.name ?? `${src.name} (copy)`)).slice(0, 80);
      const camp = await S.insertCampaign({ name, status: "open", template: src.template, template_version: 1, pingen_env: null, copied_from: src.id, created_by: actor });
      const letters = await S.listLetters({ campaign_id: src.id });
      const ids = uniq(letters.filter((l) => l.status !== "withdrawn").map((l) => l.recipient_id));
      const active = new Set((await S.getRecipients(ids)).filter((r) => r.active).map((r) => r.id));
      await audit({ actor, event: "campaign_created", campaign_id: camp.id, detail: { copied_from: src.id } });
      const r = await newLetters(camp, ids.filter((id) => active.has(id)), actor);
      // Each letter prints its own reference code, so a copy is a new PDF and
      // needs its own look and approval.
      return { campaign: camp, created: r.created.length, skipped: r.skipped, note: "Every letter in the copy has a new reference code, so each needs approving again." };
    },

    async letters_render(b, actor) {
      const camp = await getCampaign(b.campaign_id);
      const want = b.letter_ids ? new Set(strIds(b.letter_ids)) : null;
      const letters = (await S.listLetters({ campaign_id: camp.id })).filter((l) => ["draft", "review", "approved"].includes(l.status) && (!want || want.has(l.id)));
      const c = await loadCtx(letters.map((l) => l.recipient_id));
      let rendered = 0, unchanged = 0, i = 0;
      const failed: { letter_id: string; message: string }[] = [];
      for (; i < letters.length && rendered < 10; i++) {
        const before = letters[i];
        const after = await ensureRendered(before, camp, c, actor);
        if (after === before || after.pdf_sha256 === before.pdf_sha256 && after.render_inputs_sha256 === before.render_inputs_sha256) { unchanged++; continue; }
        rendered++;
        if (!after.pdf_sha256) failed.push({ letter_id: after.id, message: String(after.status_reason || "Could not render.") });
      }
      return { rendered, unchanged, failed, remaining: letters.length - i, done: i >= letters.length };
    },

    async letter_preview(b, actor) {
      let l = await getLetter(b.letter_id);
      const camp = await getCampaign(l.campaign_id);
      const c = await loadCtx([l.recipient_id]);
      l = await ensureRendered(l, camp, c, actor);
      const r = c.recip.get(l.recipient_id);
      const greeting = squash(nfc(l.greeting_name ?? r?.greeting_name ?? ""));
      let pdf: Uint8Array | null = null;
      if (l.pdf_path) {
        pdf = await S.getPdf(l.pdf_path);
        if (pdf && (await sha256Hex(pdf)) !== l.pdf_sha256) throw new ApiError("wrong_state", "The stored PDF does not match its fingerprint. Re-render this letter.");
      }
      // Review fix (17 Nov, UX H3 and security L14): fetching the bytes no
      // longer counts as looking at the letter. The page says so with
      // letter_seen once it has drawn the page wide enough to read, or the
      // readable crops on a phone.
      const vals = tagValues(c.settings);
      const enVals = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v.missing ? { text: (MISSING as Record<string, { en: string }>)[k]?.en ?? v.text, missing: true } : v]));
      const safeMerge = (t: string, v: Record<string, { text: string }>, allowed: string[]) => { try { return mergeText(t, v, allowed); } catch { return t; } };
      return {
        letter: letterOut(l),
        pdf_base64: pdf ? bytesToBase64(pdf) : null,
        sha256: l.pdf_sha256,
        layout: l.layout,
        address_lines: l.address_lines ?? r?.address_lines ?? null,
        qr_url: l.qr_url,
        greeting,
        english: {
          body: safeMerge(camp.template.body_en, { nombre: { text: greeting } }, TAGS.body),
          optout: safeMerge(camp.template.optout_en, enVals, TAGS.optout),
          privacy: safeMerge(camp.template.privacy_en, enVals, TAGS.privacy),
          qr_caption: camp.template.qr_caption_en,
          stale: { body: camp.template.body_en_stale, optout: camp.template.optout_en_stale, privacy: camp.template.privacy_en_stale },
        },
        body_en_merged: safeMerge(camp.template.body_en, { nombre: { text: greeting } }, TAGS.body),
        eligibility: elig(c, l.recipient_id, l),
        template_check: validateTemplate(camp.template),
        can_approve: l.status === "review" && !!l.pdf_sha256 && Number((l.layout as Record<string, unknown> | null)?.placeholders ?? 0) === 0,
      };
    },

    async letter_seen(b, actor) {
      let l = await getLetter(b.letter_id);
      const sha = String(b.sha256 ?? "");
      const how = ["full", "crops", "zoom"].includes(String(b.how)) ? String(b.how) : "";
      if (!how) throw new ApiError("bad_request", "how must be full, crops or zoom.");
      if (!["review", "approved"].includes(l.status)) return { letter: letterOut(l) };
      if (!/^[0-9a-f]{64}$/.test(sha) || sha !== l.pdf_sha256) throw new ApiError("stale", "This letter changed since it was drawn. Look at it again.");
      if (l.previewed_sha256 !== l.pdf_sha256) {
        l = (await S.updateLetter(l.id, { previewed_sha256: l.pdf_sha256, previewed_at: nowIso(), previewed_by: actor }, l.status)) ?? l;
        await audit({ actor, event: "previewed", campaign_id: l.campaign_id, letter_id: l.id, detail: { sha256: l.pdf_sha256, how } });
      }
      return { letter: letterOut(l) };
    },

    async letter_set_greeting(b, actor) {
      const l = await getLetter(b.letter_id);
      if (!EDITABLE.includes(l.status)) throw new ApiError("wrong_state", `The letter is ${l.status}: its greeting is fixed.`);
      const g = squash(nfc(b.greeting_name));
      const probs = greetingProblems(g);
      if (probs.length) throw new ApiError("validation_failed", probs.map((p) => p.message).join(" "), { errors: probs });
      let cur = l;
      if (cur.status === "approved") cur = await move(cur, "review", { approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false }, actor, "approval_cleared", { reason: "greeting changed" });
      cur = (await S.updateLetter(cur.id, { greeting_name: g }, cur.status)) ?? cur;
      await audit({ actor, event: "greeting_set", campaign_id: cur.campaign_id, letter_id: cur.id, detail: { greeting_name: g } });
      if (cur.status === "rejected") return { letter: letterOut(cur) };
      const camp = await getCampaign(cur.campaign_id);
      const c = await loadCtx([cur.recipient_id]);
      return { letter: letterOut(await ensureRendered(cur, camp, c, actor)) };
    },

    async letter_approve(b, actor) {
      const l = await getLetter(b.letter_id);
      const camp = await getCampaign(l.campaign_id);
      const c = await loadCtx([l.recipient_id]);
      const r = await approveCheck(l, camp, c, String(b.sha256 ?? ""), b.ack_warnings === true, actor);
      if (!r.ok) throw new ApiError(r.code, r.message, r.extra);
      const u = await move(r.letter, "approved", { approved_sha256: r.letter.pdf_sha256, approved_at: nowIso(), approved_by: actor, warnings_acked: r.warnings > 0 }, actor, "approved", { sha256: r.letter.pdf_sha256, warnings_acked: r.warnings });
      return { letter: letterOut(u) };
    },

    async letters_approve_bulk(b, actor) {
      const items = Array.isArray(b.items) ? b.items as { letter_id?: unknown; sha256?: unknown }[] : [];
      if (!items.length || items.length > 200) throw new ApiError("bad_request", "items: 1 to 200 letters.");
      const checked: { letter: Letter; warnings: number }[] = [];
      const failed: { letter_id: string; error: string; message: string }[] = [];
      for (const it of items) {
        const l = await S.getLetter(String(it.letter_id ?? "").toLowerCase());
        if (!l) { failed.push({ letter_id: String(it.letter_id), error: "not_found", message: "No such letter." }); continue; }
        const camp = await getCampaign(l.campaign_id);
        const c = await loadCtx([l.recipient_id]);
        const r = await approveCheck(l, camp, c, String(it.sha256 ?? ""), b.ack_warnings === true, actor);
        if (!r.ok) failed.push({ letter_id: l.id, error: r.code, message: r.message });
        else checked.push({ letter: r.letter, warnings: r.warnings });
      }
      if (failed.length) throw new ApiError("validation_failed", `${failed.length} of ${items.length} letters cannot be approved. None were approved.`, { failed });
      const approved: string[] = [];
      for (const x of checked) {
        await move(x.letter, "approved", { approved_sha256: x.letter.pdf_sha256, approved_at: nowIso(), approved_by: actor, warnings_acked: x.warnings > 0 }, actor, "approved", { sha256: x.letter.pdf_sha256, bulk: true });
        approved.push(x.letter.id);
      }
      return { approved };
    },

    async letter_reject(b, actor) {
      let l = await getLetter(b.letter_id);
      const reason = squash(nfc(b.reason)).slice(0, 300);
      if (!reason) throw new ApiError("bad_request", "Say why (a few words).");
      if (l.status === "approved") l = await move(l, "review", { approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false }, actor, "approval_cleared", { reason: "rejected" });
      if (l.status !== "review") throw new ApiError("wrong_state", `The letter is ${l.status}; only letters waiting for review or approved can be rejected.`);
      const u = await move(l, "rejected", { rejected_at: nowIso(), rejected_by: actor, reject_reason: reason }, actor, "rejected", { reason });
      return { letter: letterOut(u) };
    },

    async letter_reopen(b, actor) {
      const l = await getLetter(b.letter_id);
      if (l.status !== "rejected") throw new ApiError("wrong_state", "Only a rejected letter can be reopened.");
      const u = await move(l, "review", { rejected_at: null, rejected_by: null, reject_reason: null, previewed_sha256: null }, actor, "reopened");
      return { letter: letterOut(u) };
    },

    async campaign_queue(b, actor) {
      const m = mode();
      if (m === "test") throw new ApiError("test_mode", `${TEST_MODE_MSG} Use the rehearsal (campaign_dry_run) instead.`);
      const settings = await S.getSettings();
      const miss = settingsMissing(settings);
      if (miss.length) throw new ApiError("settings_incomplete", miss.join(" "));
      if (!E("MC_SIGN_KEY")) throw new ApiError("sign_key_missing", "MC_SIGN_KEY is not set as an Edge Function secret.");
      const cl = client();
      const camp = await getCampaign(b.campaign_id);
      if (camp.status !== "open") throw new ApiError("wrong_state", "This campaign is closed. Reopen it to upload or post its letters.");
      if (camp.pingen_env && camp.pingen_env !== cl.env) throw new ApiError("env_mismatch", `This campaign was uploaded to Pingen ${camp.pingen_env}; LETTERS_MODE now points at ${cl.env}. Duplicate the campaign to use ${cl.env}.`);
      const want = b.letter_ids ? new Set(strIds(b.letter_ids)) : null;
      const all = (await S.listLetters({ campaign_id: camp.id })).filter((l) => l.status === "approved" && (!want || want.has(l.id)));
      // Review fix (17 Nov, test report e): the page's selector sends one kind
      // for every letter; an object per letter id still works.
      const simAll = m === "staging" && typeof b.simulate === "string" ? String(b.simulate) : "";
      const sim = m === "staging" && b.simulate && typeof b.simulate === "object" ? b.simulate as Record<string, string> : Object.fromEntries(simAll ? all.map((l) => [l.id, simAll]) : []);
      // Review fix (17 Nov, test report m): every approved letter is checked
      // on each call, and only those that pass count towards the 10 uploads,
      // so refused letters at the front can never starve the rest.
      const c = await loadCtx(all.map((l) => l.recipient_id), settings);
      const outcomes: { letter_id: string; ref_code: string; status: string; message: string; name?: string | null }[] = [];
      let uploads = 0, remaining = 0;
      for (const l0 of all) {
        const refuse = await letterChecks(l0, camp, c, "approved");
        if (refuse) {
          outcomes.push({ letter_id: l0.id, ref_code: l0.ref_code, status: "refused", message: refuse, name: c.recip.get(l0.recipient_id)?.display_name ?? null });
          await audit({ actor, event: "queue_refused", campaign_id: camp.id, letter_id: l0.id, detail: { reason: refuse } });
          continue;
        }
        if (uploads >= 10) { remaining++; continue; }
        uploads++;
        let l: Letter;
        try { l = await move(l0, "uploading", {}, actor, "queue_claimed"); } catch { outcomes.push({ letter_id: l0.id, ref_code: l0.ref_code, status: l0.status, message: "Already being uploaded." }); continue; }
        let stage = "read";
        try {
          const bytes = l.pdf_path ? await S.getPdf(l.pdf_path) : null;
          if (!bytes || (await sha256Hex(bytes)) !== l.approved_sha256) {
            l = await move(l, "approved", { last_error: "The stored PDF is not the approved one." }, actor, "queue_failed", { stage });
            outcomes.push({ letter_id: l.id, ref_code: l.ref_code, status: l.status, message: "The stored PDF is not the approved one." });
            continue;
          }
          stage = "upload";
          const up = await cl.uploadPdf(bytes);
          stage = "create";
          const s = sim[l.id];
          const suffix = s && ["undeliverable", "unprintable", "cancellable"].includes(s) ? `_simulate_${s}` : "";
          const created = await cl.createLetter({ fileName: `MC-${l.ref_code}${suffix}.pdf`, fileUrl: up.url, fileUrlSignature: up.signature }, idemKey("c", l.id, l.approved_sha256!));
          stage = "created";
          l = await move(l, "checking", { pingen_env: cl.env, pingen_letter_id: created.id, pingen_status: created.status, uploaded_sha256: l.approved_sha256, uploaded_at: nowIso(), last_error: null }, actor, "uploaded", { pingen_letter_id: created.id, request_id: created.requestId, simulate: suffix || undefined });
          if (!camp.pingen_env) { await S.updateCampaign(camp.id, { pingen_env: cl.env }); camp.pingen_env = cl.env; }
          l = await pollUntilChecked(l, cl, actor);
          outcomes.push({ letter_id: l.id, ref_code: l.ref_code, status: l.status, message: l.status === "ready" ? "Uploaded and checked. Nothing is posted yet." : l.status === "blocked" ? String(l.status_reason) : "Uploaded; Pingen is still checking it." });
        } catch (e) {
          const msg = e instanceof PingenError || e instanceof ApiError ? e.message : String(e);
          const definite = e instanceof PingenError && e.status >= 400 && e.status < 500;
          if (l.status === "uploading") {
            const to = stage === "create" && !definite ? "error" : "approved";
            l = await move(l, to, { last_error: to === "error" ? `Create outcome unknown: ${msg}` : msg }, actor, "queue_failed", { stage, message: msg, request_id: e instanceof PingenError ? e.requestId : undefined });
          } else {
            await S.updateLetter(l.id, { last_error: msg });
            await audit({ actor, event: "pingen_check_failed", campaign_id: camp.id, letter_id: l.id, detail: { message: msg } });
          }
          outcomes.push({ letter_id: l.id, ref_code: l.ref_code, status: l.status, message: msg });
        }
      }
      for (const o of outcomes) if (!o.name) o.name = c.recip.get((all.find((l) => l.id === o.letter_id) || { recipient_id: "" }).recipient_id)?.display_name ?? null;
      return { outcomes, uploaded: uploads, refused: outcomes.filter((o) => o.status === "refused").length, done: remaining === 0, remaining };
    },

    async pingen_refresh(b, actor) {
      const cl = client();
      const camp = await getCampaign(b.campaign_id);
      if (camp.pingen_env && camp.pingen_env !== cl.env) throw new ApiError("env_mismatch", `This campaign is on Pingen ${camp.pingen_env}; LETTERS_MODE points at ${cl.env}.`);
      const letters = (await S.listLetters({ campaign_id: camp.id })).filter((l) => l.pingen_letter_id && ["checking", "submitted", "sent", "error"].includes(l.status));
      const batch = letters.slice(0, 20);
      const out: { letter_id: string; status: string; pingen_status: string | null }[] = [];
      for (const l of batch) {
        try {
          const g = await cl.getLetter(l.pingen_letter_id!);
          const u = await reconcile(l, g.attrs, cl, actor);
          out.push({ letter_id: u.id, status: u.status, pingen_status: u.pingen_status });
        } catch (e) {
          out.push({ letter_id: l.id, status: l.status, pingen_status: `could not read: ${(e as Error).message}` });
        }
      }
      return { letters: out, remaining: letters.length - batch.length };
    },

    async letter_unqueue(b, actor) {
      const l = await getLetter(b.letter_id);
      if (!["ready", "blocked", "error"].includes(l.status)) throw new ApiError("wrong_state", `The letter is ${l.status}. Only letters uploaded but not posted can be taken back.`);
      if (l.pingen_letter_id) {
        const cl = client();
        if (l.pingen_env !== cl.env) throw new ApiError("env_mismatch", `This letter is on Pingen ${l.pingen_env}; set LETTERS_MODE to match to remove it.`);
        const g = await cl.getLetter(l.pingen_letter_id).catch(() => null);
        if (g && PINGEN_POSTED.includes(String(g.attrs.status))) throw new ApiError("wrong_state", `Pingen says this letter is ${g.attrs.status}: it can no longer be taken back. Refresh from Pingen.`);
        await cl.deleteLetter(l.pingen_letter_id);
      }
      const camp = await getCampaign(l.campaign_id);
      const c = await loadCtx([l.recipient_id]);
      const r = c.recip.get(l.recipient_id);
      const p = r?.partner_id ? c.partner.get(r.partner_id) ?? null : null;
      const same = r ? (await renderInputs(l, camp, c.settings, r, p)).sha === l.render_inputs_sha256 : false;
      const clear = { pingen_letter_id: null, pingen_status: null, pingen_address: null, pingen_pages: null, pingen_fonts: null, pingen_price: null, pingen_currency: null, uploaded_sha256: null, uploaded_at: null, pingen_env: null };
      const to = l.status !== "error" && same && l.pdf_sha256 === l.approved_sha256 ? "approved" : "review";
      const u = await move(l, to, { ...clear, ...(to === "review" ? { approved_sha256: null, approved_at: null, approved_by: null, warnings_acked: false } : {}) }, actor, "unqueued", { deleted_in_pingen: !!l.pingen_letter_id });
      return { letter: letterOut(u) };
    },

    // Review fix (17 Nov, test report a and b, UX M9): the dry run is also
    // what the Post page posts. It works out the batch the server will take
    // (the per-post cap and what is left of today's cap), with the count and
    // the total to confirm, so one refused letter no longer blocks every post.
    async campaign_dry_run(b, actor) {
      const m = mode();
      const settings = await S.getSettings();
      const camp = await getCampaign(b.campaign_id);
      const want = b.letter_ids ? new Set(strIds(b.letter_ids)) : null;
      const letters = (await S.listLetters({ campaign_id: camp.id })).filter((l) => (l.status === "approved" || l.status === "ready") && (!want || want.has(l.id)));
      const c = await loadCtx(letters.map((l) => l.recipient_id), settings);
      const global = await globalChecks(m, settings);
      if (camp.status !== "open") global.push({ check: "campaign_open", ok: false, message: "This campaign is closed. Reopen it to post." });
      const rows: { letter_id: string; ref_code: string; name: string | null; kind: string | null; status: string; ok: boolean; reason: string | null }[] = [];
      const passing: Letter[] = [];
      for (const l of letters) {
        let reason = await letterChecks(l, camp, c, m === "test" ? "approved" : "ready");
        if (!reason) reason = proofGate(m, camp, c, l);
        if (!reason && l.pdf_path) {
          const bytes = await S.getPdf(l.pdf_path);
          if (!bytes || (await sha256Hex(bytes)) !== l.approved_sha256) reason = "The stored PDF is not the approved one.";
        }
        if (!reason) passing.push(l);
        const r = c.recip.get(l.recipient_id);
        rows.push({ letter_id: l.id, ref_code: l.ref_code, name: r?.display_name ?? null, kind: r?.kind ?? null, status: l.status, ok: !reason, reason });
      }
      // The proof letter goes first in a batch.
      passing.sort((a, z) => Number(c.recip.get(z.recipient_id)?.kind === "proof") - Number(c.recip.get(a.recipient_id)?.kind === "proof"));
      const cap = Math.min(settings.max_per_send, 20);
      const today = await S.countSubmittedSince(madridDayStart(ctx.now()).toISOString());
      const left = Math.max(0, settings.daily_cap - today);
      const batch = passing.slice(0, Math.min(cap, left));
      const caps = { max_per_send: cap, daily_cap: settings.daily_cap, posted_today: today, daily_left: left, over: passing.length > batch.length };
      const est = costEstimate(batch.map((l) => unitPrice(l, settings)), settings.vat_rate);
      const estAll = costEstimate(passing.map((l) => unitPrice(l, settings)), settings.vat_rate);
      await audit({ actor, event: "dry_run", campaign_id: camp.id, detail: { mode: m, would_post: passing.length, batch: batch.length, refused: rows.length - passing.length, net_cents: est.net_cents } });
      const proofIds = new Set(letters.filter((l) => c.recip.get(l.recipient_id)?.kind === "proof").map((l) => l.id));
      return {
        mode: m, global, letters: rows, would_post: passing.map((l) => l.id), caps, estimate: est, estimate_all: estAll,
        batch: batch.map((l) => l.id), batch_studios: batch.filter((l) => !proofIds.has(l.id)).length, batch_proofs: batch.filter((l) => proofIds.has(l.id)).length,
        confirm_count: batch.length, confirm_total: fmtEur(est.net_cents),
        proof: { letter_ids: [...proofIds], confirmed_at: camp.proof_confirmed_at ?? null, needed: m === "live" && !camp.proof_confirmed_at },
        note: m === "test" ? `${TEST_MODE_MSG} This rehearsal changed nothing.` : "This rehearsal changed nothing. Post only the letters listed as ok.",
      };
    },

    // Review fix (17 Nov, UX H2): Jordan's own proof letter arrived, looks
    // right and its QR opens. Only then (in live) are studio letters posted.
    async campaign_proof_confirm(b, actor) {
      const camp = await getCampaign(b.campaign_id);
      const yes = b.confirmed === true;
      if (yes) {
        const letters = await S.listLetters({ campaign_id: camp.id });
        const recips = await S.getRecipients(uniq(letters.map((l) => l.recipient_id)));
        const proofs = letters.filter((l) => recips.find((r) => r.id === l.recipient_id)?.kind === "proof");
        const posted = proofs.find((l) => l.pingen_env === "production" && ["submitted", "sent", "delivered"].includes(l.status));
        if (!posted) throw new ApiError("wrong_state", proofs.length ? "Post the proof letter in live first, and confirm it once it has arrived." : "This campaign has no proof letter. Add your own address (a proof row of the mailing list) to it, post that letter alone, and confirm it once it has arrived.");
        if (b.arrived !== true || b.looks_right !== true || b.qr_opens !== true) throw new ApiError("bad_request", "Tick all three: it arrived, it looks right, and its QR opens.");
      }
      const u = await S.updateCampaign(camp.id, { proof_confirmed_at: yes ? nowIso() : null, proof_confirmed_by: yes ? actor : null });
      await audit({ actor, event: yes ? "proof_confirmed" : "proof_unconfirmed", campaign_id: camp.id });
      return { campaign: u };
    },

    async price_check(_b, actor) {
      const s = await S.getSettings();
      if (mode() === "test") {
        const p = s.print_spectrum === "color" ? 1.06 : 0.97;
        return { price: p, currency: "EUR", estimate: true, vat_rate: s.vat_rate, note: "Estimate from Pingen's published prices (test mode: Pingen was not asked)." };
      }
      const cl = client();
      const r = await cl.price({ print_spectrum: s.print_spectrum, delivery_product: s.delivery_product }, idemKey("p", `${s.print_spectrum}-${s.delivery_product}-${nowIso().slice(0, 13)}`));
      if (!(r.price > 0)) throw new ApiError("pingen_error", "Pingen gave no price.");
      const u = await S.updateSettings({ pingen_price: r.price, pingen_currency: r.currency, pingen_checked_at: nowIso() });
      await audit({ actor, event: "price_checked", detail: { price: r.price, currency: r.currency } });
      return { price: r.price, currency: r.currency, estimate: false, vat_rate: u.vat_rate };
    },

    async pingen_check(_b, actor) {
      const cl = client();
      const o = await cl.organisation();
      const hooks = await cl.listWebhooks();
      const url = webhookUrl();
      const missing = WEBHOOK_CATEGORIES.filter((cat) => !hooks.some((h) => h.category === cat && h.url === url));
      const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
      const st = await S.updateSettings({ pingen_retention_addresses: num(o.data_retention_addresses), pingen_retention_pdf: num(o.data_retention_pdf), pingen_retention_checked_at: nowIso(), pingen_retention_env: cl.env });
      await audit({ actor, event: "pingen_checked_account", detail: { env: cl.env, data_retention_addresses: o.data_retention_addresses ?? null, data_retention_pdf: o.data_retention_pdf ?? null } });
      return {
        env: cl.env,
        retention: retentionState(st),
        organisation: {
          name: o.name, status: o.status, billing_currency: o.billing_currency, billing_balance: o.billing_balance, missing_credits: o.missing_credits,
          default_address_position: o.default_address_position, data_retention_addresses: o.data_retention_addresses, data_retention_pdf: o.data_retention_pdf,
        },
        webhooks: { url, existing: hooks.map((h) => ({ category: h.category, ours: h.url === url })), missing },
      };
    },

    // Review fix (17 Nov, UX M3): the Post page shows the Pingen credit next
    // to what the post costs.
    async pingen_balance() {
      const cl = client();
      const o = await cl.organisation();
      return { env: cl.env, billing_mode: o.billing_mode ?? null, billing_currency: o.billing_currency ?? null, billing_balance: o.billing_balance ?? null, missing_credits: o.missing_credits ?? null };
    },

    async pingen_webhooks_sync(b, actor) {
      if (mode() === "test") throw new ApiError("test_mode", TEST_MODE_MSG);
      await requirePasscode(b.passcode, actor);
      const secret = E("LETTERS_WEBHOOK_SECRET");
      if (secret.length < 20 || secret.length > 32) throw new ApiError("webhook_secret_missing", "LETTERS_WEBHOOK_SECRET must be set (20 to 32 characters).");
      const cl = client();
      const url = webhookUrl();
      const hooks = await cl.listWebhooks();
      const created: string[] = [];
      for (const cat of WEBHOOK_CATEGORIES) {
        if (hooks.some((h) => h.category === cat && h.url === url)) continue;
        await cl.createWebhook(cat, url, secret, idemKey("w", `${cl.env}-${cat}`));
        created.push(cat);
      }
      await audit({ actor, event: "webhooks_synced", detail: { env: cl.env, created } });
      return { created };
    },

    async campaign_send(b, actor) {
      const m = mode();
      // 1. mode
      if (m === "test") throw new ApiError("test_mode", TEST_MODE_MSG);
      // 2. passcode
      await requirePasscode(b.passcode, actor, String(b.campaign_id ?? ""));
      // 3. Pingen keys
      if (!pingenConfigured()) throw new ApiError("pingen_not_configured", "PINGEN_CLIENT_ID, PINGEN_CLIENT_SECRET and PINGEN_ORGANISATION_ID must be set.");
      // 4. settings
      const settings = await S.getSettings();
      const miss = settingsMissing(settings);
      if (miss.length) throw new ApiError("settings_incomplete", miss.join(" "));
      // 5. BAJA routing (live)
      if (m === "live" && !settings.optout_route_confirmed_at) throw new ApiError("optout_route_not_confirmed", "BAJA routing is not confirmed in Settings. Letters invite studios to write BAJA, so that must work before anything is posted.");
      // 6. sign key
      if (!E("MC_SIGN_KEY")) throw new ApiError("sign_key_missing", "MC_SIGN_KEY is not set as an Edge Function secret.");
      // Review fixes (17 Nov): in live, the privacy page passed its check and
      // Pingen keeps nothing longer than the letter promises (12 months).
      if (m === "live" && !privacyChecked(settings)) throw new ApiError("privacy_not_checked", "The privacy page has not passed its check. Press Check the privacy page in Settings.");
      if (m === "live" && !retentionState(settings).ok) throw new ApiError("retention_not_checked", retentionState(settings).message);
      const camp = await getCampaign(b.campaign_id);
      if (camp.status !== "open") throw new ApiError("wrong_state", "This campaign is closed. Reopen it to post its letters.");
      const cl = client();
      if (camp.pingen_env && camp.pingen_env !== cl.env) throw new ApiError("env_mismatch", `This campaign is on Pingen ${camp.pingen_env}; LETTERS_MODE points at ${cl.env}.`);
      // 7. caps
      const ids = strIds(b.letter_ids, 200);
      if (!ids.length) throw new ApiError("bad_request", "Choose the letters to post.");
      const cap = Math.min(settings.max_per_send, 20);
      if (ids.length > cap) throw new ApiError("over_cap", `At most ${cap} letters per send.`);
      const today = await S.countSubmittedSince(madridDayStart(ctx.now()).toISOString());
      if (today + ids.length > settings.daily_cap) throw new ApiError("over_cap", `Today's cap is ${settings.daily_cap} letters and ${today} were posted already.`);
      // 9 to 11, per letter, before anything moves
      const letters = await S.listLetters({ ids });
      const c = await loadCtx(letters.map((l) => l.recipient_id), settings);
      const passing: Letter[] = [];
      const refused: { letter_id: string; ref_code: string; reason: string }[] = [];
      for (const id of ids) {
        const l = letters.find((x) => x.id === id);
        if (!l) { refused.push({ letter_id: id, ref_code: "", reason: "No such letter." }); continue; }
        let reason = await letterChecks(l, camp, c, "ready");
        if (!reason) reason = proofGate(m, camp, c, l);
        if (!reason) {
          try {
            const g = await cl.getLetter(l.pingen_letter_id!);
            if (g.attrs.status !== "valid") reason = `Pingen status is ${g.attrs.status}, not valid.`;
          } catch (e) { reason = `Could not read it from Pingen: ${(e as Error).message}`; }
        }
        if (reason) refused.push({ letter_id: l.id, ref_code: l.ref_code, reason });
        else passing.push(l);
      }
      // 8. the numbers Jordan confirmed must be the server's numbers
      const est = costEstimate(passing.map((l) => unitPrice(l, settings)), settings.vat_rate);
      if (Number(b.confirm_count) !== passing.length || toCents(Number(b.confirm_total)) !== est.net_cents) {
        throw new ApiError("numbers_changed", `The numbers changed: ${passing.length} letters can be posted for ${fmtEur(est.net_cents)} EUR + IVA. Check and confirm again.`, { confirm_count: passing.length, confirm_total: fmtEur(est.net_cents), refused, estimate: est });
      }
      if (!passing.length) throw new ApiError("validation_failed", "None of these letters can be posted.", { refused });
      // Review fix (17 Nov, UX M3): Pingen is prepaid. With too little credit
      // the letters would wait at "awaiting credits" and go out whenever
      // credit is bought, so in live a short balance stops the post.
      if (m === "live") {
        const o = await cl.organisation();
        const bal = Number(o.billing_balance);
        if (String(o.billing_mode || "prepaid") === "prepaid" && String(o.billing_currency || "EUR") === "EUR" && Number.isFinite(bal) && toCents(bal) < est.net_cents) {
          throw new ApiError("insufficient_credits", `Pingen credit is ${fmtEur(toCents(bal))} EUR and this post costs ${fmtEur(est.net_cents)} EUR before IVA. Buy Pingen credit first, or post fewer letters.`, { billing_balance: bal, net_cents: est.net_cents });
        }
      }
      await audit({ actor, event: "send_started", campaign_id: camp.id, detail: { count: passing.length, net_cents: est.net_cents, mode: m } });
      const outcomes: { letter_id: string; ref_code: string; status: string; message: string }[] = refused.map((r) => ({ letter_id: r.letter_id, ref_code: r.ref_code, status: "refused", message: r.reason }));
      for (const l0 of passing) {
        // 12. claim
        const claimed = await S.updateLetter(l0.id, { status: "sending" }, "ready");
        if (!claimed) { outcomes.push({ letter_id: l0.id, ref_code: l0.ref_code, status: "skipped", message: "Already being posted." }); continue; }
        await audit({ actor, event: "send_claimed", campaign_id: camp.id, letter_id: l0.id, from: "ready", to: "sending" });
        // 13. send
        try {
          const r = await cl.sendLetter(claimed.pingen_letter_id!, { delivery_product: settings.delivery_product, print_spectrum: settings.print_spectrum }, idemKey("s", claimed.id, claimed.approved_sha256!));
          const ps = String(((r.json?.data as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined)?.status || "submitted");
          const u = await move(claimed, "submitted", { submitted_at: nowIso(), submitted_by: actor, pingen_status: ps, last_error: null }, actor, "posted", { request_id: r.requestId, pingen_status: ps });
          outcomes.push({ letter_id: u.id, ref_code: u.ref_code, status: "submitted", message: ps === "awaiting_credits" ? "Posted, but Pingen is waiting for credits: buy Pingen credits." : "Posted." });
        } catch (e) {
          const msg = (e as Error).message;
          let posted = false;
          try { const g = await cl.getLetter(claimed.pingen_letter_id!); posted = PINGEN_POSTED.includes(String(g.attrs.status)); } catch { posted = false; }
          if (posted) {
            const u = await move(claimed, "submitted", { submitted_at: nowIso(), submitted_by: actor, last_error: null }, actor, "posted", { recovered_after: msg });
            outcomes.push({ letter_id: u.id, ref_code: u.ref_code, status: "submitted", message: "Posted." });
          } else {
            const definite = e instanceof PingenError && e.status >= 400 && e.status < 500;
            const u = await move(claimed, "error", { last_error: definite ? `Pingen refused to post it: ${msg}` : "Send outcome unknown. Refresh from Pingen before trying again." }, actor, "send_failed", { message: msg, request_id: e instanceof PingenError ? e.requestId : undefined });
            outcomes.push({ letter_id: u.id, ref_code: u.ref_code, status: "error", message: String(u.last_error) });
          }
        }
      }
      return { outcomes, posted: outcomes.filter((o) => o.status === "submitted").length };
    },

    async letter_cancel(b, actor) {
      const l = await getLetter(b.letter_id);
      await requirePasscode(b.passcode, actor, l.campaign_id);
      if (l.status !== "submitted" || !l.pingen_letter_id) throw new ApiError("wrong_state", `The letter is ${l.status}; only posted letters still in Pingen's queue can be cancelled.`);
      const cl = client();
      if (l.pingen_env !== cl.env) throw new ApiError("env_mismatch", `This letter is on Pingen ${l.pingen_env}; LETTERS_MODE points at ${cl.env}.`);
      const g = await cl.getLetter(l.pingen_letter_id);
      if (g.abilities.cancel !== "ok") throw new ApiError("wrong_state", `Pingen can no longer cancel this letter (it is ${g.attrs.status}).`);
      const r = await cl.cancelLetter(l.pingen_letter_id, idemKey("x", l.id));
      await S.updateLetter(l.id, { pingen_status: "cancelling" }, "submitted");
      await audit({ actor, event: "cancel_requested", campaign_id: l.campaign_id, letter_id: l.id, detail: { request_id: r.requestId } });
      return { letter_id: l.id, pingen_status: "cancelling", message: "Cancellation requested. Pingen refunds the credit once it is cancelled." };
    },

    async optout_mark(b, actor) {
      return await markOptout(b, actor);
    },

    // Review fix (17 Nov): each BAJA with its studio's name, what it stopped,
    // and the letters still to withdraw (a WhatsApp BAJA is recorded by the
    // bot, which cannot reach Pingen; "Withdraw" here finishes the job).
    async optouts_list() {
      const rows = await S.listOptouts(200);
      const pids = uniq(rows.map((o) => o.partner_id).filter((x): x is string => !!x));
      const partners = new Map((pids.length ? await S.getPartners(pids) : []).map((p) => [p.id, p]));
      const open = pids.length ? (await S.listLetters({ partner_ids: pids })).filter((l) => [...EDITABLE, ...IN_PINGEN].includes(l.status)) : [];
      return {
        optouts: rows.map((o) => {
          const p = o.partner_id ? partners.get(o.partner_id) : null;
          return { ...o, partner_name: p?.business_name ?? null, partner_status: p?.status ?? null, partner_opted_out_at: p?.opted_out_at ?? null, letters_to_withdraw: o.partner_id && !o.undone_at && !o.test ? open.filter((l) => l.partner_id === o.partner_id).length : 0 };
        }),
      };
    },

    async optout_match(b, actor) {
      const o = await S.getOptout(reqId(b.optout_id, "optout_id"));
      if (!o) throw new ApiError("not_found", "No such BAJA message.");
      if (o.test) throw new ApiError("validation_failed", "This was a test BAJA from one of your test numbers: it is never matched to a studio.");
      if (o.undone_at) throw new ApiError("wrong_state", "This BAJA was undone.");
      const res = await markOptout({ partner_id: b.partner_id ?? o.partner_id, channel: o.channel, from_ref: o.from_ref, message: o.message, ref_code: o.ref_code, existing_optout_id: o.id, scope: b.scope, confirm_full: b.confirm_full }, actor);
      return res;
    },

    // Review fix (17 Nov, security M1): a BAJA can be undone (a wrong match,
    // or a studio that changed its mind in writing). partners.opted_out_at
    // goes back to what it was, only if nobody changed it since.
    async optout_undo(b, actor) {
      const o = await S.getOptout(reqId(b.optout_id, "optout_id"));
      if (!o) throw new ApiError("not_found", "No such BAJA message.");
      if (o.undone_at) throw new ApiError("wrong_state", "Already undone.");
      if (!o.partner_id) throw new ApiError("wrong_state", "This BAJA is not matched to a studio, so there is nothing to undo.");
      if (squash(nfc(b.reason)).length < 3) throw new ApiError("bad_request", "Say why (a few words).");
      let restored = false;
      if (o.opted_out_set_at) restored = await S.restorePartnerOptedOut(o.partner_id, o.prev_opted_out_at ?? null, o.opted_out_set_at);
      await S.updateOptout(o.id, { undone_at: nowIso(), undone_by: actor });
      await audit({ actor, event: "optout_undone", detail: { optout_id: o.id, partner_id: o.partner_id, restored_opted_out_at: restored ? o.prev_opted_out_at ?? null : undefined, reason: squash(nfc(b.reason)).slice(0, 200) } });
      return { optout_id: o.id, partner_id: o.partner_id, opted_out_restored: restored, note: o.opted_out_set_at && !restored ? "The studio's opt-out date was changed by something else since, so it was left as it is." : "" };
    },

    async audit_list(b) {
      const limit = Math.min(500, Math.max(1, Number(b.limit) || 200));
      const events = await S.listEvents({ campaign_id: b.campaign_id ? reqId(b.campaign_id, "campaign_id") : undefined, letter_id: b.letter_id ? reqId(b.letter_id, "letter_id") : undefined, limit });
      return { events };
    },

    async stats(b) {
      const camp = await getCampaign(b.campaign_id);
      const letters = (await S.listLetters({ campaign_id: camp.id })).filter((l) => l.sent_at || l.submitted_at);
      const pids = uniq(letters.map((l) => l.partner_id).filter((x): x is string => !!x));
      const since = letters.map((l) => String(l.submitted_at || l.sent_at)).sort()[0] || nowIso();
      const fun = pids.length ? await S.funnelStats(pids, since) : [];
      const optouts = (await S.listOptouts(1000)).filter((o) => o.partner_id && pids.includes(o.partner_id));
      return {
        letters: letters.map((l) => {
          const f = fun.find((x) => x.partner_id === l.partner_id);
          return { letter_id: l.id, ref_code: l.ref_code, status: l.status, submitted_at: l.submitted_at, sent_at: l.sent_at, link_opened: f?.opened ?? 0, signed_up: f?.signed_up ?? 0, baja: optouts.some((o) => o.partner_id === l.partner_id) };
        }),
      };
    },

    // Review fix (17 Nov, security M3): the 12-month promise, kept. The same
    // SQL function runs every day from pg_cron; this runs it now and deletes
    // the queued PDFs from Storage.
    async retention_purge(_b, actor) {
      const r = await S.purgeExpired();
      const deleted = await drainPdfDeletions(200);
      await audit({ actor, event: "retention_purged", detail: { ...r, pdfs_deleted: deleted } });
      return { ...r, pdfs_deleted: deleted };
    },
    async purge_old_pdfs(b, actor) {
      return await OPS.retention_purge(b, actor);
    },
  };

  async function drainPdfDeletions(n: number): Promise<number> {
    let done = 0;
    for (const path of await S.pdfDeletions(n)) {
      await S.deletePdf(path);
      await S.pdfDeleted(path);
      done++;
    }
    return done;
  }

  async function approveCheck(l0: Letter, camp: Campaign, c: LCtx, sha: string, ack: boolean, actor: string): Promise<{ ok: true; letter: Letter; warnings: number } | { ok: false; code: string; message: string; extra?: Record<string, unknown> }> {
    if (l0.status !== "review") return { ok: false, code: "wrong_state", message: `The letter is ${l0.status}; only letters waiting for review can be approved.` };
    const l = await ensureRendered(l0, camp, c, actor);
    if (!l.pdf_sha256) return { ok: false, code: "validation_failed", message: `This letter could not be rendered: ${l.status_reason || "unknown problem"}.` };
    if (!/^[0-9a-f]{64}$/.test(sha) || sha !== l.pdf_sha256 || l.previewed_sha256 !== l.pdf_sha256) return { ok: false, code: "stale", message: "This letter changed since you looked at it. Look at it again, then approve." };
    const lay = (l.layout || {}) as Record<string, unknown>;
    if (Number(lay.placeholders ?? 0) > 0) return { ok: false, code: "validation_failed", message: `The letter still has red placeholders (${(lay.placeholder_texts as string[] | undefined)?.join(", ") || "missing settings"}). Fill in Settings first.` };
    const tc = validateTemplate(camp.template);
    if (!tc.ok) return { ok: false, code: "validation_failed", message: `The letter text cannot be approved yet: ${tc.errors.map((e) => e.message).join(" ")}`, extra: { errors: tc.errors } };
    const e = elig(c, l.recipient_id, l);
    if (!e.eligible) return { ok: false, code: "validation_failed", message: e.reasons.map((x) => x.text).join(" "), extra: { reasons: e.reasons } };
    if (e.warnings.length && !ack) return { ok: false, code: "validation_failed", message: `Tick the warnings first: ${e.warnings.map((w) => w.text).join(" ")}`, extra: { warnings: e.warnings } };
    return { ok: true, letter: l, warnings: e.warnings.length };
  }

  // Review fix (17 Nov, security M1): a BAJA stops letters only to studios we
  // wrote to, or could write to (a mailing-list row or a letter). For an
  // active partner the letter's "no more letters" is a letters-only objection:
  // recorded in letter_optouts, which eligibility and the guard read, and
  // partners.opted_out_at (which stops bookings and their links) is left
  // alone unless Jordan explicitly confirms a full opt-out. Whatever was set
  // is stored on the row so optout_undo can put it back.
  async function markOptout(b: Record<string, unknown>, actor: string): Promise<Record<string, unknown>> {
    const pid = reqId(b.partner_id, "partner_id");
    const channel = String(b.channel ?? "manual");
    if (!["whatsapp", "email", "phone", "post", "manual"].includes(channel)) throw new ApiError("bad_request", "channel: whatsapp, email, phone, post or manual.");
    const [p] = await S.getPartners([pid]);
    if (!p) throw new ApiError("not_found", "No such studio.");
    const recs = await S.recipientsForPartners([pid]);
    const theirLetters = await S.listLetters({ partner_ids: [pid] });
    if (!recs.length && !theirLetters.length) throw new ApiError("validation_failed", "This studio is not on the mailing list and has had no letter, so there is no letter to stop. Use the outreach tools for anything else.");
    const active = p.status === "active";
    let scope: "letters" | "all" = active ? "letters" : "all";
    if (b.scope === "letters") scope = "letters";
    if (b.scope === "all" && active) {
      if (b.confirm_full !== true) throw new ApiError("validation_failed", "This studio is an active partner. A letter BAJA stops letters only; stopping every contact (and its bookings) needs your explicit confirmation.");
      scope = "all";
    }
    const at = nowIso();
    let prev: string | null = p.opted_out_at ?? null, setAt: string | null = null;
    if (scope === "all") {
      const r = await S.setPartnerOptedOut(pid, at);
      prev = r.previous;
      if (r.changed) setAt = at;
    }
    const fields = { partner_id: pid, matched_by: actor, matched_at: at, scope, prev_opted_out_at: setAt ? prev : null, opted_out_set_at: setAt };
    let optoutId = "";
    if (b.existing_optout_id) { optoutId = String(b.existing_optout_id); await S.updateOptout(optoutId, fields); }
    else optoutId = (await S.insertOptout({ channel: channel as "manual", from_ref: b.from_ref ? String(b.from_ref).slice(0, 80) : null, message: b.message ? String(b.message).slice(0, 1000) : null, message_en: b.message_en ? String(b.message_en).slice(0, 1000) : null, ref_code: b.ref_code ? String(b.ref_code).toUpperCase().slice(0, 6) : null, test: false, undone_at: null, undone_by: null, ...fields } as Omit<Optout, "id" | "created_at">)).id;
    await audit({ actor, event: "optout_marked", detail: { partner_id: pid, channel, scope, optout_id: optoutId, opted_out_at_set: setAt } });
    const w = await withdrawFor(pid, actor);
    // Keep only what is needed not to write again (blank addresses, delete
    // the PDFs of letters that will never go).
    const purged = await S.purgeExpired().catch(() => null);
    await drainPdfDeletions(20).catch(() => 0);
    return { partner_id: pid, optout_id: optoutId, scope, opted_out_at: scope === "all" ? (setAt ?? prev) : null, withdrawn: w.withdrawn, notes: w.notes, minimised: purged };
  }

  async function withdrawFor(pid: string, actor: string): Promise<{ withdrawn: string[]; notes: string[] }> {
    const withdrawn: string[] = [];
    const notes: string[] = [];
    for (const l of await S.listLetters({ partner_ids: [pid] })) {
      if (["withdrawn", "sent", "delivered", "undeliverable", "unprintable", "cancelled"].includes(l.status)) continue;
      if (["sending", "submitted"].includes(l.status)) { notes.push(`Letter ${l.ref_code} is already posted: cancel it if Pingen still can.`); continue; }
      if (["uploading", "error"].includes(l.status)) { notes.push(`Letter ${l.ref_code} is ${l.status}: refresh from Pingen, then remove it.`); continue; }
      if (l.pingen_letter_id) {
        try {
          const cl = client();
          if (l.pingen_env === cl.env) await cl.deleteLetter(l.pingen_letter_id);
          else { notes.push(`Letter ${l.ref_code} is on Pingen ${l.pingen_env}: remove it there.`); continue; }
        } catch (e) { notes.push(`Letter ${l.ref_code} could not be removed from Pingen: ${(e as Error).message}`); continue; }
      }
      await move(l, "withdrawn", { status_reason: "Studio asked not to be contacted (BAJA)." }, actor, "withdrawn", { reason: "baja" });
      withdrawn.push(l.id);
    }
    return { withdrawn, notes };
  }

  // ------------------------------------------------------------------------
  // Pingen webhook (no user, no CORS; signature over the raw body)
  // ------------------------------------------------------------------------
  async function webhook(req: Request): Promise<Response> {
    const out = (status: number, message: string) => new Response(JSON.stringify({ ok: status === 200, message }), { status, headers: { "Content-Type": "application/json" } });
    if (req.method !== "POST") return out(405, "POST only");
    const secret = E("LETTERS_WEBHOOK_SECRET");
    // Review fix (17 Nov, L3): Pingen takes 20 to 32 characters; anything
    // else is a misconfiguration, so nothing is accepted.
    if (secret.length < 20 || secret.length > 32) return out(503, "not configured");
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.length > 65536) return out(413, "too large");
    if (!(await verifySignature(raw, req.headers.get("signature"), secret))) {
      log("[letters] webhook with a bad signature");
      return out(401, "bad signature");
    }
    let json: unknown;
    try { json = JSON.parse(new TextDecoder().decode(raw)); } catch { await audit({ actor: "pingen", event: "webhook_unparsed", detail: { why: "not JSON" } }); return out(200, "ignored"); }
    const p = parseWebhook(json);
    if (!p.ok) { await audit({ actor: "pingen", event: "webhook_unparsed", detail: { why: p.error } }); return out(200, "ignored"); }
    const ev = p.event;
    const letter = await S.findLetterByPingenId(ev.letterId);
    const plan = planWebhook(ev, letter, E("PINGEN_ORGANISATION_ID"), nowIso());
    const detail = { category: ev.category, reason: ev.reason || undefined, created_at: ev.createdAt, delivery_id: ev.deliveryId, pingen_letter_id: ev.letterId };
    if (plan.kind === "ignore") { await audit({ actor: "pingen", event: plan.event, detail }); return out(200, "ignored"); }
    // The event id is the dedupe key: a replay is recorded once and applied once.
    const fresh = await audit({ actor: "pingen", event: plan.event, campaign_id: letter?.campaign_id ?? null, letter_id: letter?.id ?? null, from: letter?.status ?? null, to: plan.steps[plan.steps.length - 1] ?? null, detail, pingen_event_id: ev.eventId });
    if (!fresh) return out(200, "duplicate");
    if (!letter || plan.kind === "unknown_letter") return out(200, "unknown letter");
    try {
      let cur = letter;
      for (let i = 0; i < plan.steps.length; i++) cur = await move(cur, plan.steps[i], i === 0 ? plan.patch as Partial<Letter> : {}, "pingen", "status_change", { via: "webhook", category: ev.category });
      if (plan.kind === "record" && Object.keys(plan.patch).length) await S.updateLetter(cur.id, plan.patch as Partial<Letter>);
      if (plan.recipientReview) await S.updateRecipient(cur.recipient_id, { needs_review: plan.recipientReview });
      if (plan.revokeLink) await revokeLink(cur, "pingen");
    } catch (e) {
      // Pingen would not retry a recorded event, so record the failure;
      // "Refresh from Pingen" reconciles the letter.
      await audit({ actor: "pingen", event: "webhook_apply_failed", campaign_id: letter.campaign_id, letter_id: letter.id, detail: { message: (e as Error).message, category: ev.category } });
    }
    return out(200, "ok");
  }

  // ------------------------------------------------------------------------
  // Transport
  // ------------------------------------------------------------------------
  async function authenticate(req: Request): Promise<{ email: string; userId: string }> {
    const ipKey = `ip:${await ipHash(clientIp(req.headers))}`;
    if ((await S.ratePeek(ipKey, "unauth", 600)) >= 60) throw new ApiError("rate_limited", "Too many failed sign-ins from here. Wait 10 minutes.");
    const token = bearerToken(req.headers);
    const r = await verifyUser(token, {
      supabaseUrl: E("SUPABASE_URL"), serviceKey: E("SUPABASE_SERVICE_ROLE_KEY"), admins: parseAdminIds(ctx.env("LETTERS_ADMIN_USER_IDS")),
      fetch: ctx.fetch as unknown as (url: string, init: RequestInit) => Promise<Response>, now: () => ctx.now().getTime(), cache: ctx.authCache,
    });
    if (!r.ok) {
      const extra = r.userId ? { user_id: r.userId } : {};
      if (r.status === 503) throw new ApiError(r.code === "admins_not_set" ? "admins_not_set" : "not_configured", r.message, extra);
      await S.rateHit(ipKey, "unauth", 600, 60);
      throw new ApiError(r.code, r.message, extra);
    }
    if (!(await S.rateHit(r.email, "ops", 600, 600))) throw new ApiError("rate_limited", "Too many requests. Wait a few minutes.");
    return { email: r.email, userId: r.userId };
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.searchParams.get("pingen_webhook") === "1") {
      try { return await webhook(req); } catch (e) {
        log("[letters] webhook failed", { message: String((e as Error)?.message || e) });
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }
    const cors = corsHeaders(req.headers.get("origin"));
    const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
    if (req.method === "OPTIONS") return new Response(null, { status: cors["Access-Control-Allow-Origin"] ? 204 : 403, headers: cors });
    if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed", message: "POST only." });
    let op = "";
    try {
      const who = await authenticate(req);
      const actor = who.email;
      const raw = await req.text();
      if (raw.length > 3_000_000) throw new ApiError("bad_request", "The request is too big.");
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { throw new ApiError("bad_request", "The request is not JSON."); }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("bad_request", "The request is not a JSON object.");
      op = String(body.op ?? "");
      const fn = Object.prototype.hasOwnProperty.call(OPS, op) ? OPS[op] : null;
      if (!fn) throw new ApiError("bad_request", `Unknown op "${op.slice(0, 40)}".`);
      const res = await fn(body, actor, who.userId);
      // Queued PDF deletions (retention) are done a few at a time on any call.
      await drainPdfDeletions(5).catch((e) => log("[letters] pdf deletion failed", { message: String((e as Error)?.message || e) }));
      return json(200, { ok: true, ...res });
    } catch (e) {
      if (e instanceof ApiError) return json(e.status, { ok: false, error: e.code, message: e.message, ...e.extra });
      if (e instanceof PingenError) {
        if (e.code === "test_mode") return json(409, { ok: false, error: "test_mode", message: TEST_MODE_MSG });
        if (e.code === "pingen_not_configured") return json(412, { ok: false, error: "pingen_not_configured", message: e.message });
        return json(502, { ok: false, error: "pingen_error", message: e.message, pingen_status: e.status, request_id: e.requestId });
      }
      log("[letters] op failed", { op, message: String((e as Error)?.message || e) });
      return json(500, { ok: false, error: "server_error", message: "Something went wrong on the server. Nothing was posted." });
    }
  };
}
