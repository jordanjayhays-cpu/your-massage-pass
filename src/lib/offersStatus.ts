/**
 * Who may get a promotion, as the founder dashboard shows it (the Kelly rule,
 * 19 Nov 2026). The same rule as canMarket() in the bot branch's
 * supabase/functions/consent/status.ts, so the dashboard, its CSV and every
 * sender give one answer:
 *
 *   a person counts as "yes" only when EVERY address we hold for them has a
 *   latest answer of yes in marketing_status, each yes came from a source
 *   where the server tied the address to the person (VERIFIED_SOURCES), and
 *   none of the addresses is a test contact. Any "withdraw" or "no" on any
 *   address blocks, and is what the dashboard shows.
 *
 * Never a fallback: an unreadable status is "unknown", and unknown is not yes.
 */

export type OffersAction = "yes" | "no" | "withdraw";
export type StatusRow = { kind: string; contact: string; action: string; source?: string | null };

/** Sources where the server checked the address against a booking, a request or the WhatsApp sender. */
export const VERIFIED_SOURCES = ["go_page", "studio_request", "studio_booking", "payment", "review_page", "bot"];

// The CLAUDE.md test contacts (same list as status.ts on the bot branch):
// Jordan's own addresses and numbers, the friend testers, the fake domains.
const TEST_EMAILS = [
  "jordan.hays@student.ie.edu", "jordanjayhays@gmail.com", "jordan@massageclub.io", "support@massageclub.io",
  "jordan@niahconnect.com", "cata.waack@gmail.com", "elon_yilong@student.ie.edu",
];
const TEST_DOMAINS = ["testing.com", "example.com", "test.com", "placeholder.local"];
const TEST_PHONES = ["15622355063", "17867276503", "34612474827", "34635569364", "34662680781"];

export function normEmail(v?: string | null): string {
  return String(v || "").trim().toLowerCase();
}
export function normPhoneDigits(v?: string | null): string {
  return String(v || "").replace(/\D/g, "");
}

export function isTestAddress(kind: "email" | "phone", v: string): boolean {
  if (!v) return false;
  if (kind === "email") {
    if (TEST_EMAILS.includes(v)) return true;
    const dom = v.split("@")[1] || "";
    if (TEST_DOMAINS.some((d) => dom === d || dom.endsWith("." + d))) return true;
    return /\+(mctest|uitest)[^@]*@/.test(v);
  }
  return TEST_PHONES.includes(v) || (v.startsWith("86") && v.endsWith("997")) || /^34600000\d{3}$/.test(v);
}

export type StatusIndex = Map<string, { action: string; source: string }>;

/** marketing_status rows keyed "email:<addr>" / "phone:<digits>". */
export function indexStatus(rows: StatusRow[]): StatusIndex {
  const m: StatusIndex = new Map();
  for (const r of rows) {
    const kind = r.kind === "email" ? "email" : r.kind === "phone" ? "phone" : null;
    if (!kind) continue;
    const c = kind === "email" ? normEmail(r.contact) : normPhoneDigits(r.contact);
    if (c) m.set(`${kind}:${c}`, { action: String(r.action), source: String(r.source || "") });
  }
  return m;
}

/**
 * What the dashboard shows for one person:
 *   "yes"             every address yes, verified, no test contact: may get promotions
 *   "withdraw" | "no" the blocking answer on any of their addresses
 *   "test contact"    one of the addresses is ours or a tester's
 *   "unconfirmed yes" a yes from the quiz or the profile card (nothing ties the address to the person yet)
 *   "partly answered" a yes on one address, nothing on another
 *   "not answered"    no row at all
 *   "unknown"         marketing_status could not be read
 */
export type PersonAnswer = "yes" | "no" | "withdraw" | "test contact" | "unconfirmed yes" | "partly answered" | "not answered" | "unknown";

export function personAnswer(
  person: { emails?: Array<string | null | undefined>; phones?: Array<string | null | undefined> },
  status: StatusIndex | null,
): PersonAnswer {
  if (!status) return "unknown";
  const keys = [
    ...[...new Set((person.emails || []).map(normEmail).filter(Boolean))].map((e) => ["email", e] as const),
    ...[...new Set((person.phones || []).map(normPhoneDigits).filter((d) => d.length >= 6))].map((p) => ["phone", p] as const),
  ];
  if (!keys.length) return "not answered";
  const rows = keys.map(([k, v]) => status.get(`${k}:${v}`));
  if (rows.some((r) => r?.action === "withdraw")) return "withdraw";
  if (rows.some((r) => r?.action === "no")) return "no";
  if (keys.some(([k, v]) => isTestAddress(k, v))) return "test contact";
  const answered = rows.filter(Boolean);
  if (!answered.length) return "not answered";
  if (answered.length < rows.length) return "partly answered";
  if (rows.every((r) => r!.action === "yes" && VERIFIED_SOURCES.includes(r!.source))) return "yes";
  return "unconfirmed yes";
}
