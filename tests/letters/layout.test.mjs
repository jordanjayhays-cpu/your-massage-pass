// Letters: page geometry, wrapping, the fit algorithm and the box validator
// (supabase/functions/letters/layout.ts), with simple fake font metrics.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseParas, withLead, wrapRuns, fitLetter, validateBoxes, mm2pt, pt2mm, ZONES, GEOM } from "../../supabase/functions/letters/layout.ts";
import { mergeRuns, tagValues, TAGS, DEFAULT_SETTINGS } from "../../supabase/functions/letters/rules.ts";
import { defaultTemplate, useApprovedFeeWording } from "../../supabase/functions/letters/templates.ts";
import { GOOD_SETTINGS } from "./_helpers.mjs";

// Every character 0.5 em wide; ascent 0.8 em, descent 0.2 em.
const m = (k = 0.5) => ({ width: (t, s) => [...t].length * k * s, ascent: (s) => 0.8 * s, descent: (s) => 0.2 * s });
const fonts = { regular: m(), medium: m(0.52), address: m(0.55), wordmark: m(0.6) };
const run = (text, style = "regular") => ({ text, style });

function input(o = {}) {
  const t = useApprovedFeeWording(defaultTemplate());
  const vals = tagValues({ ...DEFAULT_SETTINGS, ...GOOD_SETTINGS });
  return {
    fonts,
    body: mergeRuns(o.body ?? t.body_es, { nombre: { text: o.name ?? "Estudio Ficticio Alfa" } }, TAGS.body),
    optout: mergeRuns(t.optout_es, vals, TAGS.optout),
    privacy: mergeRuns(o.privacy ?? t.privacy_es, vals, TAGS.privacy),
    addressLines: o.address ?? ["Estudio Ficticio Alfa", "Calle Ejemplo 1, 2º B", "28004 Madrid"],
    senderLines: ["Jordan, de Massage Club", "book.massageclub.io", "WhatsApp +34 612 474 827", "support@massageclub.io", "Ref. ABC234"],
    wordmark: "Massage Club", tagline: "Reservas de masaje en Madrid", caption: "Escanead para apuntaros",
  };
}

test("mm and points", () => {
  assert.ok(Math.abs(mm2pt(210) - 595.28) < 0.01);
  assert.ok(Math.abs(mm2pt(297) - 841.89) < 0.01);
  assert.ok(Math.abs(pt2mm(mm2pt(42.5)) - 42.5) < 1e-9);
});

test("paragraphs, hard line breaks and bullets", () => {
  const p = parseParas([run("Hola:\n\nUno dos.\n• Primero\n• Segundo\n\nUn saludo,\nJordan")]);
  assert.equal(p.length, 3);
  assert.deepEqual(p[1].map((h) => [h.bullet, h.runs.map((r) => r.text).join("")]), [[false, "Uno dos."], [true, "Primero"], [true, "Segundo"]]);
  assert.equal(p[2].length, 2);
  assert.deepEqual(withLead([run("¿No queréis más cartas? Escribid BAJA.")]).map((r) => r.style), ["medium", "regular"]);
  assert.equal(withLead([run("¿No queréis más cartas? Escribid BAJA.")])[0].text, "¿No queréis más cartas?");
});

test("wrap: greedy, never wider than the column, style runs kept", () => {
  const w = wrapRuns([run("aaa bbb "), run("FALTA: x", "missing"), run(" ccc ddd eee")], fonts, 10, 5 * 8 * 5);
  for (const l of w.lines) assert.ok(l.widthPt <= 200 + 1e-9);
  const text = w.lines.map((l) => l.segs.map((s) => s.text).join("")).join(" ");
  assert.equal(text.replace(/\s+/g, " "), "aaa bbb FALTA: x ccc ddd eee");
  assert.ok(w.lines.some((l) => l.segs.some((s) => s.style === "missing")));
  assert.equal(wrapRuns([run("x".repeat(100))], fonts, 10, 100).error.code, "word_too_long");
});

