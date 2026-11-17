// Letters: the real PDF renderer (supabase/functions/letters/render.ts) with
// pdf-lib, fontkit and qrcode-generator from LETTERS_LIBS, checked with
// poppler (pdfinfo, pdffonts, pdftotext -bbox, pdftoppm) and a QR decoder.
// Writes sample PDFs to LETTERS_SAMPLES_DIR (default: the OS temp folder).
// Fixtures are synthetic: no real studio in the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { loadLibs, GOOD_SETTINGS } from "./_helpers.mjs";
import { renderLetter } from "../../supabase/functions/letters/render.ts";
import { DEFAULT_SETTINGS, EN_DASH, EM_DASH } from "../../supabase/functions/letters/rules.ts";
import { defaultTemplate, useApprovedFeeWording, FEE_SENTENCES } from "../../supabase/functions/letters/templates.ts";
import { pt2mm, ZONES } from "../../supabase/functions/letters/layout.ts";

const L = loadLibs();
const havePoppler = (() => { try { execFileSync("pdfinfo", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !L ? "set LETTERS_LIBS to a node_modules with pdf-lib, @pdf-lib/fontkit, qrcode-generator, jsqr, pngjs" : !havePoppler ? "poppler-utils not installed" : false;
const OUT = process.env.LETTERS_SAMPLES_DIR || path.join(os.tmpdir(), "letters-samples");
const FONT_DIR = new URL("../../supabase/functions/letters/fonts/", import.meta.url);
const fonts = () => ({
  wordmark: new Uint8Array(fs.readFileSync(new URL("Fraunces-SemiBold.ttf", FONT_DIR))),
  regular: new Uint8Array(fs.readFileSync(new URL("Outfit-Regular.ttf", FONT_DIR))),
  medium: new Uint8Array(fs.readFileSync(new URL("Outfit-Medium.ttf", FONT_DIR))),
  address: new Uint8Array(fs.readFileSync(new URL("Arimo-Regular.ttf", FONT_DIR))),
});
const settings = { ...DEFAULT_SETTINGS, ...GOOD_SETTINGS };
const QR = (s) => `https://book.massageclub.io/socios?s=${s}&k=0123456789abcdef01234567`;

const SAMPLES = [
  { file: "sample_short_name.pdf", name: "Spa Uno", address: ["Spa Uno", "Calle Ejemplo 1", "28004 Madrid"], qr: QR("spa-uno"), spectrum: "grayscale" },
  // 42 characters: the longest address line the list allows, also the greeting.
  { file: "sample_longest_name.pdf", name: "Centro de Masaje Terapeutico Ejemplo Largo", address: ["Centro de Masaje Terapeutico Ejemplo Largo", "Calle de la Princesa Imaginaria 123", "28008 Madrid"], qr: QR("a1a1a1a1-0000-4000-8000-000000000001"), spectrum: "color" },
  { file: "sample_4_line_address.pdf", name: "Estudio Ficticio Alfa", address: ["Estudio Ficticio Alfa", "Local 3, 2º B", "Avenida Imaginaria 22", "28010 Madrid"], qr: QR("estudio-ficticio-alfa"), spectrum: "grayscale" },
];
const input = (s, o = {}) => ({
  greeting: s.name, addressLines: s.address, qrUrl: s.qr, refCode: "ABC234", template: useApprovedFeeWording(defaultTemplate()),
  settings, spectrum: s.spectrum, createdAt: "2026-11-17T10:00:00Z", ...o,
});

function words(file) {
  const html = execFileSync("pdftotext", ["-bbox", file, "-"]).toString();
  return [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({
    x: pt2mm(+m[1]), y: pt2mm(+m[2]), x2: pt2mm(+m[3]), y2: pt2mm(+m[4]), text: m[5].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
  }));
}
const inZone = (w, z, inset = 0) => w.x >= z.x + inset - 0.01 && w.y >= z.y + inset - 0.01 && w.x2 <= z.x + z.w - inset + 0.01 && w.y2 <= z.y + z.h - inset + 0.01;
const hits = (w, z) => w.x < z.x + z.w && z.x < w.x2 && w.y < z.y + z.h && z.y < w.y2;
// The page's content streams only (not font programs), inflated.
function contentOps(file) {
  const raw = fs.readFileSync(file);
  const s = raw.toString("latin1");
  const refs = [];
  for (const m of s.matchAll(/\/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]*)\])/g)) {
    if (m[1]) refs.push(m[1]);
    else for (const r of m[2].matchAll(/(\d+)\s+0\s+R/g)) refs.push(r[1]);
  }
  assert.ok(refs.length > 0, "no page content stream found");
  let out = "";
  for (const n of refs) {
    const at = s.search(new RegExp(`(^|\\s)${n} 0 obj`));
    const start = s.indexOf("stream", at) + "stream".length;
    const body = s[start] === "\r" ? start + 2 : start + 1;
    const end = s.indexOf("endstream", body);
    out += inflateSync(raw.subarray(body, end)).toString("latin1") + "\n";
  }
  return out;
}
function decodeQr(file) {
  const base = path.join(OUT, "qr_" + path.basename(file, ".pdf"));
  // The QR box is 160..190 mm x 46..76 mm: crop a little around it at 300 dpi.
  const px = (mm) => Math.round((mm / 25.4) * 300);
  execFileSync("pdftoppm", ["-r", "300", "-png", "-singlefile", "-x", String(px(155)), "-y", String(px(41)), "-W", String(px(40)), "-H", String(px(40)), file, base]);
  const png = L.PNG.sync.read(fs.readFileSync(base + ".png"));
  fs.unlinkSync(base + ".png");
  return L.jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

test("render the three sample letters and check them with poppler", { skip }, async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const fee = FEE_SENTENCES["2026-10-19"].es;
  for (const s of SAMPLES) {
    const r = await renderLetter(L.libs, fonts(), input(s));
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const file = path.join(OUT, s.file);
    fs.writeFileSync(file, r.bytes);
    assert.ok(r.bytes.length < 8 * 1024 * 1024);
    assert.equal(r.layout.placeholders, 0);
    const info = execFileSync("pdfinfo", [file]).toString();
    assert.match(info, /Pages:\s+1\n/);
    assert.match(info, /Page size:\s+595\.28 x 841\.89 pts \(A4\)/);
    assert.doesNotMatch(info, /socios|Calle|Madrid/, "no address or link in the metadata");
    const pf = execFileSync("pdffonts", [file]).toString().trim().split("\n").slice(2);
    assert.equal(pf.length, 4);
    for (const line of pf) assert.match(line, /\s+yes\s+(yes|no)\s+yes\s+\d+\s+\d+$/, line);
    // Text: as merged, accents and symbols intact, the fee sentence exactly once.
    const text = execFileSync("pdftotext", [file, "-"]).toString();
    const flat = text.replace(/\s+/g, " ");
    assert.equal(text.includes(EN_DASH) || text.includes(EM_DASH), false, "no en or em dash in the printed text");
    assert.equal(flat.split(fee).length - 1, 1, "fee sentence exactly once");
    assert.ok(flat.includes(`Hola, equipo de ${s.name}:`));
    for (const bit of ["¿No queréis recibir más cartas? Escribid BAJA por WhatsApp al +34 612 474 827", "Protección de datos. Responsable: Remitente Ejemplo S.L., NIF B12345674, Calle Remite 1, 28004 Madrid", "no saben dónde", "• Nos dais 2 o 3 horas libres", "Jordan, de Massage Club", "Ref. ABC234", "https://massageclub.io/privacy#negocios"]) {
      assert.ok(flat.includes(bit), `${s.file}: missing "${bit}"`);
    }
    // Geometry of every word on the page.
    const ws = words(file);
    const addressWords = s.address.join(" ").split(" ");
    for (const w of ws) {
      assert.ok(inZone(w, ZONES.printable), `${s.file}: "${w.text}" outside the printable area`);
      assert.equal(hits(w, ZONES.bottomLeft), false, `${s.file}: "${w.text}" in the bottom-left corner`);
    }
    const inPostage = ws.filter((w) => hits(w, ZONES.postage));
    assert.deepEqual(inPostage.map((w) => w.text), addressWords, `${s.file}: only the address in the postage area`);
    for (const w of inPostage) assert.ok(inZone(w, ZONES.address, 1), `${s.file}: "${w.text}" not 1 mm inside the address area`);
    // The QR opens the studio's link.
    assert.equal(decodeQr(file), s.qr);
    // Colour operators only in the colour sample.
    const ops = contentOps(file);
    if (s.spectrum === "grayscale") {
      assert.equal(/(^|\s)(rg|RG|k|K|sc|SC|scn|SCN)\s/.test(ops), false, `${s.file}: colour operator in a grayscale letter`);
      assert.match(ops, /(^|\s)g\s/, "grey fills are set with the g operator");
    } else assert.match(ops, /(^|\s)rg\s/);
  }
});

