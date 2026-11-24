// Letters (17 Nov 2026): the letter PDF. One A4 page, fonts embedded, the
// address in Pingen's left window zone, the template with {{nombre}} merged,
// the boxed opt-out line, the privacy block naming the legal sender, the
// studio's own QR (its signed /socios link) and the sender block.
//
// This file never imports a URL: the PDF, font and QR libraries and the font
// bytes are passed in (deps.ts on Deno; npm packages in the Node tests), so
// the same code renders in the edge function and in the tests.
//
// What is drawn is exactly what layout.ts placed and validated. A letter that
// does not fit, has a character the font cannot print, or is missing a setting
// never gets bytes that could be approved: missing settings and an unsigned
// QR render as red placeholders (counted in layout.placeholders, which blocks
// approval), and overflow fails with text_too_long.

import { mergeRuns, tagValues, TAGS, nfc, DASH_RE, greetingProblems } from "./rules.ts";
import type { Run, Settings } from "./rules.ts";
import { fitLetter, validateBoxes, mm2pt, pdfY, PAGE, GEOM } from "./layout.ts";
import type { FontSet, FontKey, PlacedLine, LetterLayout, Rect } from "./layout.ts";
import { PRINTED_FIXED, SIGN_OFF } from "./templates.ts";

export const RENDERER_VERSION = "letters-pdf-1";

// deno-lint-ignore no-explicit-any
type Any = any;
export type RenderLibs = { PDFDocument: Any; rgb: Any; grayscale: Any; fontkit: Any; qrcode: Any };
export type FontBytes = { wordmark: Uint8Array; regular: Uint8Array; medium: Uint8Array; address: Uint8Array };
export type RenderInput = {
  greeting: string;
  addressLines: string[];
  qrUrl: string | null;
  qrProblem?: string;
  refCode: string;
  template: { body_es: string; optout_es: string; privacy_es: string; qr_caption_es: string };
  settings: Settings;
  spectrum: "grayscale" | "color";
  createdAt: string;
};
export type LayoutReport = {
  renderer: string;
  sizes: LetterLayout["sizes"];
  line_counts: LetterLayout["line_counts"];
  placeholders: number;
  placeholder_texts: string[];
  body_space_left_mm: number;
  boxes: { id: string; kind: string; x: number; y: number; w: number; h: number }[];
  qr: { modules: number; module_mm: number } | null;
  fonts: string[];
  spectrum: string;
};
export type RenderError = { code: string; message: string; overflow_mm?: number };
export type RenderResult = { ok: true; bytes: Uint8Array; layout: LayoutReport } | { ok: false; error: RenderError };

const FONT_NAMES: Record<FontKey, string> = { wordmark: "MC-Fraunces-SemiBold", regular: "MC-Outfit-Regular", medium: "MC-Outfit-Medium", address: "MC-Arimo-Regular" };
// Kerning and ligatures off: what is measured is what is drawn, and the text
// layer reads back as typed ("fi" stays two letters).
const FEATURES = { liga: false, clig: false, calt: false, kern: false, dlig: false };
// How each font is embedded. Seen on 17 Nov with pdf-lib 1.17.1, fontkit 1.1.1
// and poppler: a subset Arimo prints garbled glyphs (the text layer stays
// right), and a whole Fraunces prints with glyphs missing. So Arimo goes in
// whole and the others as subsets. glyphs.test.mjs rasterises every glyph the
// letter uses, as embedded here, and compares it with the font's own outline.
export const SUBSET: Record<FontKey, boolean> = { wordmark: true, regular: true, medium: true, address: false };

export async function embedLetterFonts(libs: RenderLibs, doc: Any, fonts: FontBytes, subset: Record<FontKey, boolean> = SUBSET): Promise<Record<FontKey, Any>> {
  doc.registerFontkit(libs.fontkit);
  const out = {} as Record<FontKey, Any>;
  for (const k of ["wordmark", "regular", "medium", "address"] as FontKey[]) {
    out[k] = await doc.embedFont(fonts[k], { subset: subset[k], customName: FONT_NAMES[k], features: FEATURES });
  }
  return out;
}

const fkCache = new WeakMap<Uint8Array, Any>();
function fkFont(libs: RenderLibs, bytes: Uint8Array): Any {
  let f = fkCache.get(bytes);
  if (!f) { f = libs.fontkit.create(bytes); fkCache.set(bytes, f); }
  return f;
}

export function senderLines(s: Settings, refCode: string): string[] {
  return [SIGN_OFF, PRINTED_FIXED.web, `WhatsApp ${s.contact_whatsapp}`, s.contact_email, `${PRINTED_FIXED.ref.es} ${refCode}`];
}

