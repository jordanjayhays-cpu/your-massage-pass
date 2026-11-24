// Letters: the studio's signed /socios link printed as the QR
// (supabase/functions/letters/sign.ts), checked against an independent Node
// HMAC and against wa-bot's own construction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import fs from "node:fs";
import { socSig, socLinkFor, socRef, SOCIOS_URL_RE, relHmac, sha256Hex, secretEqual, constantTimeEqual, PROOF_QR_URL } from "../../supabase/functions/letters/sign.ts";

const KEY = "test-sign-key-not-a-real-one-0123456789";
const node = (key, kind, value) => createHmac("sha256", `${key}:${kind}`).update(value).digest("hex").slice(0, 24);

test("socSig equals an independent Node HMAC (first 12 bytes, hex)", async () => {
  const p = { id: "a1a1a1a1-0000-4000-8000-000000000001", slots_link_v: 3 };
  assert.equal(await socSig(KEY, p), node(KEY, "socios", `${p.id}:3`));
  assert.equal(await socSig(KEY, { id: p.id }), node(KEY, "socios", `${p.id}:1`));
  assert.equal(await socSig(KEY, { id: p.id, slots_link_v: null }), node(KEY, "socios", `${p.id}:1`));
  assert.equal(await relHmac("", "socios", "x"), "");
});

test("the construction matches wa-bot's relHmac and socSigValue", () => {
  const bot = fs.readFileSync(new URL("../../supabase/functions/wa-bot/bot.ts", import.meta.url), "utf8");
  assert.ok(bot.includes('new TextEncoder().encode(signKey + ":" + kind)'));
  assert.ok(bot.includes("mac.slice(0, 12)"));
  assert.ok(bot.includes("`${p.id}:${Number(p.slots_link_v || 1)}`"));
  assert.ok(bot.includes('return await relHmac(SIGN_KEY, "socios", socSigValue(p));'));
  assert.ok(bot.includes('const SOCIOS_PAGE = "https://book.massageclub.io/socios";'));
});

test("slug when it is well formed and unique, else the UUID", async () => {
  const p = { id: "A1A1A1A1-0000-4000-8000-000000000001", slug: "estudio-alfa", slots_link_v: 2 };
  assert.equal(socRef(p, 1), "estudio-alfa");
  assert.equal(socRef(p, 2), "a1a1a1a1-0000-4000-8000-000000000001");
  assert.equal(socRef({ ...p, slug: "Estudio Alfa" }, 1), "a1a1a1a1-0000-4000-8000-000000000001");
  assert.equal(socRef({ ...p, slug: null }, 0), "a1a1a1a1-0000-4000-8000-000000000001");
  const l = await socLinkFor(KEY, { ...p, id: p.id.toLowerCase() }, 1);
  assert.equal(l.ok, true);
  assert.equal(l.url, `https://book.massageclub.io/socios?s=estudio-alfa&k=${node(KEY, "socios", `${p.id.toLowerCase()}:2`)}`);
  assert.match(l.url, SOCIOS_URL_RE);
  assert.equal(l.link_v, 2);
  const u = await socLinkFor(KEY, { ...p, id: p.id.toLowerCase() }, 2);
  assert.match(u.url, /\?s=a1a1a1a1-0000-4000-8000-000000000001&k=[0-9a-f]{24}$/);
  const none = await socLinkFor("", p, 1);
  assert.equal(none.ok, false);
  assert.equal(none.code, "sign_key_missing");
});

test("URL regex refuses anything but book.massageclub.io/socios", () => {
  assert.doesNotMatch("https://evil.example/socios?s=a&k=0123456789abcdef01234567", SOCIOS_URL_RE);
  assert.doesNotMatch("https://book.massageclub.io/socios?s=a&k=0123", SOCIOS_URL_RE);
  assert.doesNotMatch("http://book.massageclub.io/socios?s=a&k=0123456789abcdef01234567", SOCIOS_URL_RE);
  assert.match(PROOF_QR_URL, /^https:\/\/book\.massageclub\.io\/socios\?preview=1$/);
});

test("hashing and constant-time comparisons", async () => {
  assert.equal(await sha256Hex("abc"), createHash("sha256").update("abc").digest("hex"));
  assert.equal(await secretEqual("same secret value", "same secret value"), true);
  assert.equal(await secretEqual("same secret valuE", "same secret value"), false);
  assert.equal(await secretEqual("", ""), false);
  assert.equal(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false);
});
