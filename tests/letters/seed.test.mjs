// Letters: the seed script (scripts/letters/seed_from_csv.mjs) with a
// synthetic CSV. It must refuse a missing CSV, refuse to write inside the
// repo, and write one transaction of INSERTs elsewhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listCsv, P1 } from "./_helpers.mjs";

const SCRIPT = fileURLToPath(new URL("../../scripts/letters/seed_from_csv.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const run = (args, env = {}) => spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, SCRATCHPAD: "", LETTERS_SEED_OUT: "", ...env } });

test("missing CSV: a clear message and no output", () => {
  const r = run([path.join(os.tmpdir(), "does-not-exist.csv"), path.join(os.tmpdir(), "x.sql")]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^CSV not found: regenerate the 15 Nov list first/);
});

test("refuses to write inside the repository", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "letters-seed-"));
  const csv = path.join(dir, "list.csv");
  fs.writeFileSync(csv, listCsv());
  const r = run([csv, path.join(REPO, "seed.sql")]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /inside the repository/);
  assert.equal(fs.existsSync(path.join(REPO, "seed.sql")), false);
  const r2 = run([csv, path.join(REPO, "supabase", "seed.sql")]);
  assert.equal(r2.status, 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("writes one transaction with every row, quotes escaped, a count check", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "letters-seed-"));
  const csv = path.join(dir, "list.csv");
  fs.writeFileSync(csv, listCsv().replace("Estudio Ficticio Alfa,Estudio Ficticio Alfa", "Estudio Ficticio Alfa,Estudio D'Alfa"));
  const out = path.join(dir, "seed.sql");
  const r = run([csv, out, "2026-11-15"]);
  assert.equal(r.status, 0, r.stderr);
  const sql = fs.readFileSync(out, "utf8");
  assert.match(sql, /^-- Letters mailing list 2026-11-15: 4 studios\./);
  assert.equal(sql.match(/^insert into public\.letter_recipients/gm).length, 4);
  assert.ok(sql.includes("'Estudio D''Alfa'"));
  assert.ok(sql.includes(`where p.id = '${P1}';`));
  assert.ok(sql.includes("array['Estudio D''Alfa', 'Calle Ejemplo 1, 2º B', '28004 Madrid']::text[]"));
  assert.match(sql, /^begin;$/m);
  assert.match(sql, /^commit;$/m);
  assert.match(sql, /expected 4 studios/);
  // Default output path comes from SCRATCHPAD.
  const r2 = run([csv], { SCRATCHPAD: dir });
  assert.equal(r2.status, 0, r2.stderr);
  assert.ok(fs.existsSync(path.join(dir, "letters-tool", "seed_letters_addresses.sql")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a bad row: nothing is written", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "letters-seed-"));
  const csv = path.join(dir, "list.csv");
  fs.writeFileSync(csv, listCsv() + "\nnot-an-id,X,X & Co,Calle 1,28004 Madrid,,,28004,Madrid,,high");
  const out = path.join(dir, "seed.sql");
  const r = run([csv, out]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Line 6/);
  assert.equal(fs.existsSync(out), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