export function mergedTexts(inp: RenderInput): { body: Run[]; optout: Run[]; privacy: Run[] } {
  const vals = tagValues(inp.settings);
  return {
    body: mergeRuns(nfc(inp.template.body_es), { nombre: { text: nfc(inp.greeting).trim() } }, TAGS.body),
    optout: mergeRuns(nfc(inp.template.optout_es), vals, TAGS.optout),
    privacy: mergeRuns(nfc(inp.template.privacy_es), vals, TAGS.privacy),
  };
}

export async function renderLetter(libs: RenderLibs, fonts: FontBytes, inp: RenderInput, subset: Record<FontKey, boolean> = SUBSET): Promise<RenderResult> {
  const gp = greetingProblems(inp.greeting);
  if (gp.length) return { ok: false, error: { code: "greeting_invalid", message: gp.map((p) => p.message).join(" ") } };
  let texts: { body: Run[]; optout: Run[]; privacy: Run[] };
  try { texts = mergedTexts(inp); } catch (e) { return { ok: false, error: { code: "template_invalid", message: String((e as Error).message || e) } }; }
  const caption = nfc(inp.template.qr_caption_es).trim();
  const sender = senderLines(inp.settings, inp.refCode);
  const addressLines = inp.addressLines.map((l) => nfc(l).trim());
  const tagline = PRINTED_FIXED.tagline.es;
  const wordmark = PRINTED_FIXED.wordmark;

  // Every character must exist in the font that prints it; no long dashes.
  const plain = (runs: Run[]) => runs.map((r) => r.text).join("");
  const outfitText = [plain(texts.body), plain(texts.optout), plain(texts.privacy), caption, tagline, ...sender, "•"].join("\n");
  if (DASH_RE.test(outfitText + addressLines.join("\n"))) return { ok: false, error: { code: "dash", message: "The letter contains a long dash (en dash or em dash)." } };
  const missingGlyphs = (bytes: Uint8Array, text: string) => [...new Set([...text].filter((c) => c !== "\n" && !fkFont(libs, bytes).hasGlyphForCodePoint(c.codePointAt(0))))];
  const noGlyph = [...missingGlyphs(fonts.regular, outfitText), ...missingGlyphs(fonts.medium, outfitText), ...missingGlyphs(fonts.address, addressLines.join("\n")), ...missingGlyphs(fonts.wordmark, wordmark)];
  if (noGlyph.length) return { ok: false, error: { code: "no_glyph", message: `The fonts cannot print: ${[...new Set(noGlyph)].join(" ")}` } };

  const doc = await libs.PDFDocument.create({ updateMetadata: false });
  const pdfFonts = await embedLetterFonts(libs, doc, fonts, subset);
  // Ascent and descent from the font's own hhea values (pdf-lib 1.17.1's
  // heightAtSize(size, { descender: false }) subtracts an unscaled descent).
  const metrics = (f: Any, bytes: Uint8Array) => {
    const fk = fkFont(libs, bytes);
    const upm = fk.unitsPerEm || 1000;
    return {
      width: (t: string, s: number) => f.widthOfTextAtSize(t, s),
      ascent: (s: number) => (fk.ascent / upm) * s,
      descent: (s: number) => (Math.abs(fk.descent) / upm) * s,
    };
  };
  const fontSet: FontSet = { wordmark: metrics(pdfFonts.wordmark, fonts.wordmark), regular: metrics(pdfFonts.regular, fonts.regular), medium: metrics(pdfFonts.medium, fonts.medium), address: metrics(pdfFonts.address, fonts.address) };

  const fit = fitLetter({ fonts: fontSet, body: texts.body, optout: texts.optout, privacy: texts.privacy, addressLines, senderLines: sender, wordmark, tagline, caption, qrPlaceholder: !inp.qrUrl });
  if (!fit.ok) return { ok: false, error: fit.error };
  const L = fit.layout;
  const problems = validateBoxes(L.boxes);
  if (problems.length) return { ok: false, error: { code: "layout_invalid", message: problems.join("; ") } };

  const { rgb, grayscale } = libs;
  const C = inp.spectrum === "color"
    ? { ink: rgb(0x21 / 255, 0x1c / 255, 0x1a / 255), terra: rgb(0xc4 / 255, 0x62 / 255, 0x2d / 255), muted: rgb(0x7c / 255, 0x71 / 255, 0x66 / 255), black: rgb(0, 0, 0) }
    : { ink: grayscale(0.12), terra: grayscale(0.35), muted: grayscale(0.4), black: grayscale(0) };
  const RED = rgb(0.78, 0.1, 0.1);
  const page = doc.addPage([PAGE.wPt, PAGE.hPt]);
  const placeholderTexts: string[] = [];

  const draw = (l: PlacedLine, color: Any) => {
    for (const s of l.segs) {
      if (!s.text) continue;
      const font = pdfFonts[s.font];
      const x = mm2pt(l.x) + s.dx;
      const y = pdfY(l.baseline);
      if (s.style === "missing") {
        placeholderTexts.push(s.text.trim());
        const w = font.widthOfTextAtSize(s.text, l.size);
        const asc = fontSet[s.font].ascent(l.size), desc = fontSet[s.font].descent(l.size);
        page.drawRectangle({ x: x - 1, y: y - desc - 0.5, width: w + 2, height: asc + desc + 1, borderColor: RED, borderWidth: 0.6 });
        page.drawText(s.text, { x, y, size: l.size, font, color: RED });
      } else {
        page.drawText(s.text, { x, y, size: l.size, font, color });
      }
    }
  };

  // Header and sender block.
  draw(L.header[0], C.terra);
  draw(L.header[1], C.muted);
  L.sender.forEach((l, i) => draw(l, i === 0 ? C.ink : C.muted));
  // Recipient address: pure black, sans serif regular, left-aligned.
  L.address.forEach((l) => draw(l, C.black));
  // QR (pure black modules, 4-module quiet zone inside the box) and caption.
  let qrInfo: LayoutReport["qr"] = null;
  if (inp.qrUrl) {
    const qr = libs.qrcode(0, "M");
    qr.addData(inp.qrUrl, "Byte");
    qr.make();
    const n: number = qr.getModuleCount();
    const mod = GEOM.qr.w / (n + 2 * GEOM.qr.quietModules);
    const ox = L.qr.x + GEOM.qr.quietModules * mod, oy = L.qr.y + GEOM.qr.quietModules * mod;
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) { c++; continue; }
        const c0 = c;
        while (c < n && qr.isDark(r, c)) c++;
        // A hair taller than one module so rows print without seams.
        page.drawRectangle({ x: mm2pt(ox + c0 * mod), y: pdfY(oy + (r + 1) * mod) - 0.05, width: mm2pt((c - c0) * mod), height: mm2pt(mod) + 0.1, color: C.black });
      }
    }
    qrInfo = { modules: n, module_mm: Math.round(mod * 1000) / 1000 };
  } else {
    const q: Rect = L.qr;
    page.drawRectangle({ x: mm2pt(q.x), y: pdfY(q.y + q.h), width: mm2pt(q.w), height: mm2pt(q.h), borderColor: RED, borderWidth: 1 });
    const t = PRINTED_FIXED.qr_unsigned.es;
    const w = pdfFonts.medium.widthOfTextAtSize(t, 8);
    page.drawText(t, { x: mm2pt(q.x + q.w / 2) - w / 2, y: pdfY(q.y + q.h / 2), size: 8, font: pdfFonts.medium, color: RED });
    placeholderTexts.push(inp.qrProblem || t);
  }
  if (L.caption) draw(L.caption, C.ink);
  // Body, opt-out box, privacy block.
  L.body.forEach((l) => draw(l, C.ink));
  const fr = L.optout.frame;
  page.drawRectangle({ x: mm2pt(fr.x), y: pdfY(fr.y + fr.h), width: mm2pt(fr.w), height: mm2pt(fr.h), borderColor: C.ink, borderWidth: GEOM.optout.stroke });
  L.optout.lines.forEach((l) => draw(l, C.ink));
  L.privacy.forEach((l) => draw(l, C.ink));

  // Metadata: no address and no link in it. Fixed dates, so equal inputs give
  // equal bytes.
  const when = new Date(inp.createdAt);
  doc.setTitle("Carta Massage Club");
  doc.setAuthor("Massage Club");
  doc.setCreator(RENDERER_VERSION);
  doc.setProducer(RENDERER_VERSION);
  doc.setLanguage("es-ES");
  doc.setCreationDate(when);
  doc.setModificationDate(when);
  if (doc.getPageCount() !== 1) return { ok: false, error: { code: "page_count", message: "The letter must be exactly one page." } };
  const bytes: Uint8Array = await doc.save({ useObjectStreams: false });
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    ok: true,
    bytes,
    layout: {
      renderer: RENDERER_VERSION,
      sizes: L.sizes,
      line_counts: L.line_counts,
      placeholders: L.placeholders,
      placeholder_texts: placeholderTexts,
      body_space_left_mm: L.body_space_left_mm,
      boxes: L.boxes.map((b) => ({ id: b.id, kind: b.kind, x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h) })),
      qr: qrInfo,
      fonts: Object.values(FONT_NAMES),
      spectrum: inp.spectrum,
    },
  };
}
