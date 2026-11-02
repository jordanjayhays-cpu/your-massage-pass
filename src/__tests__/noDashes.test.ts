/**
 * House rule: no em dashes (U+2014), no en dashes (U+2013) and no spaced
 * hyphen used as a dash ("word - word") in anything a customer reads.
 *
 * Checked here:
 * - every string value of the 7 locale files the app loads;
 * - the string literals, template text and JSX text of FILES (comments are
 *   not checked, they never reach the page);
 * - for .html files: text, attribute values, inline scripts' strings and
 *   JSON-LD values (HTML comments and <style> are skipped).
 *
 * To cover another customer-facing file, add it to FILES. A path ending in
 * "/" covers every .ts/.tsx file in that folder.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const LOCALES = ["en", "es", "fr", "it", "pt", "de", "zh"] as const;

export const FILES: string[] = [
  "src/pages/HowItWorks.tsx",
  "src/pages/guides/",
  "src/pages/Web.tsx",
  "src/pages/Review.tsx",
  "src/pages/BookingResult.tsx",
  "src/app/screens/Login.tsx",
  "src/app/screens/Profile.tsx",
  "src/app/screens/MyBookings.tsx",
  "src/app/screens/Discovery.tsx",
  "src/app/data.ts",
  "src/components/DealsLink.tsx",
  "src/components/AccountOfferBlock.tsx",
  "src/app/components/MarketingOptInCard.tsx",
  // Added at integration (ux/batch-1):
  "index.html",
  "public/go.html",
  "src/app/screens/MassageList.tsx",
  "src/components/ConsentBanner.tsx",
  "src/app/screens/StudioBookingPage.tsx",
  // Added in the review fixes (2 Nov): /survey is linked from Login.
  "src/app/screens/Survey.tsx",
  "src/app/screens/SurveyCustomers.tsx",
  "src/app/screens/SurveyStudios.tsx",
];

const EM_EN = /[—–]/;
const SPACED_HYPHEN = /\p{L} - \p{L}/u;

/** Returns a short reason when the text breaks the rule, else null. */
export function dashProblem(text: string): string | null {
  if (text.includes("—")) return "em dash";
  if (text.includes("–")) return "en dash";
  if (SPACED_HYPHEN.test(text)) return "spaced hyphen";
  return null;
}

