// Letters: template, fee guard, address, CSV, eligibility, state machine,
// cost maths and reference codes (supabase/functions/letters/rules.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateTemplate, feeGuard, tagProblems, mergeRuns, runsText, validateAddressLines, parseCsv, parseListCsv, eligibility,
  canTransition, TRANSITIONS, STATUSES, costEstimate, refCode, refCodes, REF_RE, REF_ALPHABET, validateSettingsPatch, settingsMissing,
  DEFAULT_SETTINGS, tagValues, greetingLooksLikePerson, isHispapostPostcode, madridDayStart, canonicalJson, markStale, greetingProblems, EN_DASH, EM_DASH,
} from "../../supabase/functions/letters/rules.ts";
import { defaultTemplate, useApprovedFeeWording, FEE_SENTENCES, DRAFT_FEE_SENTENCE } from "../../supabase/functions/letters/templates.ts";
import { CSV_HEADER, P1 } from "./_helpers.mjs";
import fs from "node:fs";

const approved = () => useApprovedFeeWording(defaultTemplate());
const codes = (r) => r.errors.map((e) => e.code);

test("template: the approved wording passes, Jordan's draft fee sentence is flagged", () => {
  const ok = validateTemplate(approved());
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.fee_version, "2026-10-19");
  const draft = validateTemplate(defaultTemplate());
  assert.equal(draft.ok, false);
  // Review fix (UX M6): one fee problem is one line, not five ("€", "Sin
  // coste", the year and the month each again).
  assert.deepEqual(codes(draft), ["fee_sentence"]);
  // A stray money word next to the draft sentence still shows on its own.
  const extra = defaultTemplate();
  extra.body_es = extra.body_es.replace("Nosotros les buscamos centro.", "Nosotros les buscamos centro. Os cobramos poco.");
  assert.deepEqual(codes(validateTemplate(extra)), ["fee_sentence", "fee_word"]);
});

test("fee guard (review M4): word stems, figures, and the settings printed on every letter", () => {
  const base = approved().body_es;
  const add = (x) => base.replace("Nosotros les buscamos centro.", `Nosotros les buscamos centro. ${x}`);
  for (const x of ["Os cobramos 5 por visita.", "El primer mes no cuesta nada.", "Luego, una pequeña cantidad mensual.", "Sin cargo.", "Os facturamos al final.", "Pagáis solo si funciona.",
    "El precio es bajo.", "Una suscripción anual.", "Es gratuitamente.", "Ganaréis dinero.", "Desde 3 visitas, nada.", "Os sale a 4,50 la visita."]) {
    assert.equal(feeGuard(add(x)).ok, false, x);
  }
  // Not money: times, the phone, the price bullet, and look-alike words.
  for (const x of ["Os escribimos en 2 días.", "Es una cuestión de minutos.", "Lo veis en la página.", "Estamos en la costa."]) {
    assert.deepEqual(feeGuard(add(x)).errors, [], x);
  }
  assert.deepEqual(validateTemplate(approved()).errors, [], "the approved letter: 2 o 3 horas, 15 minutos, 2 minutos, +34 612 474 827, art. 6.1.f, 12 meses");
  const t = approved();
  t.optout_es = t.optout_es.replace("Es gratis", "Os cuesta 0. Es gratis");
  assert.ok(codes(validateTemplate(t)).includes("fee_word"));
  const priv = approved();
  priv.privacy_es = priv.privacy_es.replace("12 meses", "24 meses y 3 euros");
  assert.ok(codes(validateTemplate(priv)).includes("fee_word"));
  // Settings are printed too: no money words and no links off massageclub.io.
  for (const [k, v] of [["legal_sender_name", "Remitente S.L., 5 EUR al mes"], ["return_street", "www.otra-web.es, Calle Mayor 1"], ["return_city", "Madrid otra-web.com"], ["return_name", "Escribid a info@gmail.com"]]) {
    const r = validateSettingsPatch({ [k]: v });
    assert.equal(r.ok, false, `${k}: ${v}`);
  }
  // Street names keep numbers, months and saints.
  assert.equal(validateSettingsPatch({ return_street: "Calle Dos de Mayo 5, 2º B", return_city: "San Sebastián de los Reyes", legal_sender_name: "Remitente Ejemplo S.L." }).ok, true);
  // Registered letters are not for marketing letters (review L15).
  assert.equal(validateSettingsPatch({ delivery_product: "registered" }).ok, false);
});

