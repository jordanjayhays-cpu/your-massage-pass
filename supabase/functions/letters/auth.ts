// Letters (17 Nov 2026): who may use the letters tool. Pure apart from the
// injected fetch, so Node tests run it.
//
// The page signs Jordan in with the site's existing Google login (Supabase
// Auth, the one /founder uses). This module checks every call on the server:
// the access token must belong to a confirmed account whose email is exactly
// on the allowlist (LETTERS_ADMIN_EMAILS, else the default below). No domain
// wildcard. The HMAC founder links (replySig("inbox")) are not used here:
// they are forwardable bearer URLs that live in email history.

import { sha256Hex, secretEqual } from "./sign.ts";

export const DEFAULT_ADMINS = ["jordan@massageclub.io", "jordanjayhays@gmail.com"];
export const ALLOWED_ORIGINS = ["https://book.massageclub.io", "https://massageclub.io", "https://your-massage-pass-o5fo.vercel.app"];
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function parseAllowlist(v: string | undefined): { emails: string[]; source: "secret" | "default"; ignored: string[] } {
  const raw = String(v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const emails = raw.filter((e) => EMAIL_RE.test(e) && !e.includes("*"));
  const ignored = raw.filter((e) => !emails.includes(e));
  if (!emails.length) return { emails: [...DEFAULT_ADMINS], source: "default", ignored };
  return { emails: [...new Set(emails)], source: "secret", ignored };
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const o = String(origin ?? "");
  if (!ALLOWED_ORIGINS.includes(o)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function bearerToken(h: Headers): string {
  const m = String(h.get("authorization") || "").match(/^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/);
  return m ? m[1] : "";
}

// The caller's address, read as wa-bot's socClientIp does: cf-connecting-ip,
// else the last X-Forwarded-For entry, else x-real-ip.
export function clientIp(h: Headers): string {
  const cf = (h.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const xff = (h.get("x-forwarded-for") || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (xff.length) return xff[xff.length - 1];
  return (h.get("x-real-ip") || "").trim();
}
export async function ipHash(ip: string): Promise<string> {
  return (await sha256Hex(`letters-ip:${ip || "none"}`)).slice(0, 24);
}

export type AuthCache = Map<string, { email: string; exp: number }>;
const defaultCache: AuthCache = new Map();
export type AuthResult = { ok: true; email: string } | { ok: false; status: 401 | 403 | 503; code: string; message: string };

export async function verifyUser(token: string, o: {
  supabaseUrl: string; serviceKey: string; allowlist: string[]; fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number; cache?: AuthCache;
}): Promise<AuthResult> {
  if (!token) return { ok: false, status: 401, code: "auth_required", message: "Sign in first." };
  if (!o.supabaseUrl || !o.serviceKey) return { ok: false, status: 503, code: "not_configured", message: "The server is missing its Supabase settings." };
  const cache = o.cache ?? defaultCache;
  const key = await sha256Hex(token);
  const hit = cache.get(key);
  if (hit && hit.exp > o.now() && o.allowlist.includes(hit.email)) return { ok: true, email: hit.email };
  let res: Response;
  try {
    res = await o.fetch(`${o.supabaseUrl}/auth/v1/user`, { headers: { apikey: o.serviceKey, Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, status: 503, code: "not_configured", message: "Could not check the sign-in. Try again." };
  }
  if (res.status !== 200) return { ok: false, status: 401, code: "auth_required", message: "Your sign-in has expired. Sign in again." };
  const u = await res.json().catch(() => null) as { email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
  const email = String(u?.email || "").trim().toLowerCase();
  const confirmed = !!(u?.email_confirmed_at || u?.confirmed_at);
  if (!email || !confirmed || !o.allowlist.includes(email)) {
    return { ok: false, status: 403, code: "not_allowed", message: `This account${email ? ` (${email})` : ""} cannot open the letters tool.` };
  }
  cache.set(key, { email, exp: o.now() + 60_000 });
  if (cache.size > 500) for (const [k, v] of cache) if (v.exp <= o.now()) cache.delete(k);
  return { ok: true, email };
}

// Step-up passcode for posting, cancelling and webhook registration. Compared
// through SHA-256 digests in constant time.
export const PASSCODE_MIN = 12;
export async function passcodeOk(given: unknown, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < PASSCODE_MIN) return false;
  return await secretEqual(String(given ?? ""), secret);
}
