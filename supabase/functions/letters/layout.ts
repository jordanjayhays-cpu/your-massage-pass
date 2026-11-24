// Letters (17 Nov 2026): page geometry and the fit algorithm (spec 9.3, 9.4).
// Pure maths over injected font metrics, so Node tests run it without a PDF
// library. All positions are millimetres from the top-left corner of the A4
// page; widths of text are measured in points and converted.
//
// Pingen's left-window rules (help.pingen.com, read 17 Nov):
//   postage area  20 mm from the left, 40 mm from the top, 89.5 x 47.5 mm:
//                 nothing in it but the address
//   address area  22 mm from the left, 60 mm from the top, 85.5 x 25.5 mm
//   restricted    5 mm from every edge, and 15 mm in the bottom-left corner
// The text never shrinks below the last step and is never clipped: it either
// fits or the letter fails with text_too_long / address_too_long.

import type { Run, Style } from "./rules.ts";

export const PT_PER_MM = 72 / 25.4;
export const mm2pt = (mm: number): number => mm * PT_PER_MM;
export const pt2mm = (pt: number): number => pt / PT_PER_MM;
export const PAGE = { w: 210, h: 297, wPt: 595.28, hPt: 841.89 };
// PDF y (points from the bottom) of a top-left millimetre y.
export const pdfY = (mmFromTop: number): number => PAGE.hPt - mm2pt(mmFromTop);

export type Rect = { x: number; y: number; w: number; h: number };
export type Box = Rect & { id: string; kind: "text" | "address" | "qr" | "frame"; group: string };

export const ZONES = {
  printable: { x: 5, y: 5, w: 200, h: 287 } as Rect,
  bottomLeft: { x: 0, y: 282, w: 15, h: 15 } as Rect,
  postage: { x: 20, y: 40, w: 89.5, h: 47.5 } as Rect,
  address: { x: 22, y: 60, w: 85.5, h: 25.5 } as Rect,
};

export const GEOM = {
  wordmark: { x: 20, baseline: 21, size: 20 },
  tagline: { x: 20, baseline: 27.5, size: 9 },
  sender: { right: 190, baselines: [14, 18.5, 23, 27.5, 32], size: 8.5 },
  address: { x: 24, top: 62, maxW: 81.5, maxH: 21.5, sizes: [10, 9.5, 9], leadingFactor: 1.2 },
  qr: { x: 160, y: 46, w: 30, h: 30, quietModules: 4 },
  qrCaption: { cx: 175, baseline: 80.5, size: 8 },
  body: { x: 20, w: 170, top: 97, steps: [[10.5, 15], [10, 14.4], [9.5, 13.7], [9, 13]] as [number, number][], gapFactor: 0.6, bulletIndent: 5 },
  optout: { x: 20, w: 170, gapAbovePrivacy: 4, pad: 2.5, size: 8.5, leading: 11, stroke: 0.6 },
  privacy: { x: 20, w: 170, bottom: 287, steps: [[6.8, 8.6], [6.3, 8.0]] as [number, number][], gapFactor: 0.4 },
  bodyGapAboveBox: 6,
  minAddressInset: 1,
  minQrGapRightOfPostage: 2.5,
};

export type Metrics = { width(text: string, size: number): number; ascent(size: number): number; descent(size: number): number };
export type FontKey = "regular" | "medium" | "address" | "wordmark";
export type FontSet = Record<FontKey, Metrics>;
export type Seg = { text: string; font: FontKey; style: Style; dx: number };
export type PlacedLine = { x: number; baseline: number; size: number; segs: Seg[]; widthPt: number };
export type HardLine = { runs: Run[]; bullet: boolean };
export type Para = HardLine[];
export type Fail = { code: "text_too_long" | "address_too_long" | "word_too_long"; message: string; overflow_mm?: number };

const fontOf = (s: Style): FontKey => (s === "regular" ? "regular" : "medium");