test("links (review M4): bare domains, www and emails off massageclub.io are refused; aepd.es is the regulator", () => {
  const t = approved();
  for (const x of ["Más en www.otra-web.es", "Visitad otra-web.com", "Escribid a hola@otraweb.es", "https://bit.ly/x"]) {
    const c = { ...t, body_es: t.body_es.replace("Nosotros les buscamos centro.", `Nosotros les buscamos centro. ${x}.`) };
    assert.ok(codes(validateTemplate(c)).includes("link_host"), x);
  }
  for (const x of ["Más en book.massageclub.io.", "Escribid a hola@massageclub.io."]) {
    const c = { ...t, body_es: t.body_es.replace("Nosotros les buscamos centro.", `Nosotros les buscamos centro. ${x}`) };
    assert.ok(!codes(validateTemplate(c)).includes("link_host"), x);
  }
  assert.ok(approved().privacy_es.includes("aepd.es"));
});

test("dashes (review L9): figure dash, quotation dash, minus sign and two- and three-em dashes too", () => {
  for (const cp of [0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0x2e3a, 0x2e3b]) {
    const t = approved();
    t.body_es = t.body_es.replace("Nos gustaría", `Nos gustaría ${String.fromCharCode(cp)} mucho`);
    assert.ok(codes(validateTemplate(t)).includes("dash"), cp.toString(16));
  }
});

test("template: the default is Jordan's draft verbatim and the swap changes only the fee sentence", () => {
  const d = defaultTemplate();
  assert.ok(d.body_es.startsWith("Hola, equipo de {{nombre}}:\n\nSoy Jordan, de Massage Club."));
  assert.ok(d.body_es.includes(DRAFT_FEE_SENTENCE.es));
  assert.ok(d.body_es.endsWith("Un saludo,\nJordan, de Massage Club"));
  const a = approved();
  assert.equal(a.body_es.replace(FEE_SENTENCES["2026-10-19"].es, "X"), d.body_es.replace(DRAFT_FEE_SENTENCE.es, "X"));
  assert.ok(a.body_en.includes(FEE_SENTENCES["2026-10-19"].en));
});

test("template: allowed tags, unknown tag, leftover braces", () => {
  assert.deepEqual(tagProblems("body_es", "Hola {{nombre}}", ["nombre"]), []);
  assert.equal(tagProblems("body_es", "Hola {{apellido}}", ["nombre"])[0].code, "unknown_tag");
  assert.equal(tagProblems("body_es", "Hola {{nombre}", ["nombre"])[0].code, "stray_braces");
  assert.equal(tagProblems("body_es", "Hola }} {{nombre}}", ["nombre"])[0].code, "stray_braces");
  const t = approved();
  t.body_es = t.body_es.replace("{{nombre}}", "{{email}}");
  assert.ok(codes(validateTemplate(t)).includes("unknown_tag"));
  const p = approved();
  p.privacy_es += " {{nombre}}";
  assert.ok(codes(validateTemplate(p)).includes("unknown_tag"));
});

test("template: en dash and em dash are rejected, never rewritten", () => {
  for (const d of [EN_DASH, EM_DASH]) {
    const t = approved();
    t.body_es = t.body_es.replace("Nos gustaría", `Nos gustaría ${d} mucho`);
    const r = validateTemplate(t);
    assert.ok(codes(r).includes("dash"));
    assert.ok(t.body_es.includes(d));
  }
  assert.ok(greetingProblems(`Estudio ${EM_DASH} Alfa`).some((p) => p.code === "dash"));
});

test("fee guard: extras outside the sentence are rejected", () => {
  const fee = FEE_SENTENCES["2026-10-19"].es;
  const base = approved().body_es;
  const cases = [
    ["10%", base.replace("Funciona así:", "Funciona así, con un 10% menos:")],
    ["IVA", base.replace("a vuestro precio.", "a vuestro precio con IVA.")],
    ["cuenta bancaria", base.replace("Nosotros les buscamos centro.", "Nosotros les buscamos centro. No hace falta cuenta bancaria.")],
    ["a year", base.replace("Nosotros les buscamos centro.", "Nosotros les buscamos centro desde 2025.")],
    ["a month", base.replace("Nosotros les buscamos centro.", "Nosotros les buscamos centro desde marzo.")],
    ["€", base.replace("a vuestro precio.", "a vuestro precio en €.")],
    ["gratis", base.replace("Nosotros les buscamos centro.", "Nosotros les buscamos centro gratis.")],
  ];
  for (const [what, body] of cases) assert.equal(feeGuard(body).ok, false, what);
  assert.equal(feeGuard(base + "\n" + fee).errors[0].code, "fee_twice");
  // "precio" without a figure is fine ("a vuestro precio"), and the opt-out's
  // "Es gratis" is about writing BAJA.
  assert.equal(feeGuard(base, [{ field: "optout_es", text: approved().optout_es, allowGratis: true }]).ok, true);
  assert.equal(feeGuard(base, [{ field: "privacy_es", text: "Sin cuota." }]).ok, false);
  // Whitespace differences in the sentence do not matter.
  assert.equal(feeGuard(base.replace(fee, fee.replace(/ /g, "  "))).ok, true);
});

