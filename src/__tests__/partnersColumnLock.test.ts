/**
 * Guard for the partners column lock (24 Nov 2026, Jordan: "Yes, close it
 * now"). Migration 20261124e_partners_column_lock.sql lets the public key and
 * signed-in studios read only PARTNER_PUBLIC_COLUMN_LIST and write only its
 * INSERT/UPDATE list. Anything else on partners fails with 42501 on the live
 * site, so this test fails first, here:
 *
 * - every .from("partners") chain in src/ selects named columns (or
 *   PARTNER_PUBLIC_COLUMNS), never "*" or nothing, and filters only on
 *   readable columns;
 * - every write to partners uses only granted columns;
 * - embedded partners(...) joins and public/*.html REST reads name readable
 *   columns only;
 * - the column list in src/lib/partnerColumns.ts and the GRANTs in the
 *   migration are the same, and no secret column is in either.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { PARTNER_PUBLIC_COLUMN_LIST } from "@/lib/partnerColumns";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCK = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261124e_partners_column_lock.sql"), "utf8");

const SECRETS = [
  "claim_token", "hours_token", "hours_code", "google_calendar_id",
  "google_access_token", "google_refresh_token", "google_token_expiry",
];

function grantList(kind: "select" | "insert" | "update"): string[] {
  const re = kind === "select"
    ? /grant select \(([^)]*)\) on public\.partners to anon, authenticated;/
    : kind === "insert" ? /grant insert \(([^)]*)\), update/ : /\), update \(([^)]*)\) on public\.partners to authenticated;/;
  const m = LOCK.match(re);
  if (!m) throw new Error(`no ${kind} grant found in the lock migration`);
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

const READABLE = new Set(grantList("select"));
const WRITABLE = new Set(grantList("insert"));

function filesUnder(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__" && e.name !== "test") out.push(...filesUnder(rel, exts)); }
    else if (exts.some((x) => e.name.endsWith(x)) && !/\.(test|spec)\./.test(e.name)) out.push(rel);
  }
  return out;
}

/** Top-level comma split of a PostgREST select string; embedded resources dropped. */
function selectColumns(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of sel) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts
    .map((p) => p.trim())
    .filter((p) => p && !p.includes("("))
    .map((p) => p.replace(/^[a-z_0-9]+:(?!:)/i, "").replace(/::\w+$/, "").trim());
}

type Finding = { where: string; problem: string };

const FILTERS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "containedBy", "order", "not", "filter", "match", "textSearch"]);

function unwrap(node: ts.Expression): ts.Expression {
  let n = node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n)) n = n.expression;
  return n;
}

function literal(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  // `a, b${x ? ", c" : ""}, partners!inner ( d )`: the fixed text is enough here.
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => s.literal.text).join("");
  // StudioPipeline wraps its list: select(sel("a, b"))
  if (ts.isCallExpression(node) && node.arguments.length === 1) return literal(node.arguments[0]);
  return null;
}

/** Every value a column/select argument can take: both branches of `c ? "a" : "b"`. Null if any is not literal. */
function literals(node: ts.Node | undefined): string[] | null {
  if (!node) return null;
  const n = ts.isExpression(node) ? unwrap(node) : node;
  if (ts.isConditionalExpression(n)) {
    const a = literals(n.whenTrue), b = literals(n.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  const s = literal(n);
  return s === null ? null : [s];
}

/**
 * Keys an object literal payload writes. Returns false when some keys cannot
 * be known here (a spread of a variable, a computed key): the caller then
 * treats the write as unresolved instead of letting it pass.
 */
function objectKeys(node: ts.Expression, out: string[]): boolean {
  const n = unwrap(node);
  if (ts.isConditionalExpression(n)) return objectKeys(n.whenTrue, out) && objectKeys(n.whenFalse, out);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return objectKeys(n.right, out);
  if (!ts.isObjectLiteralExpression(n)) return false;
  let ok = true;
  for (const p of n.properties) {
    if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
      if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) out.push(p.name.text);
      else ok = false;
    } else if (ts.isSpreadAssignment(p)) {
      if (!objectKeys(p.expression, out)) ok = false;
    } else ok = false;
  }
  return ok;
}

