// Letters: every glyph the letter prints must look like the font's own
// outline once embedded the way render.ts embeds it (SUBSET). Each glyph is
// drawn alone at 48 pt, rasterised by poppler without anti-aliasing, and
// compared pixel by pixel with a scanline fill of the original TTF outline
// (nonzero winding). A missing or garbled glyph differs by far more than the
// edge pixels a correct one does.
//
// Why: on 17 Nov a subset Arimo printed garbled addresses while pdftotext
// read them perfectly, and a whole Fraunces printed "Mas s age". Text
// extraction cannot catch that; only the pixels can.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadLibs } from "./_helpers.mjs";
import { embedLetterFonts, SUBSET, senderLines } from "../../supabase/functions/letters/render.ts";
import { DEFAULT_SETTINGS } from "../../supabase/functions/letters/rules.ts";
import { defaultTemplate, useApprovedFeeWording, PRINTED_FIXED } from "../../supabase/functions/letters/templates.ts";

const L = loadLibs();
const havePoppler = (() => { try { execFileSync("pdftoppm", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !L ? "set LETTERS_LIBS to a node_modules with pdf-lib, @pdf-lib/fontkit, qrcode-generator, jsqr, pngjs" : !havePoppler ? "poppler-utils not installed" : false;
const FONT_DIR = new URL("../../supabase/functions/letters/fonts/", import.meta.url);
const bytesOf = (f) => new Uint8Array(fs.readFileSync(new URL(f, FONT_DIR)));
const FONTS = { wordmark: bytesOf("Fraunces-SemiBold.ttf"), regular: bytesOf("Outfit-Regular.ttf"), medium: bytesOf("Outfit-Medium.ttf"), address: bytesOf("Arimo-Regular.ttf") };

const SIZE = 48, DPI = 150;
const t = useApprovedFeeWording(defaultTemplate());
const letterText = [t.body_es, t.optout_es, t.privacy_es, t.qr_caption_es, PRINTED_FIXED.tagline.es, ...senderLines(DEFAULT_SETTINGS, "ABC234"), "ÁÉÍÓÚÜÑáéíóúüñ¿¡«»“”’ºª€•0123456789"].join("");
const CHARS = {
  wordmark: "Massage Club",
  regular: letterText,
  medium: letterText,
  address: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÜÑáéíóúüñàèç0123456789.,/ºª'-",
};
const uniqChars = (s) => [...new Set([...s])].filter((c) => c.trim());

function flatten(glyph) {
  const contours = [];
  let cur = null, x = 0, y = 0;
  const N = 12;
  for (const c of glyph.path.commands) {
    const a = c.args;
    if (c.command === "moveTo") { cur = [[a[0], a[1]]]; contours.push(cur); [x, y] = a; }
    else if (c.command === "lineTo") { cur.push([a[0], a[1]]); [x, y] = a; }
    else if (c.command === "quadraticCurveTo") {
      for (let i = 1; i <= N; i++) { const u = i / N, v = 1 - u; cur.push([v * v * x + 2 * v * u * a[0] + u * u * a[2], v * v * y + 2 * v * u * a[1] + u * u * a[3]]); }
      [x, y] = [a[2], a[3]];
    } else if (c.command === "bezierCurveTo") {
      for (let i = 1; i <= N; i++) { const u = i / N, v = 1 - u; cur.push([v ** 3 * x + 3 * v * v * u * a[0] + 3 * v * u * u * a[2] + u ** 3 * a[4], v ** 3 * y + 3 * v * v * u * a[1] + 3 * v * u * u * a[3] + u ** 3 * a[5]]); }
      [x, y] = [a[4], a[5]];
    }
  }
  const edges = [];
  for (const ct of contours) for (let i = 0; i < ct.length; i++) { const p = ct[i], q = ct[(i + 1) % ct.length]; if (p[1] !== q[1]) edges.push([p[0], p[1], q[0], q[1]]); }
  return edges;
}

// Reference mask: pixel centres inside the outline (nonzero winding), for a
// glyph drawn with its origin at (ox, oyBaseline) in pixels from the top-left.
function referenceMask(edges, upm, ox, oyBaseline, w, h, x0, y0) {
  const scale = (SIZE / upm) * (DPI / 72);
  const mask = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) {
    const fy = (oyBaseline - (y0 + r + 0.5)) / scale; // font units, y up
    const xs = [];
    for (const [ax, ay, bx, by] of edges) {
      if ((fy >= ay && fy < by) || (fy >= by && fy < ay)) xs.push([ax + ((fy - ay) * (bx - ax)) / (by - ay), by > ay ? 1 : -1]);
    }
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (!wind) continue;
      const from = Math.max(0, Math.ceil(ox + xs[i][0] * scale - x0 - 0.5)), to = Math.min(w - 1, Math.floor(ox + xs[i + 1][0] * scale - x0 - 0.5));
      for (let c = from; c <= to; c++) mask[r * w + c] = 1;
    }
  }
  return mask;
}

// Single glyphs, and whole words so that advance widths are checked too (a
// whole Fraunces drew each glyph right but in the wrong place).
function items(key) {
  const words = [...new Set(CHARS[key].split(/\s+/).filter((w) => w.length >= 2 && w.length <= 10))].slice(0, 30);
  const extra = key === "wordmark" ? ["Massage Club"] : key === "address" ? ["Calle de la Princesa", "28004 Madrid", "Local 3, 2º B"] : ["¿No queréis", "5 € + IVA", "• Nos dais"];
  return [...uniqChars(CHARS[key]), ...words, ...extra];
}

async function checkFont(key, subset, outDir) {
  const { PDFDocument, rgb } = L.libs;
  const fk = L.libs.fontkit.create(FONTS[key]);
  const doc = await PDFDocument.create({ updateMetadata: false });
  const embedded = await embedLetterFonts(L.libs, doc, FONTS, { ...SUBSET, [key]: subset });
  const font = embedded[key];
  const unit = SIZE / fk.unitsPerEm;
  const placed = [];
  let page = null, x = 40, top = 0;
  for (const str of items(key)) {
    const glyphs = [...str].map((ch) => fk.glyphForCodePoint(ch.codePointAt(0)));
    const width = glyphs.reduce((a, g) => a + g.advanceWidth, 0) * unit;
    if (width > 500) continue;
    if (!page || x + width > 555) { x = 40; top += SIZE * 1.6; }
    if (!page || top > 790) { page = doc.addPage([595.28, 841.89]); top = 60; x = 40; }
    page.drawText(str, { x, y: 841.89 - top, size: SIZE, font, color: rgb(0, 0, 0) });
    placed.push({ str, glyphs, page: doc.getPageCount() - 1, x, baseTop: top, width });
    x += width + 24;
  }
  const file = path.join(outDir, `glyphs_${key}_${subset ? "subset" : "whole"}.pdf`);
  fs.writeFileSync(file, await doc.save({ useObjectStreams: false }));
  execFileSync("pdftoppm", ["-r", String(DPI), "-gray", "-aa", "no", "-aaVector", "no", "-png", file, file]);
  const pages = [];
  for (let p = 0; p < doc.getPageCount(); p++) {
    const f = `${file}-${p + 1}.png`;
    pages.push(L.PNG.sync.read(fs.readFileSync(f)));
    fs.unlinkSync(f);
  }
  fs.unlinkSync(file);
  const bad = [];
  let worst = 0;
  const k = DPI / 72;
  for (const g of placed) {
    const png = pages[g.page];
    const ox = g.x * k, oy = g.baseTop * k;
    const x0 = Math.floor(ox - 10), y0 = Math.floor(oy - SIZE * 1.2 * k), w = Math.ceil(g.width * k + 20), h = Math.ceil(SIZE * 1.6 * k);
    // The string's outline: each glyph's edges shifted by the advances before it.
    const edges = [];
    let adv = 0;
    for (const glyph of g.glyphs) {
      for (const [ax, ay, bx, by] of flatten(glyph)) edges.push([ax + adv, ay, bx + adv, by]);
      adv += glyph.advanceWidth;
    }
    const ref = referenceMask(edges, fk.unitsPerEm, ox, oy, w, h, x0, y0);
    // Rasterisers disagree about edge pixels, so a pixel only counts as wrong
    // when nothing within one pixel agrees with it.
    const ink = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const X = x0 + c, Y = y0 + r;
      ink[r * w + c] = X >= 0 && Y >= 0 && X < png.width && Y < png.height && png.data[(Y * png.width + X) * 4] < 128 ? 1 : 0;
    }
    const near = (m, r, c) => { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < h && cc < w && m[rr * w + cc]) return true; } return false; };
    let refN = 0, wrong = 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const i = r * w + c;
      refN += ref[i];
      if (ink[i] && !near(ref, r, c)) wrong++;
      if (ref[i] && !near(ink, r, c)) wrong++;
    }
    const ratio = wrong / Math.max(refN, 1);
    if (refN > 0 && ratio > 0.06) bad.push(`"${g.str}" (${Math.round(ratio * 100)}% of pixels wrong)`);
    worst = Math.max(worst, refN > 0 ? ratio : 0);
  }
  return { checked: placed.length, bad, worst };
}

test("every glyph prints as its outline, with the fonts embedded as render.ts embeds them", { skip }, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "letters-glyphs-"));
  for (const key of ["wordmark", "regular", "medium", "address"]) {
    const r = await checkFont(key, SUBSET[key], out);
    assert.deepEqual(r.bad, [], `${key} (${SUBSET[key] ? "subset" : "whole"}): ${r.bad.join(", ")}`);
    assert.ok(r.checked >= 8);
    console.log(`# ${key}: ${r.checked} glyphs and words, worst ${(r.worst * 100).toFixed(1)}% of pixels wrong`);
  }
  // For the record: the other choice for the two fonts that needed one.
  for (const key of ["wordmark", "address"]) {
    const r = await checkFont(key, !SUBSET[key], out);
    console.log(`# ${key} embedded ${SUBSET[key] ? "whole" : "as a subset"} would print ${r.bad.length} of ${r.checked} glyphs and words wrong`);
  }
  fs.rmSync(out, { recursive: true, force: true });
});