test("template: links must be on massageclub.io; sign-off; opt-out and privacy essentials", () => {
  const t = approved();
  t.body_es = t.body_es.replace("Nosotros les buscamos centro.", "Mirad https://example.com/x y bit.io/abc.");
  assert.equal(validateTemplate(t).errors.filter((e) => e.code === "link_host").length, 2);
  const ok = approved();
  ok.body_es = ok.body_es.replace("Nosotros les buscamos centro.", "Mirad https://book.massageclub.io/socios.");
  assert.equal(validateTemplate(ok).ok, true);
  const s = approved();
  s.body_es = s.body_es.replace(/Jordan, de Massage Club$/, "Jordan");
  assert.ok(codes(validateTemplate(s)).includes("sign_off"));
  const o = approved();
  o.optout_es = "¿No queréis más cartas? Escribidnos.";
  assert.ok(codes(validateTemplate(o)).includes("optout_route"));
  const p = approved();
  p.privacy_es = p.privacy_es.replace("{{remitente}}", "Massage Club");
  assert.ok(codes(validateTemplate(p)).includes("privacy_tag"));
});

test("merge: tags become runs; missing settings become placeholders", () => {
  const runs = mergeRuns("Hola, equipo de {{nombre}}:", { nombre: { text: "Estudio Alfa" } }, ["nombre"]);
  assert.equal(runsText(runs), "Hola, equipo de Estudio Alfa:");
  const vals = tagValues(DEFAULT_SETTINGS);
  assert.equal(vals.remitente.missing, true);
  assert.equal(vals.privacidad_url.missing, true);
  assert.equal(vals.email_contacto.text, "support@massageclub.io");
  const company = tagValues({ ...DEFAULT_SETTINGS, sender_type: "company", legal_sender_name: "Ejemplo S.L.", legal_sender_nif: "" });
  assert.equal(company.nif.missing, true);
  const person = tagValues({ ...DEFAULT_SETTINGS, sender_type: "individual", legal_sender_name: "Nombre Apellido", legal_sender_nif: "" });
  assert.equal(person.remitente.text, "Nombre Apellido, que opera como Massage Club");
  assert.equal(person.nif.text, "");
  assert.throws(() => mergeRuns("{{otra}}", {}, ["nombre"]));
});

test("settings: validation and what is still missing", () => {
  assert.equal(validateSettingsPatch({ legal_sender_nif: "B12345674", return_postcode: "28004", privacy_url: "https://massageclub.io/privacy" }).ok, true);
  assert.equal(validateSettingsPatch({ legal_sender_nif: "12345" }).ok, false);
  assert.equal(validateSettingsPatch({ return_postcode: "2804" }).ok, false);
  assert.equal(validateSettingsPatch({ privacy_url: "https://example.com/privacy" }).ok, false);
  assert.equal(validateSettingsPatch({ legal_sender_name: `Ejemplo ${EM_DASH} S.L.` }).ok, false);
  assert.equal(validateSettingsPatch({ optout_route_confirmed_at: "2026-11-17" }).ok, false);
  assert.equal(validateSettingsPatch({ contact_email: "someone@gmail.com" }).ok, false);
  assert.equal(validateSettingsPatch({ cooldown_days: 10 }).ok, false);
  assert.ok(settingsMissing(DEFAULT_SETTINGS).length >= 3);
  assert.deepEqual(settingsMissing({ ...DEFAULT_SETTINGS, sender_type: "individual", legal_sender_name: "N A", return_street: "C 1", return_postcode: "28004", return_city: "Madrid", privacy_url: "https://massageclub.io/p" }), []);
});