test("the default letter fits at the largest size and every box is valid", () => {
  const r = fitLetter(input());
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.equal(r.layout.sizes.body, 10.5);
  assert.equal(r.layout.sizes.address, 10);
  assert.deepEqual(validateBoxes(r.layout.boxes), []);
  assert.equal(r.layout.placeholders, 0);
  const addr = r.layout.boxes.filter((b) => b.kind === "address");
  assert.equal(addr.length, 3);
  assert.ok(Math.abs(addr[0].y - GEOM.address.top) < 1e-9);
  const body = r.layout.boxes.filter((b) => b.group === "body");
  assert.ok(Math.abs(body[0].y - GEOM.body.top) < 1e-9);
  const priv = r.layout.boxes.filter((b) => b.group === "privacy");
  assert.ok(Math.abs(Math.max(...priv.map((b) => b.y + b.h)) - GEOM.privacy.bottom) < 1e-6);
});

test("missing settings are counted as placeholders", () => {
  const t = useApprovedFeeWording(defaultTemplate());
  const inp = input();
  inp.privacy = mergeRuns(t.privacy_es, tagValues(DEFAULT_SETTINGS), TAGS.privacy);
  const r = fitLetter(inp);
  assert.equal(r.ok, true);
  assert.ok(r.layout.placeholders >= 2);
  assert.ok(fitLetter({ ...input(), qrPlaceholder: true }).layout.placeholders === 1);
});

test("long text steps down, then fails with text_too_long and the overflow; nothing is clipped", () => {
  const t = useApprovedFeeWording(defaultTemplate());
  const sizes = new Set();
  let failedAt = 0;
  for (let n = 0; n < 80; n++) {
    const longer = t.body_es.replace("Nosotros les buscamos centro.", "Nosotros les buscamos centro. " + "Texto de relleno para probar el ajuste. ".repeat(n));
    const r = fitLetter(input({ body: longer }));
    if (!r.ok) { failedAt = n; assert.equal(r.error.code, "text_too_long"); break; }
    sizes.add(r.layout.sizes.body);
    assert.deepEqual(validateBoxes(r.layout.boxes), [], `n=${n}`);
  }
  assert.deepEqual([...sizes], [10.5, 10, 9.5, 9], "every body step is used before failing");
  assert.ok(failedAt > 0);
  const huge = t.body_es.replace("Nosotros les buscamos centro.", "Relleno largo. ".repeat(300));
  const r2 = fitLetter(input({ body: huge }));
  assert.equal(r2.ok, false);
  assert.equal(r2.error.code, "text_too_long");
  assert.ok(r2.error.overflow_mm > 0);
});

test("address: long lines step down to 9.5 and 9 pt; six lines do not fit", () => {
  const wide = "N".repeat(43); // 43 x 5.5 pt = 236.5 pt > 81.5 mm at 10 pt; fits at 9.5
  const r = fitLetter(input({ address: [wide, "Calle 1", "28004 Madrid"] }));
  assert.equal(r.ok, true);
  assert.ok(r.layout.sizes.address < 10);
  assert.deepEqual(validateBoxes(r.layout.boxes), []);
  const six = fitLetter(input({ address: ["A", "B", "C", "D", "E", "28004 Madrid"] }));
  assert.equal(six.ok, false);
  assert.equal(six.error.code, "address_too_long");
  const tooWide = fitLetter(input({ address: ["N".repeat(60), "Calle 1", "28004 Madrid"] }));
  assert.equal(tooWide.error.code, "address_too_long");
});

test("validator: postage area, address inset, printable area, bottom-left corner, overlaps", () => {
  const ok = fitLetter(input()).layout.boxes;
  const add = (b) => validateBoxes([...ok, { group: "x", kind: "text", id: "intruder", ...b }]);
  assert.match(add({ x: 30, y: 45, w: 10, h: 3 }).join(), /postage area/);
  assert.match(add({ x: 1, y: 100, w: 10, h: 3 }).join(), /outside the printable area/);
  assert.match(add({ x: 6, y: 283, w: 10, h: 3 }).join(), /bottom-left/);
  assert.match(add({ x: 25, y: 100, w: 10, h: 3 }).join(), /body\d+ overlaps intruder/);
  const addrOut = validateBoxes([{ group: "address", kind: "address", id: "a", x: 21, y: 61, w: 10, h: 3 }]);
  assert.match(addrOut.join(), /not inside the address area/);
  const qrClose = validateBoxes([{ group: "qr", kind: "qr", id: "qr", x: ZONES.postage.x + ZONES.postage.w + 1, y: 46, w: 30, h: 30 }]);
  assert.match(qrClose.join(), /too close/);
});