// Splits merged runs into paragraphs (blank line) and hard lines (single line
// break). A hard line starting with "• " is a bullet with a hanging indent.
export function parseParas(runs: Run[]): Para[] {
  const lines: Run[][] = [[]];
  for (const r of runs) {
    const parts = r.text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ text: p, style: r.style });
    });
  }
  const paras: Para[] = [];
  let cur: Para = [];
  for (const l of lines) {
    const text = l.map((r) => r.text).join("");
    if (!text.trim()) { if (cur.length) { paras.push(cur); cur = []; } continue; }
    let bullet = false;
    const runsOut = l.map((r) => ({ ...r }));
    const lead = text.match(/^\s*•\s+/);
    if (lead) {
      bullet = true;
      let cut = lead[0].length;
      while (cut > 0 && runsOut.length) {
        const r = runsOut[0];
        if (r.text.length <= cut) { cut -= r.text.length; runsOut.shift(); } else { r.text = r.text.slice(cut); cut = 0; }
      }
    }
    cur.push({ runs: runsOut, bullet });
  }
  if (cur.length) paras.push(cur);
  return paras;
}

// The first sentence (up to the first "?" or "." followed by a space) in the
// medium weight: "¿No queréis recibir más cartas?", "Protección de datos."
export function withLead(runs: Run[]): Run[] {
  const first = runs[0];
  if (!first || first.style !== "regular") return runs;
  const m = first.text.match(/^.*?[?.](?=\s)/);
  if (!m) return runs;
  return [{ text: m[0], style: "medium" }, { text: first.text.slice(m[0].length), style: "regular" }, ...runs.slice(1)];
}

type Piece = { text: string; style: Style };
type Word = { pieces: Piece[]; widthPt: number };

function words(runs: Run[], fonts: FontSet, size: number): Word[] {
  const out: Word[] = [];
  let cur: Piece[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ pieces: cur, widthPt: cur.reduce((a, p) => a + fonts[fontOf(p.style)].width(p.text, size), 0) });
    cur = [];
  };
  for (const r of runs) {
    for (const ch of r.text) {
      if (ch === " " || ch === "\t" || ch === "\n") { flush(); continue; }
      const last = cur[cur.length - 1];
      if (last && last.style === r.style) last.text += ch;
      else cur.push({ text: ch, style: r.style });
    }
  }
  flush();
  return out;
}

// Greedy word wrap. Returns line segments (consecutive pieces of one style
// merged, spaces included) with their x offsets in points.
export function wrapRuns(runs: Run[], fonts: FontSet, size: number, maxWidthPt: number): { lines: { segs: Seg[]; widthPt: number }[]; error?: Fail } {
  const ws = words(runs, fonts, size);
  const lines: { segs: Seg[]; widthPt: number }[] = [];
  let line: Word[] = [];
  let width = 0;
  const spaceAfter = (w: Word) => fonts[fontOf(w.pieces[w.pieces.length - 1].style)].width(" ", size);
  const emit = () => {
    if (!line.length) return;
    const segs: Seg[] = [];
    line.forEach((w, wi) => {
      w.pieces.forEach((p, pi) => {
        const sep = wi > 0 && pi === 0 ? " " : "";
        const last = segs[segs.length - 1];
        if (last && last.style === p.style) last.text += sep + p.text;
        else {
          if (sep && last) last.text += sep;
          segs.push({ text: p.text, font: fontOf(p.style), style: p.style, dx: 0 });
        }
      });
    });
    // Offsets from the final segment texts (kerning is off, so these are the
    // drawn widths).
    let x = 0;
    for (const s of segs) { s.dx = x; x += fonts[s.font].width(s.text, size); }
    lines.push({ segs, widthPt: x });
    line = []; width = 0;
  };
  for (const w of ws) {
    if (w.widthPt > maxWidthPt) {
      return { lines, error: { code: "word_too_long", message: `"${w.pieces.map((p) => p.text).join("")}" is wider than the column.` } };
    }
    const add = line.length ? spaceAfter(line[line.length - 1]) + w.widthPt : w.widthPt;
    if (line.length && width + add > maxWidthPt) { emit(); line = [w]; width = w.widthPt; continue; }
    line.push(w); width += add;
  }
  emit();
  return { lines };
}