test("address: lines, length, characters, punctuation, postcode line, country line", () => {
  const ok = validateAddressLines(["Estudio Alfa", "Calle Ejemplo 1, 2º B", "28004 Madrid"], "28004", "Madrid");
  assert.equal(ok.ok, true);
  const c = (lines, pc = "28004", town = "Madrid") => validateAddressLines(lines, pc, town).errors.map((e) => e.code);
  assert.ok(c(["Estudio Alfa", "28004 Madrid"]).includes("too_few_lines"));
  assert.ok(c(["A", "B", "C", "D", "E", "28004 Madrid"]).includes("too_many_lines"));
  assert.ok(c(["Estudio Alfa con un nombre larguísimo de verdad 123", "Calle 1", "28004 Madrid"]).includes("line_too_long"));
  assert.equal(validateAddressLines(["Estudio Alfa con un nombre bastante largo 1", "Calle 1", "28004 Madrid"], "28004", "Madrid").warnings[0].code, "line_long");
  for (const ch of ["&", "(", "!", "?", "#", "§", '"', "«", EN_DASH, EM_DASH]) assert.ok(c([`Estudio ${ch} Alfa`, "Calle 1", "28004 Madrid"]).includes("forbidden_chars"), ch);
  assert.ok(c(["Estudio Alfa.", "Calle 1", "28004 Madrid"]).includes("trailing_punct"));
  assert.ok(c(["Estudio Alfa", "Calle 1", "28004, Madrid"]).includes("town_line"));
  assert.ok(c(["Estudio Alfa", "Calle 1", "28004 Madrid", "España"]).includes("country_line"));
  assert.ok(c(["Estudio Alfa", "Calle 1", "28005 Madrid"]).includes("town_mismatch"));
  assert.ok(c(["Estudio Alfa", "Calle 1", "ES-28004 Madrid"]).includes("town_line"));
  assert.equal(validateAddressLines(["Estudio Alfa", "Calle 1", "08001 Barcelona"], "08001", "Barcelona").warnings[0].code, "outside_madrid");
});

test("csv: quoted fields, header, row errors with line numbers, proof rows", () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\n1,2,3').rows.map((r) => r.cells), [["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
  assert.ok(parseCsv('a,"b').error);
  const good = [CSV_HEADER, `${P1},Estudio Alfa,Estudio Alfa,"Calle Ejemplo 1, 2º B",28004 Madrid,,,28004,Madrid,unit unknown,medium`, `proof,Prueba,Jordan Ejemplo,Calle Casa 3,28004 Madrid,,,28004,Madrid,,high`].join("\r\n");
  const r = parseListCsv(good);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].kind, "proof");
  assert.ok(r.warnings.some((w) => w.code === "unit_unknown"));
  assert.ok(r.warnings.some((w) => w.code === "medium_confidence"));
  const bad = [CSV_HEADER, `${P1},A,Estudio Alfa,Calle 1,28004 Madrid,,,28004,Madrid,,high`, `${P1},A,Estudio Alfa,Calle 1,28004 Madrid,,,28004,Madrid,,high`, `nope,A,Estudio & Co,Calle 1,28004 Madrid,,,28004,Madrid,,high`].join("\n");
  const rb = parseListCsv(bad);
  assert.equal(rb.ok, false);
  assert.deepEqual(rb.errors.map((e) => [e.line, e.code]), [[3, "duplicate"], [4, "id"]]);
  assert.equal(parseListCsv("id,name\n1,2").errors[0].code, "header");
});

const recip = (o = {}) => ({ id: "r1", kind: "studio", partner_id: "p1", display_name: "Estudio Alfa", greeting_name: "Estudio Alfa", address_lines: ["Estudio Alfa", "Calle 1", "28004 Madrid"], postcode: "28004", town: "Madrid", unit_status: "unit known", confidence: "high", partner_address_at_import: "Calle 1, 28004 Madrid", needs_review: null, active: true, ...o });
const partner = (o = {}) => ({ id: "p1", business_name: "Estudio Alfa", status: "pending", opted_out_at: null, outreach_status: null, address: "Calle 1, 28004 Madrid", ...o });
const el = (o = {}) => eligibility({ recipient: recip(o.r), partner: o.p === null ? null : partner(o.p), letters: o.letters || [], campaignStatus: o.cs || {}, cooldownDays: 180, now: new Date("2026-11-17T10:00:00Z"), selfLetterId: o.self, optouts: o.optouts });