/** insert/update/upsert payload: an object literal, or an array literal of them. */
function payloadKeys(node: ts.Expression | undefined, out: string[]): boolean {
  if (!node) return false;
  const n = unwrap(node);
  if (ts.isArrayLiteralExpression(n)) return n.elements.length > 0 && n.elements.every((e) => !ts.isSpreadElement(e) && payloadKeys(e, out));
  return objectKeys(n, out);
}

function scanSource(rel: string, source: string, findings: Finding[], unresolvedWrites: string[]): number {
  const kind = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, kind);
  let chains = 0;
  const at = (n: ts.Node) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

  const visit = (node: ts.Node) => {
    // Embedded joins on other tables: select("..., partners ( a, b ), ...")
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "select") {
      const s = literal(node.arguments[0]);
      if (s) {
        for (const m of s.matchAll(/\bpartners(?:![a-z_]+)?\s*\(((?:[^()]|\([^()]*\))*)\)/g)) {
          for (const c of selectColumns(m[1])) {
            if (c === "*" || !READABLE.has(c)) findings.push({ where: at(node), problem: `embedded partners(${c}) is not readable` });
          }
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "from" && literal(node.arguments[0]) === "partners") {
      chains++;
      let selected = false, wrote = false;
      let cur: ts.Node = node;
      while (ts.isPropertyAccessExpression(cur.parent) && ts.isCallExpression(cur.parent.parent) && cur.parent.parent.expression === cur.parent) {
        const method = cur.parent.name.text;
        const call = cur.parent.parent;
        const arg0 = call.arguments[0];
        if (method === "select") {
          selected = true;
          if (!arg0) findings.push({ where: at(call), problem: "select() with no columns is select *" });
          else if (ts.isIdentifier(arg0) && arg0.text === "PARTNER_PUBLIC_COLUMNS") { /* checked below */ }
          else {
            const all = literals(arg0);
            if (all === null) findings.push({ where: at(call), problem: "select() argument must be a literal list or PARTNER_PUBLIC_COLUMNS" });
            else for (const s of all) for (const c of selectColumns(s)) {
              if (c === "*" || !READABLE.has(c)) findings.push({ where: at(call), problem: `select of "${c}" is not readable` });
            }
          }
        } else if (method === "insert" || method === "update" || method === "upsert") {
          wrote = true;
          const keys: string[] = [];
          const known = payloadKeys(arg0, keys);
          for (const k of keys) if (!WRITABLE.has(k)) findings.push({ where: at(call), problem: `${method} of "${k}" is not granted` });
          if (!known) unresolvedWrites.push(`${rel}:${method}(${arg0 ? arg0.getText(sf) : ""})`);
        } else if (method === "delete") {
          findings.push({ where: at(call), problem: "delete on partners is not granted" });
        } else if (FILTERS.has(method)) {
          const cols = literals(arg0);
          if (cols === null) unresolvedWrites.push(`${rel}:${method}(${arg0 ? arg0.getText(sf) : ""})`);
          else for (const col of cols) {
            if (!READABLE.has(col)) findings.push({ where: at(call), problem: `${method}("${col}") filters on a column that is not readable` });
          }
        } else if (method === "or") {
          const all = literals(arg0);
          if (all === null) unresolvedWrites.push(`${rel}:or(${arg0 ? arg0.getText(sf) : ""})`);
          else for (const s of all) for (const part of s.split(",")) {
            const col = part.trim().replace(/^(and|or|not)\(/, "").split(".")[0];
            if (col && !READABLE.has(col)) findings.push({ where: at(call), problem: `or() filters on "${col}"` });
          }
        }
        cur = call;
      }
      if (!selected && !wrote) findings.push({ where: at(node), problem: "partners chain with neither select nor write" });
      // A query builder kept in a variable, or returned, gets more filters or
      // writes elsewhere that this walk cannot see.
      let up: ts.Node = cur.parent;
      while (ts.isParenthesizedExpression(up) || ts.isAsExpression(up) || ts.isNonNullExpression(up)) up = up.parent;
      if (ts.isVariableDeclaration(up) || ts.isReturnStatement(up) || ts.isArrowFunction(up) || ts.isPropertyAssignment(up)
          || (ts.isBinaryExpression(up) && up.operatorToken.kind === ts.SyntaxKind.EqualsToken)) {
        unresolvedWrites.push(`${rel}:partners query builder kept in a variable or returned`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return chains;
}

describe("partners column lock", () => {
  it("the site's column list is exactly the migration's SELECT grant, with no secret", () => {
    expect([...PARTNER_PUBLIC_COLUMN_LIST].sort()).toEqual([...READABLE].sort());
    for (const s of SECRETS) {
      expect(READABLE.has(s)).toBe(false);
      expect(WRITABLE.has(s)).toBe(false);
    }
    expect(grantList("update").sort()).toEqual([...WRITABLE].sort());
  });

  it("the lock migration's self-check arrays match its GRANTs", () => {
    const arr = (name: string) => {
      const m = LOCK.match(new RegExp(`${name} text\\[\\] := array\\[([^\\]]*)\\]`));
      if (!m) throw new Error(`no ${name} array`);
      return [...m[1].matchAll(/'([a-z_0-9]+)'/g)].map((x) => x[1]).sort();
    };
    expect(arr("readable")).toEqual([...READABLE].sort());
    expect(arr("writable")).toEqual([...WRITABLE].sort());
    for (const s of SECRETS) expect(arr("hidden")).toContain(s);
    expect(arr("hidden").filter((h) => READABLE.has(h))).toEqual([]);
  });

  it("every partners read and write in src/ uses granted columns only", () => {
    const findings: Finding[] = [];
    const unresolved: string[] = [];
    let chains = 0;
    for (const rel of filesUnder("src", [".ts", ".tsx"])) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (!src.includes("partners")) continue;
      chains += scanSource(rel, src, findings, unresolved);
    }
    expect(chains).toBeGreaterThan(30);
    expect(findings).toEqual([]);
    // Writes whose payload is a variable cannot be checked here. Each one is
    // listed with the columns it writes; add a new one only after checking it.
    expect(unresolved).toEqual([
      // profileForm: business_name, address, phone, website, description
      "src/app/screens/StudioPortal.tsx:update(profileForm)",
    ]);
  });

  it("the site never asks for a claim token or runs a service-role claim function", () => {
    // claim_token_for_slug handed out claim tokens (never live); since
    // 20261124d claim_release_prebuilt is service role only and signed-in
    // studios use claim_release_verified, which needs proof of the email.
    const findings: string[] = [];
    for (const rel of [...filesUnder("src", [".ts", ".tsx"]), ...filesUnder("public", [".html", ".js"])]) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      for (const fn of ["claim_token_for_slug", "claim_release_prebuilt"]) {
        if (src.includes(fn)) findings.push(`${rel}: ${fn}`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("public/*.html REST reads of partners name readable columns only", () => {
    const findings: string[] = [];
    for (const rel of filesUnder("public", [".html", ".js"])) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      for (const m of src.matchAll(/rest\/v1\/partners\?([^`'"\s]*)/g)) {
        const sel = /(?:^|&)select=([^&$]*)/.exec(m[1]);
        if (!sel) { findings.push(`${rel}: partners REST read without select= (that is select *)`); continue; }
        for (const c of decodeURIComponent(sel[1]).split(",").map((s) => s.trim())) {
          if (c === "*" || !READABLE.has(c)) findings.push(`${rel}: select of "${c}"`);
        }
      }
      for (const s of SECRETS) if (src.includes(s)) findings.push(`${rel}: mentions ${s}`);
    }
    expect(findings).toEqual([]);
  });
});