// Lays paragraphs out top-down from topMm. The first baseline sits one ascent
// below the top; lines are `leading` apart; paragraphs get gapFactor x
// leading extra. Returns the bottom (last baseline + descent).
export function layoutParas(paras: Para[], fonts: FontSet, o: { size: number; leading: number; x: number; w: number; top: number; gapFactor: number; bulletIndent?: number }): { lines: PlacedLine[]; bottom: number; error?: Fail } {
  const lines: PlacedLine[] = [];
  const reg = fonts.regular;
  const lead = pt2mm(o.leading);
  let baseline = o.top + pt2mm(reg.ascent(o.size));
  let first = true;
  for (const para of paras) {
    if (!first) baseline += lead * o.gapFactor;
    for (const hl of para) {
      const indentPt = hl.bullet ? mm2pt(o.bulletIndent ?? 5) : 0;
      const wr = wrapRuns(hl.runs, fonts, o.size, mm2pt(o.w) - indentPt);
      if (wr.error) return { lines, bottom: baseline, error: wr.error };
      wr.lines.forEach((l, i) => {
        if (!first) baseline += lead;
        first = false;
        const segs = l.segs.map((s) => ({ ...s, dx: s.dx + indentPt }));
        if (hl.bullet && i === 0) segs.unshift({ text: "•", font: "regular", style: "regular", dx: 0 });
        lines.push({ x: o.x, baseline, size: o.size, segs, widthPt: l.widthPt + indentPt });
      });
    }
  }
  const bottom = lines.length ? baseline + pt2mm(reg.descent(o.size)) : o.top;
  return { lines, bottom };
}

function paraHeight(paras: Para[], fonts: FontSet, size: number, leading: number, w: number, gapFactor: number): { h: number; error?: Fail } {
  const r = layoutParas(paras, fonts, { size, leading, x: 0, w, top: 0, gapFactor });
  return { h: r.bottom, error: r.error };
}

export type LetterLayout = {
  sizes: { body: number; bodyLeading: number; privacy: number; privacyLeading: number; optout: number; address: number };
  header: PlacedLine[];
  sender: PlacedLine[];
  caption: PlacedLine | null;
  address: PlacedLine[];
  body: PlacedLine[];
  optout: { lines: PlacedLine[]; frame: Rect };
  privacy: PlacedLine[];
  qr: Rect;
  boxes: Box[];
  placeholders: number;
  line_counts: { body: number; optout: number; privacy: number; address: number };
  body_space_left_mm: number;
};

export type FitInput = {
  fonts: FontSet;
  body: Run[];
  optout: Run[];
  privacy: Run[];
  addressLines: string[];
  senderLines: string[];
  wordmark: string;
  tagline: string;
  caption: string;
  qrPlaceholder?: boolean;
};

const textBox = (id: string, group: string, kind: "text" | "address", l: PlacedLine, fonts: FontSet, font: FontKey = "regular"): Box => {
  const m = fonts[font];
  const asc = pt2mm(m.ascent(l.size)), desc = pt2mm(m.descent(l.size));
  const minDx = Math.min(...l.segs.map((s) => s.dx));
  return { id, group, kind, x: l.x + pt2mm(minDx), y: l.baseline - asc, w: pt2mm(l.widthPt - minDx), h: asc + desc };
};