test("eligibility: every reason", () => {
  assert.equal(el().eligible, true);
  const reason = (o) => el(o).reasons.map((r) => r.code);
  assert.deepEqual(eligibility({ recipient: null, partner: null, letters: [], campaignStatus: {}, cooldownDays: 180, now: new Date() }).reasons.map((r) => r.code), ["not_in_list"]);
  assert.deepEqual(reason({ r: { active: false } }), ["not_in_list"]);
  assert.deepEqual(reason({ p: { opted_out_at: "2026-11-01T10:00:00Z" } }), ["opted_out"]);
  assert.ok(el({ p: { opted_out_at: "2026-11-01T10:00:00Z" } }).reasons[0].text.includes("1 Nov 2026"));
  assert.deepEqual(reason({ p: { outreach_status: "opted_out" } }), ["opted_out"]);
  assert.deepEqual(reason({ p: { status: "suspended" } }), ["not_writable"]);
  assert.deepEqual(reason({ p: { status: "archived" } }), ["not_writable"]);
  assert.deepEqual(reason({ p: { status: "active" } }), ["already_partner"]);
  for (const s of ["rejected", "skipped_not_massage", "claimed"]) assert.deepEqual(reason({ p: { outreach_status: s } }), ["outreach_closed"]);
  assert.deepEqual(reason({ p: { business_name: "Centro Test" } }), ["test_studio"]);
  assert.deepEqual(reason({ p: { business_name: "Masajes prueba" } }), ["test_studio"]);
  assert.deepEqual(reason({ letters: [{ id: "l0", campaign_id: "c0", status: "sent", submitted_at: "2026-10-01T10:00:00Z" }] }), ["recently_written"]);
  assert.deepEqual(reason({ letters: [{ id: "l0", campaign_id: "c0", status: "sent", submitted_at: "2026-01-01T10:00:00Z" }] }), []);
  assert.deepEqual(reason({ letters: [{ id: "l0", campaign_id: "c0", status: "approved" }], cs: { c0: "open" } }), ["recently_written"]);
  assert.deepEqual(reason({ letters: [{ id: "l0", campaign_id: "c0", status: "approved" }], cs: { c0: "open" }, self: "l0" }), []);
  assert.deepEqual(reason({ letters: [{ id: "l0", campaign_id: "c0", status: "approved" }], cs: { c0: "closed" } }), []);
  assert.deepEqual(reason({ p: { address: "Calle 2, 28004 Madrid" } }), ["address_changed"]);
  assert.deepEqual(reason({ r: { needs_review: "undeliverable on 2026-12-02" } }), ["needs_review"]);
  assert.deepEqual(reason({ p: null }), ["not_in_list"]);
});

test("eligibility: warnings", () => {
  const w = (o) => el(o).warnings.map((x) => x.code);
  assert.deepEqual(w({ r: { unit_status: "unit unknown" } }), ["unit_unknown"]);
  assert.deepEqual(w({ r: { confidence: "medium" } }), ["medium_confidence"]);
  assert.deepEqual(w({ r: { greeting_name: "Laura Gómez" } }), ["greeting_looks_like_a_person"]);
  // Review fix (UX M4): decided once at import, they are not ticked again.
  assert.deepEqual(w({ r: { unit_status: "unit unknown", confidence: "medium", warnings_acked_at: "2026-11-17T10:00:00Z" } }), []);
  // Each says what to do (UX M5).
  assert.match(el({ r: { unit_status: "unit unknown" } }).warnings[0].text, /street-level shop.*Reject if it is a flat.*import the list again/s);
  // Correos is information, not a tick, and makes no cost claim.
  assert.deepEqual(w({ r: { postcode: "28100" } }), []);
  assert.deepEqual(el({ r: { postcode: "28100" } }).infos.map((x) => x.code), ["postcode_correos"]);
  assert.doesNotMatch(el({ r: { postcode: "28100" } }).infos[0].text, /cost more/);
  // A letters-only BAJA (an active partner's, or any) stops letters.
  assert.deepEqual(el({ optouts: [{ created_at: "2026-11-18T10:00:00Z", scope: "letters" }] }).reasons.map((x) => x.code), ["opted_out_letters"]);
  // Names containing test or prueba (review L8).
  assert.deepEqual(el({ p: { business_name: "Masajes Pruebas" } }).reasons.map((x) => x.code), ["test_studio"]);
  assert.deepEqual(el({ p: { business_name: "Testing Spa" } }).reasons.map((x) => x.code), ["test_studio"]);
  assert.equal(greetingLooksLikePerson("Laura Gómez"), true);
  assert.equal(greetingLooksLikePerson("Centro Laura Gómez"), false);
  assert.equal(greetingLooksLikePerson("Estudio Ficticio Alfa"), false);
  assert.equal(isHispapostPostcode("28055"), true);
  assert.equal(isHispapostPostcode("28056"), false);
  assert.equal(isHispapostPostcode("28000"), false);
});