test("equal inputs give equal bytes; any printed change gives new bytes", { skip }, async () => {
  const s = SAMPLES[0];
  const a = await renderLetter(L.libs, fonts(), input(s));
  const b = await renderLetter(L.libs, fonts(), input(s));
  assert.deepEqual(Buffer.from(a.bytes), Buffer.from(b.bytes));
  const c = await renderLetter(L.libs, fonts(), input(s, { refCode: "ABC235" }));
  assert.notDeepEqual(Buffer.from(a.bytes), Buffer.from(c.bytes));
});

test("refusals: too long, unprintable characters, dashes, missing settings, unsigned QR", { skip }, async () => {
  const s = SAMPLES[0];
  const t = useApprovedFeeWording(defaultTemplate());
  const long = { ...t, body_es: t.body_es.replace("Nosotros les buscamos centro.", "Relleno largo para la prueba. ".repeat(80)) };
  const r1 = await renderLetter(L.libs, fonts(), input(s, { template: long }));
  assert.equal(r1.ok, false);
  assert.equal(r1.error.code, "text_too_long");
  assert.ok(r1.error.overflow_mm > 0);
  const r2 = await renderLetter(L.libs, fonts(), input(s, { greeting: "Spa 漢" }));
  assert.equal(r2.error.code, "no_glyph");
  const r3 = await renderLetter(L.libs, fonts(), input(s, { greeting: `Spa ${EM_DASH} Uno` }));
  assert.equal(r3.error.code, "greeting_invalid");
  const r4 = await renderLetter(L.libs, fonts(), input(s, { settings: DEFAULT_SETTINGS, template: defaultTemplate(), qrUrl: null, qrProblem: "MC_SIGN_KEY is not set" }));
  assert.equal(r4.ok, true);
  assert.ok(r4.layout.placeholders >= 3);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "sample_draft_missing_settings.pdf"), r4.bytes);
  const text = execFileSync("pdftotext", [path.join(OUT, "sample_draft_missing_settings.pdf"), "-"]).toString();
  assert.ok(text.includes("FALTA: remitente legal"));
  assert.ok(text.includes("QR sin firmar"));
});
