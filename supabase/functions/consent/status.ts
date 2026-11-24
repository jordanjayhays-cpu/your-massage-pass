// Who may get a promotion (the consent rule, CLAUDE.md, 19 Nov 2026).
//
// One place that reads public.marketing_status, so every sender asks the same
// question the same way. No imports and no Deno, so the edge functions that
// send (recover-abandoned, stuck-booking-rescue, a future newsletter) import it
// relatively at their pinned commit, and the tests load it with node.
//
// Two questions, deliberately different:
//
//   canMarket(contacts)       may this person get a PROMOTION (an offer, a
//                             "book again" reminder, a newsletter)? True only
//                             when every address we hold for them reads a
//                             latest "yes" that the server tied to a booking,
//                             a request or their own WhatsApp (VERIFIED), and
//                             none of them is a test contact. Any read error,
//                             any missing answer, any "no" or "withdraw":
//                             false. LSSI art. 21.1: no promotion without an
//                             express yes; GDPR art. 7.1: one we can prove.
//
//   marketingBlocked(contacts) has this person said NO or STOP on any address?
//                             For the older jobs that nudge people about a
//                             booking they started (recover-abandoned's
//                             template, the rescue job's mid-flow nudge). They
//                             predate the rule and do not need a yes to run,
//                             but they must never reach someone who said stop
//                             (LSSI art. 22.1, GDPR art. 21.3). A read error
//                             counts as blocked: we do not write to someone
//                             we cannot check.
//
// A "yes" from the quiz is recorded but does not count yet: nothing ties
// that address to the person who typed it, so the first promotion to it
// needs a confirmation click first (double opt-in, not built). A profile
// answer counts: the consent function saves it only for the signed-in
// account's own email.

export type MktAction = "yes" | "no" | "withdraw";
export type MktContacts = { emails?: unknown[]; phones?: unknown[] };
export type StatusRow = { kind: "email" | "phone"; contact: string; action: MktAction; source: string; answered_at?: string };
type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// Sources where the server itself tied the address to the person: the booking
// token (review_page), a request or booking row it matched (go_page,
// studio_request, studio_booking, payment), the signed-in account (profile),
// or the WhatsApp sender (bot).
export const VERIFIED_SOURCES = ["go_page", "studio_request", "studio_booking", "payment", "review_page", "profile", "bot"];

// The CLAUDE.md test contacts: Jordan's own addresses and numbers, the friend
// testers and the fake domains. Nobody on this list is ever marketed to,
// whatever the table says (the consent function records their answers so the
// whole path can be tested).
const TEST_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io", "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu"];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local"];
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "34662680781"];
export function isTestAddress(kind: "email" | "phone", v: string): boolean {
  if (kind === "email") {
    if (TEST_EMAILS.includes(v)) return true;
    const dom = v.split("@")[1] || "";
    if (TEST_DOMAINS.some((d) => dom === d || dom.endsWith("." + d))) return true;
    return /\+(mctest|uitest)[^@]*@/.test(v);
  }
  return TEST_PHONES.includes(v) || (v.startsWith("86") && v.endsWith("997")) || /^34600000\d{3}$/.test(v);
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export function normEmail(x: unknown): string | null {
  const e = String(x ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
export function normPhone(x: unknown): string | null {
  const d = String(x ?? "").replace(/[^0-9]/g, "");
  return d.length >= 6 && d.length <= 15 ? d : null;
}
function addresses(c: MktContacts): { emails: string[]; phones: string[] } {
  const emails = [...new Set((c.emails || []).map(normEmail).filter((x): x is string => !!x))];
  const phones = [...new Set((c.phones || []).map(normPhone).filter((x): x is string => !!x))];
  return { emails, phones };
}

// The latest row per address, or null when marketing_status cannot be read.
// An address with no row is simply absent from the map (not answered).
export async function latestStatus(base: string, headers: Record<string, string>, c: MktContacts, f: FetchLike = fetch as unknown as FetchLike): Promise<Map<string, StatusRow> | null> {
  const { emails, phones } = addresses(c);
  const out = new Map<string, StatusRow>();
  const asks: Array<[string, string[]]> = [["email", emails], ["phone", phones]];
  try {
    for (const [kind, list] of asks) {
      if (!list.length) continue;
      const inList = list.map((v) => `"${v.replace(/"/g, "")}"`).join(",");
      const r = await f(`${base}/rest/v1/marketing_status?kind=eq.${kind}&contact=in.(${encodeURIComponent(inList)})&select=kind,contact,action,source,answered_at`, { headers });
      if (!r.ok) return null;
      const rows = await r.json().catch(() => null);
      if (!Array.isArray(rows)) return null;
      for (const row of rows as StatusRow[]) out.set(`${row.kind}:${row.contact}`, row);
    }
  } catch (_e) { return null; }
  return out;
}

export async function canMarket(base: string, headers: Record<string, string>, c: MktContacts, f: FetchLike = fetch as unknown as FetchLike): Promise<boolean> {
  const { emails, phones } = addresses(c);
  if (!emails.length && !phones.length) return false;
  if (emails.some((e) => isTestAddress("email", e)) || phones.some((p) => isTestAddress("phone", p))) return false;
  const st = await latestStatus(base, headers, c, f);
  if (!st) return false;
  const keys = [...emails.map((e) => `email:${e}`), ...phones.map((p) => `phone:${p}`)];
  return keys.every((k) => {
    const row = st.get(k);
    return !!row && row.action === "yes" && VERIFIED_SOURCES.includes(String(row.source));
  });
}

export async function marketingBlocked(base: string, headers: Record<string, string>, c: MktContacts, f: FetchLike = fetch as unknown as FetchLike): Promise<boolean> {
  const { emails, phones } = addresses(c);
  if (!emails.length && !phones.length) return false;
  const st = await latestStatus(base, headers, c, f);
  if (!st) return true;
  for (const row of st.values()) if (row.action === "no" || row.action === "withdraw") return true;
  return false;
}