test("state machine: allowed and forbidden transitions", () => {
  const allowed = [["draft", "review"], ["review", "approved"], ["approved", "uploading"], ["uploading", "checking"], ["checking", "ready"], ["ready", "sending"], ["sending", "submitted"], ["submitted", "sent"], ["sent", "undeliverable"], ["rejected", "review"], ["ready", "withdrawn"], ["error", "submitted"], ["approved", "review"]];
  for (const [a, b] of allowed) assert.equal(canTransition(a, b), true, `${a}>${b}`);
  const forbidden = [["draft", "approved"], ["review", "uploading"], ["approved", "sending"], ["ready", "submitted"], ["checking", "sending"], ["submitted", "withdrawn"], ["sent", "review"], ["sending", "withdrawn"], ["withdrawn", "review"], ["delivered", "sent"], ["review", "sent"], ["draft", "sending"]];
  for (const [a, b] of forbidden) assert.equal(canTransition(a, b), false, `${a}>${b}`);
  // Only "sending" leads to "submitted" (or error reconcile): nothing else can post.
  for (const s of STATUSES) if (s !== "sending" && s !== "error" && s !== "submitted") assert.equal(canTransition(s, "submitted"), false, s);
  assert.deepEqual(Object.keys(TRANSITIONS).sort(), [...STATUSES].sort());
});

test("state machine: the migration's trigger allows exactly the same transitions", () => {
  const sql = fs.readFileSync(new URL("../../supabase/migrations/20261117_letters.sql", import.meta.url), "utf8");
  const block = sql.slice(sql.indexOf("allowed text[] := array["), sql.indexOf("];", sql.indexOf("allowed text[] := array[")));
  const fromSql = [...block.matchAll(/'([a-z_]+)>([a-z_]+)'/g)].map((m) => `${m[1]}>${m[2]}`).sort();
  const fromTs = Object.entries(TRANSITIONS).flatMap(([a, bs]) => bs.map((b) => `${a}>${b}`)).sort();
  assert.deepEqual(fromSql, fromTs);
});

test("cost: 0.97 x 12 = 11.64, plus 21% IVA = 14.08", () => {
  const c = costEstimate(Array(12).fill(0.97), 21);
  assert.equal(c.net_cents, 1164);
  assert.equal(c.vat_cents, 244);
  assert.equal(c.gross_cents, 1408);
  assert.equal(c.text, "12 letters, about 11.64 EUR + 21% IVA = 14.08 EUR");
  assert.equal(costEstimate([], 21).gross_cents, 0);
});

test("ref codes: alphabet, length, uniqueness", () => {
  const rb = (n) => crypto.getRandomValues(new Uint8Array(n));
  for (let i = 0; i < 200; i++) assert.match(refCode(rb), REF_RE);
  assert.equal(REF_ALPHABET.length, 31);
  for (const c of "01ILO") assert.equal(REF_ALPHABET.includes(c), false);
  const many = refCodes(500, new Set(), rb);
  assert.equal(new Set(many).size, 500);
  const taken = new Set(refCodes(50, new Set(), rb));
  assert.ok(refCodes(50, taken, rb).every((c) => !taken.has(c)));
  // A byte source that only ever gives 248..255 must not loop forever or bias.
  let calls = 0;
  const skewed = (n) => { calls++; const b = new Uint8Array(n).fill(250); if (calls > 3) b[0] = 5; return b; };
  assert.match(refCode(skewed), REF_RE);
});

test("madrid day start, canonical json, stale English", () => {
  assert.equal(madridDayStart(new Date("2026-11-17T10:00:00Z")).toISOString(), "2026-11-16T23:00:00.000Z");
  assert.equal(madridDayStart(new Date("2026-07-01T21:30:00Z")).toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(madridDayStart(new Date("2026-11-16T23:30:00Z")).toISOString(), "2026-11-16T23:00:00.000Z");
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  const a = approved();
  const b = { ...a, body_es: a.body_es + " " };
  assert.equal(markStale(a, b).body_en_stale, true);
  assert.equal(markStale(a, { ...b, body_en: b.body_en + "!" }).body_en_stale, false);
});