export function fitLetter(inp: FitInput): { ok: true; layout: LetterLayout } | { ok: false; error: Fail } {
  const f = inp.fonts;
  const boxes: Box[] = [];

  // Header: wordmark, tagline, sender block (right-aligned), QR and caption.
  const header: PlacedLine[] = [];
  const wm = { x: GEOM.wordmark.x, baseline: GEOM.wordmark.baseline, size: GEOM.wordmark.size, segs: [{ text: inp.wordmark, font: "wordmark" as FontKey, style: "regular" as Style, dx: 0 }], widthPt: f.wordmark.width(inp.wordmark, GEOM.wordmark.size) };
  const tg = { x: GEOM.tagline.x, baseline: GEOM.tagline.baseline, size: GEOM.tagline.size, segs: [{ text: inp.tagline, font: "regular" as FontKey, style: "regular" as Style, dx: 0 }], widthPt: f.regular.width(inp.tagline, GEOM.tagline.size) };
  header.push(wm, tg);
  boxes.push(textBox("wordmark", "wordmark", "text", wm, f, "wordmark"), textBox("tagline", "tagline", "text", tg, f));
  const sender: PlacedLine[] = inp.senderLines.map((t, i) => {
    const font: FontKey = i === 0 ? "medium" : "regular";
    const w = f[font].width(t, GEOM.sender.size);
    return { x: GEOM.sender.right - pt2mm(w), baseline: GEOM.sender.baselines[i], size: GEOM.sender.size, segs: [{ text: t, font, style: (i === 0 ? "medium" : "regular") as Style, dx: 0 }], widthPt: w };
  });
  if (inp.senderLines.length > GEOM.sender.baselines.length) throw new Error("too many sender lines");
  sender.forEach((l, i) => boxes.push(textBox(`sender${i}`, "sender", "text", l, f, i === 0 ? "medium" : "regular")));
  const qr: Rect = { x: GEOM.qr.x, y: GEOM.qr.y, w: GEOM.qr.w, h: GEOM.qr.h };
  boxes.push({ id: "qr", group: "qr", kind: "qr", ...qr });
  let caption: PlacedLine | null = null;
  if (inp.caption) {
    const w = f.medium.width(inp.caption, GEOM.qrCaption.size);
    caption = { x: GEOM.qrCaption.cx - pt2mm(w) / 2, baseline: GEOM.qrCaption.baseline, size: GEOM.qrCaption.size, segs: [{ text: inp.caption, font: "medium", style: "regular", dx: 0 }], widthPt: w };
    boxes.push(textBox("qr_caption", "qr_caption", "text", caption, f, "medium"));
  }

  // Address: one line per address line, never wrapped; steps 10, 9.5, 9 pt.
  let address: PlacedLine[] | null = null;
  let addressSize = 0;
  for (const size of GEOM.address.sizes) {
    const leading = pt2mm(size * GEOM.address.leadingFactor);
    const asc = pt2mm(f.address.ascent(size)), desc = pt2mm(f.address.descent(size));
    const widths = inp.addressLines.map((l) => f.address.width(l, size));
    const height = asc + (inp.addressLines.length - 1) * leading + desc;
    if (widths.every((w) => pt2mm(w) <= GEOM.address.maxW) && height <= GEOM.address.maxH) {
      address = inp.addressLines.map((t, i) => ({ x: GEOM.address.x, baseline: GEOM.address.top + asc + i * leading, size, segs: [{ text: t, font: "address", style: "regular", dx: 0 }], widthPt: widths[i] }));
      addressSize = size;
      break;
    }
  }
  if (!address) return { ok: false, error: { code: "address_too_long", message: `The address does not fit the envelope window even at ${GEOM.address.sizes[GEOM.address.sizes.length - 1]} pt (at most ${GEOM.address.maxW} mm wide and ${GEOM.address.maxH} mm tall).` } };
  address.forEach((l, i) => boxes.push(textBox(`address${i}`, "address", "address", l, f, "address")));

  // Bottom-up: privacy, then the opt-out box, then the body from the top.
  const bodyParas = parseParas(inp.body);
  const optParas = parseParas(withLead(inp.optout));
  const privParas = parseParas(withLead(inp.privacy));
  const O = GEOM.optout, P = GEOM.privacy, B = GEOM.body;
  let lastOverflow = 0;
  for (const [psize, plead] of P.steps) {
    const ph = paraHeight(privParas, f, psize, plead, P.w, P.gapFactor);
    if (ph.error) return { ok: false, error: ph.error };
    const privTop = P.bottom - ph.h;
    const privacy = layoutParas(privParas, f, { size: psize, leading: plead, x: P.x, w: P.w, top: privTop, gapFactor: P.gapFactor });
    const oh = paraHeight(optParas, f, O.size, O.leading, O.w - 2 * O.pad, 0.4);
    if (oh.error) return { ok: false, error: oh.error };
    const boxBottom = privTop - O.gapAbovePrivacy;
    const boxTop = boxBottom - oh.h - 2 * O.pad;
    const optout = layoutParas(optParas, f, { size: O.size, leading: O.leading, x: O.x + O.pad, w: O.w - 2 * O.pad, top: boxTop + O.pad, gapFactor: 0.4 });
    const bodyLimit = boxTop - GEOM.bodyGapAboveBox;
    for (const [bsize, blead] of B.steps) {
      const body = layoutParas(bodyParas, f, { size: bsize, leading: blead, x: B.x, w: B.w, top: B.top, gapFactor: B.gapFactor, bulletIndent: B.bulletIndent });
      if (body.error) return { ok: false, error: body.error };
      if (body.bottom > bodyLimit) { lastOverflow = body.bottom - bodyLimit; continue; }
      body.lines.forEach((l, i) => boxes.push(textBox(`body${i}`, "body", "text", l, f)));
      const frame: Rect = { x: O.x, y: boxTop, w: O.w, h: boxBottom - boxTop };
      boxes.push({ id: "optout_frame", group: "optout", kind: "frame", ...frame });
      optout.lines.forEach((l, i) => boxes.push(textBox(`optout${i}`, "optout", "text", l, f)));
      privacy.lines.forEach((l, i) => boxes.push(textBox(`privacy${i}`, "privacy", "text", l, f)));
      const all = [...header, ...sender, ...(caption ? [caption] : []), ...body.lines, ...optout.lines, ...privacy.lines];
      const placeholders = all.reduce((a, l) => a + l.segs.filter((s) => s.style === "missing").length, 0) + (inp.qrPlaceholder ? 1 : 0);
      return {
        ok: true,
        layout: {
          sizes: { body: bsize, bodyLeading: blead, privacy: psize, privacyLeading: plead, optout: O.size, address: addressSize },
          header, sender, caption, address, body: body.lines, optout: { lines: optout.lines, frame }, privacy: privacy.lines, qr, boxes, placeholders,
          line_counts: { body: body.lines.length, optout: optout.lines.length, privacy: privacy.lines.length, address: address.length },
          body_space_left_mm: Math.round((bodyLimit - body.bottom) * 10) / 10,
        },
      };
    }
  }
  const over = Math.round(lastOverflow * 10) / 10;
  return { ok: false, error: { code: "text_too_long", message: `The letter is ${over} mm too long even at the smallest text size. Shorten the body or the privacy text.`, overflow_mm: over } };
}