function walkJsonStrings(value: unknown, at: string, out: { where: string; text: string }[]) {
  if (typeof value === "string") out.push({ where: at, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => walkJsonStrings(v, `${at}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkJsonStrings(v, at ? `${at}.${k}` : k, out);
  }
}

/** String literals, template text and JSX text of a JS/TS source. Comments are not nodes, so they are skipped. */
export function codeStrings(source: string, fileName: string): { line: number; text: string }[] {
  const kind = fileName.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : fileName.endsWith(".ts")
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const out: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      text = node.text;
    } else if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces) {
      text = node.getText(sf).replace(/\s+/g, " ");
    }
    if (text) {
      out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Customer-visible text of an HTML file: text, attribute values, inline script strings, JSON-LD. */
export function htmlStrings(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const lineAt = (idx: number) => source.slice(0, idx).split("\n").length;
  // Blank out comments and styles, keeping offsets so line numbers stay right.
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let html = source.replace(/<!--[\s\S]*?-->/g, blank);
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank);
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (whole, attrs: string, body: string, idx: number) => {
    const bodyStart = idx + whole.indexOf(">") + 1;
    const base = lineAt(bodyStart) - 1;
    if (/application\/ld\+json/i.test(attrs)) {
      const found: { where: string; text: string }[] = [];
      try {
        walkJsonStrings(JSON.parse(body), "", found);
      } catch {
        found.push({ where: "", text: body });
      }
      for (const f of found) out.push({ line: base + 1, text: f.text });
    } else {
      for (const s of codeStrings(body, "inline.js")) out.push({ line: base + s.line, text: s.text });
    }
    return blank(whole);
  });
  for (const m of html.matchAll(/>([^<]+)</g)) {
    if (m[1].trim()) out.push({ line: lineAt(m.index ?? 0), text: m[1].replace(/\s+/g, " ") });
  }
  for (const m of html.matchAll(/\s[\w:-]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const v = m[1] ?? m[2] ?? "";
    if (v) out.push({ line: lineAt(m.index ?? 0), text: v });
  }
  return out;
}

function expandFiles(entries: string[]): string[] {
  return entries.flatMap((entry) => {
    const abs = path.join(ROOT, entry);
    if (entry.endsWith("/")) {
      return fs
        .readdirSync(abs)
        .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
        .sort()
        .map((f) => path.posix.join(entry, f));
    }
    return [entry];
  });
}

describe("no em dashes, en dashes or spaced hyphens in customer copy", () => {
  for (const lang of LOCALES) {
    it(`src/i18n/${lang}.json`, () => {
      const json = JSON.parse(fs.readFileSync(path.join(ROOT, "src/i18n", `${lang}.json`), "utf8"));
      const found: { where: string; text: string }[] = [];
      walkJsonStrings(json, "", found);
      const bad = found
        .map((f) => ({ ...f, why: dashProblem(f.text) }))
        .filter((f) => f.why)
        .map((f) => `${f.where} (${f.why}): ${f.text}`);
      expect(bad).toEqual([]);
    });
  }

  for (const rel of expandFiles(FILES)) {
    it(rel, () => {
      const abs = path.join(ROOT, rel);
      expect(fs.existsSync(abs), `${rel} is listed in FILES but does not exist`).toBe(true);
      const src = fs.readFileSync(abs, "utf8");
      const strings = rel.endsWith(".html") ? htmlStrings(src) : codeStrings(src, rel);
      const bad = strings
        .map((s) => ({ ...s, why: dashProblem(s.text) }))
        .filter((s) => s.why)
        .map((s) => `${rel}:${s.line} (${s.why}): ${s.text.trim().slice(0, 140)}`);
      expect(bad).toEqual([]);
    });
  }
});

/**
 * House rules beyond dashes (CLAUDE.md): never "instant" booking or
 * confirmation (nothing is booked until the customer taps Yes), and never a
 * detox, toxin or immunity claim.
 */
const BANNED: Array<[RegExp, string]> = [
  [/\binstant(ly)?\s+(confirm|book)/i, "instant"],
  [/\b(confirm\w*|book\w*)\s+(instantly|right away|immediately)\b/i, "instant"],
  [/\b(confirm\w*|reserv\w*)\s+(al instante|inmediatamente|de inmediato)/i, "al instante"],
  [/confirmaci[oó]n (inmediata|instant[aá]nea|al instante)/i, "al instante"],
  [/\bdetox|desintox/i, "detox"],
  [/\btoxin/i, "toxin"],
  [/\bboosts? (your )?immun|sistema inmun/i, "immunity"],
];
/** Files that may name a claim to debunk it ("Releases toxins" is a myth). */
const BANNED_ALLOW: Record<string, string[]> = {
  "src/pages/guides/IsMassageGoodForYou.tsx": ["detox", "toxin", "immunity"],
};
export function bannedProblem(text: string, allow: string[] = []): string | null {
  for (const [re, why] of BANNED) if (!allow.includes(why) && re.test(text)) return why;
  return null;
}

describe("no instant-booking or detox claims in customer copy", () => {
  for (const lang of LOCALES) {
    it(`src/i18n/${lang}.json`, () => {
      const json = JSON.parse(fs.readFileSync(path.join(ROOT, "src/i18n", `${lang}.json`), "utf8"));
      const found: { where: string; text: string }[] = [];
      walkJsonStrings(json, "", found);
      // partner.* keys are the studio portal, not customer copy.
      const bad = found
        .filter((f) => !f.where.startsWith("partner."))
        .map((f) => ({ ...f, why: bannedProblem(f.text) }))
        .filter((f) => f.why)
        .map((f) => `${f.where} (${f.why}): ${f.text}`);
      expect(bad).toEqual([]);
    });
  }
  for (const rel of expandFiles(FILES)) {
    it(rel, () => {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      const strings = rel.endsWith(".html") ? htmlStrings(src) : codeStrings(src, rel);
      const bad = strings
        .map((s) => ({ ...s, why: bannedProblem(s.text, BANNED_ALLOW[rel]) }))
        .filter((s) => s.why)
        .map((s) => `${rel}:${s.line} (${s.why}): ${s.text.trim().slice(0, 140)}`);
      expect(bad).toEqual([]);
    });
  }
  it("catches the claims it is for", () => {
    expect(bannedProblem("Instant confirmation")).toBe("instant");
    expect(bannedProblem("Confirmación al instante")).toBe("al instante");
    expect(bannedProblem("Your time is confirmed right away.")).toBe("instant");
    expect(bannedProblem("Passer pour l'instant")).toBeNull();
    expect(bannedProblem("Detox feeling")).toBe("detox");
    expect(bannedProblem("Releases toxins")).toBe("toxin");
    expect(bannedProblem("Nothing is booked until you tap Yes.")).toBeNull();
  });
});

describe("the dash check itself", () => {
  it("catches each kind and ignores comments, code and plain hyphens", () => {
    expect(dashProblem("Pay at the studio — no fee")).toBe("em dash");
    expect(dashProblem("€50–€85")).toBe("en dash");
    expect(dashProblem("Almost done - send it")).toBe("spaced hyphen");
    expect(dashProblem("10-13 and 60-90 min, re-book, 2 - 3")).toBeNull();

    const src = [
      "// a comment — is fine",
      "/* block — comment */",
      "const n = a - b;",
      'const ok = "Pay at the studio. No fee";',
      'const bad = "Pay — here";',
      "const el = <p>Text - more</p>;",
    ].join("\n");
    const hits = codeStrings(src, "x.tsx").filter((s) => dashProblem(s.text));
    expect(hits.map((h) => h.line)).toEqual([5, 6]);

    const html = [
      "<!-- comment — ok -->",
      "<title>Massage Club — Madrid</title>",
      '<meta name="description" content="Fine. Text">',
      "<style>a::after{content:'—'}</style>",
      '<script>const T = { a: "one – two" }; // note — ok</script>',
    ].join("\n");
    const htmlHits = htmlStrings(html).filter((s) => dashProblem(s.text));
    expect(htmlHits.map((h) => h.line)).toEqual([5, 2]);
  });
});
