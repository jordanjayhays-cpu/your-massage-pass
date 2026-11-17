// Letters (17 Nov 2026): who may use the letters tool. Pure apart from the
// injected fetch, so Node tests run it.
//
// The page signs Jordan in with the site's existing Google login (Supabase
// Auth, the one /founder uses). This module checks every call on the server.
//
// Review fix (17 Nov, security H1): the same Supabase project offers email and
// password sign-up (PartnerLogin, PartnerOnboarding, StudioSetup), so an
// email allowlist could be beaten by anyone who signs up as an allowlisted
// address while email confirmation is off. Now:
//   - access is by Supabase Auth USER ID (LETTERS_ADMIN_USER_IDS, exact
//     UUIDs), which nobody can choose at sign-up;
//   - the account must have a confirmed email (email_confirmed_at, not
//     confirmed_at, which a phone confirmation also sets) AND a Google
//     identity whose verified email is that same address;
//   - no defaults, no personal address in code: with the secret unset, or any
//     entry in it not a user id, nobody gets in (fail closed). The refusal
//     tells the signed-in Google account its own user id, so Jordan can copy
//     it into the secret.
// The HMAC founder links (replySig("inbox")) are not used here: they are
// forwardable bearer URLs that live in email history.

import { sha256Hex, secretEqual } from "./sign.ts";

// Review fix (17 Nov, security L4): only the page's own origin.
export const ALLOWED_ORIGINS = ["https://book.massageclub.io"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type AdminIds = { ok: boolean; ids: string[]; problem: string };
export function parseAdminIds(v: string | undefined): AdminIds {
  const raw = String(v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!raw.length) return { ok: false, ids: [], problem: "LETTERS_ADMIN_USER_IDS is not set, so nobody can open the letters tool." };
  const bad = raw.filter((x) => !UUID_RE.test(x));
  if (bad.length) return { ok: false, ids: [], problem: `LETTERS_ADMIN_USER_IDS has ${bad.length} entr${bad.length === 1 ? "y" : "ies"} that ${bad.length === 1 ? "is" : "are"} not a user id, so nobody can open the letters tool until it is fixed.` };
  return { ok: true, ids: [...new Set(raw)], problem: "" };
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

type AuthUser = {
  id?: string; email?: string; email_confirmed_at?: string | null;
  identities?: { provider?: string; identity_data?: { email?: string; email_verified?: boolean } | null }[] | null;
};
// A Google identity whose email is the account's email (and that Google says
// is verified, when it says anything).
export function googleIdentityOk(u: AuthUser | null): boolean {
  const email = String(u?.email || "").trim().toLowerCase();
  if (!email) return false;
  return (u?.identities || []).some((i) => i?.provider === "google"
    && String(i.identity_data?.email || "").trim().toLowerCase() === email
    && i.identity_data?.email_verified !== false);
}

export type AuthCache = Map<string, { email: string; id: string; exp: number }>;
const defaultCache: AuthCache = new Map();
export type AuthResult =
  | { ok: true; email: string; userId: string }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string; userId?: string };

export async function verifyUser(token: string, o: {
  supabaseUrl: string; serviceKey: string; admins: AdminIds; fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => number; cache?: AuthCache;
}): Promise<AuthResult> {
  if (!token) return { ok: false, status: 401, code: "auth_required", message: "Sign in first." };
  if (!o.supabaseUrl || !o.serviceKey) return { ok: false, status: 503, code: "not_configured", message: "The server is missing its Supabase settings." };
  const cache = o.cache ?? defaultCache;
  const key = await sha256Hex(token);
  const hit = cache.get(key);
  if (hit && hit.exp > o.now() && o.admins.ok && o.admins.ids.includes(hit.id)) return { ok: true, email: hit.email, userId: hit.id };
  let res: Response;
  try {
    res = await o.fetch(`${o.supabaseUrl}/auth/v1/user`, { headers: { apikey: o.serviceKey, Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, status: 503, code: "not_configured", message: "Could not check the sign-in. Try again." };
  }
  if (res.status !== 200) return { ok: false, status: 401, code: "auth_required", message: "Your sign-in has expired. Sign in again." };
  const u = await res.json().catch(() => null) as AuthUser | null;
  const id = String(u?.id || "").trim().toLowerCase();
  const email = String(u?.email || "").trim().toLowerCase();
  const confirmed = !!u?.email_confirmed_at;
  const google = googleIdentityOk(u);
  // Only an account that could ever be let in learns its own user id.
  const showId = UUID_RE.test(id) && confirmed && google ? id : undefined;
  if (!o.admins.ok) return { ok: false, status: 503, code: "admins_not_set", message: `${o.admins.problem} Add your user id to LETTERS_ADMIN_USER_IDS in Supabase, Edge Functions, Secrets.`, userId: showId };
  if (!UUID_RE.test(id) || !email || !confirmed || !google || !o.admins.ids.includes(id)) {
    const why = !confirmed ? " Its email is not confirmed." : !google ? " It is not signed in with Google." : "";
    return { ok: false, status: 403, code: "not_allowed", message: `This account${email ? ` (${email})` : ""} cannot open the letters tool.${why}`, userId: showId };
  }
  cache.set(key, { email, id, exp: o.now() + 60_000 });
  if (cache.size > 500) for (const [k, v] of cache) if (v.exp <= o.now()) cache.delete(k);
  return { ok: true, email, userId: id };
}

// Step-up passcode for posting, cancelling and webhook registration. Compared
// through SHA-256 digests in constant time.
export const PASSCODE_MIN = 12;
export async function passcodeOk(given: unknown, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < PASSCODE_MIN) return false;
  return await secretEqual(String(given ?? ""), secret);
}