const inside = (a: Rect, b: Rect, inset = 0): boolean => a.x >= b.x + inset - 1e-6 && a.y >= b.y + inset - 1e-6 && a.x + a.w <= b.x + b.w - inset + 1e-6 && a.y + a.h <= b.y + b.h - inset + 1e-6;
export const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

// The layout validator (9.4 step 5). Also run by the tests.
export function validateBoxes(boxes: Box[]): string[] {
  const errs: string[] = [];
  for (const b of boxes) {
    if (!inside(b, ZONES.printable)) errs.push(`${b.id} is outside the printable area`);
    if (intersects(b, ZONES.bottomLeft)) errs.push(`${b.id} is in the bottom-left restricted corner`);
    if (intersects(b, ZONES.postage)) {
      if (b.kind !== "address") errs.push(`${b.id} is inside the postage area (only the address may be there)`);
      else if (!inside(b, ZONES.address, GEOM.minAddressInset)) errs.push(`${b.id} is not inside the address area with ${GEOM.minAddressInset} mm to spare`);
    }
    if (b.kind === "address" && !inside(b, ZONES.address, GEOM.minAddressInset)) errs.push(`${b.id} is not inside the address area with ${GEOM.minAddressInset} mm to spare`);
    if (b.kind === "qr" && b.x < ZONES.postage.x + ZONES.postage.w + GEOM.minQrGapRightOfPostage) errs.push("the QR code is too close to the postage area");
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.group === b.group) continue;
      if (intersects(a, b)) errs.push(`${a.id} overlaps ${b.id}`);
    }
  }
  return errs;
}
