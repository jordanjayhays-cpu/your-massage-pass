// Letters (17 Nov 2026): hashing and the studio's signed /socios link, the URL
// printed as each letter's QR. WebCrypto only (Deno and Node both have it).
//
// The link is built exactly as wa-bot/bot.ts builds it (relHmac, socSig,
// socLink): HMAC-SHA256 under "<MC_SIGN_KEY>:socios" over
// "<partner id>:<slots_link_v || 1>", first 12 bytes as hex. Bumping
// partners.slots_link_v revokes it (and the printed QR with it).

const enc = new TextEncoder();
const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256Bytes(data: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  return hex(await sha256Bytes(data));
}
export async function hmacSha256(key: string | Uint8Array, msg: string | Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, typeof msg === "string" ? enc.encode(msg) : msg));
}
export async function hmacHex(key: string | Uint8Array, msg: string | Uint8Array): Promise<string> {
  return hex(await hmacSha256(key, msg));
}

// Constant time for equal lengths; unequal lengths return false at once (the
// callers compare fixed-length digests).
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
// Compares two secrets by their SHA-256 digests, so neither length nor content
// leaks through timing.
export async function secretEqual(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Bytes(String(given ?? "")), sha256Bytes(String(expected ?? ""))]);
  return constantTimeEqual(a, b) && !!expected;
}

export async function relHmac(signKey: string, kind: string, value: string): Promise<string> {
  if (!signKey) return "";
  return hex((await hmacSha256(signKey + ":" + kind, value)).slice(0, 12));
}
export const socSigValue = (p: { id: string; slots_link_v?: unknown }): string => `${p.id}:${Number(p.slots_link_v || 1)}`;
export async function socSig(signKey: string, p: { id: string; slots_link_v?: unknown }): Promise<string> {
  return await relHmac(signKey, "socios", socSigValue(p));
}

export const SOCIOS_PAGE = "https://book.massageclub.io/socios";
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const SOCIOS_URL_RE = /^https:\/\/book\.massageclub\.io\/socios\?s=[a-z0-9-]{1,80}&k=[0-9a-f]{24}$/;
// Proof letters (Jordan's own address) open the page in preview: it saves nothing.
export const PROOF_QR_URL = "https://book.massageclub.io/socios?preview=1";

// What the page's ?s= resolves (bot.ts socPartner): a slug only when it is
// well formed and exactly one studio has it, else the studio's UUID.
export function socRef(p: { id: string; slug?: unknown }, slugCount: number): string {
  const slug = String(p.slug ?? "");
  return SLUG_RE.test(slug) && slugCount === 1 ? slug : String(p.id).toLowerCase();
}

export async function socLinkFor(signKey: string, p: { id: string; slug?: unknown; slots_link_v?: unknown }, slugCount: number): Promise<{ ok: true; url: string; link_v: number } | { ok: false; code: string; message: string }> {
  if (!signKey) return { ok: false, code: "sign_key_missing", message: "MC_SIGN_KEY is not set as an Edge Function secret, so the studio's QR link cannot be signed." };
  const s = socRef(p, slugCount);
  const url = `${SOCIOS_PAGE}?s=${encodeURIComponent(s)}&k=${await socSig(signKey, p)}`;
  if (!SOCIOS_URL_RE.test(url)) return { ok: false, code: "bad_link", message: "The studio's link does not have the expected form." };
  return { ok: true, url, link_v: Number(p.slots_link_v || 1) };
}

export function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
