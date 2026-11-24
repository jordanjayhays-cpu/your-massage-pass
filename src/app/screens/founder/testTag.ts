// Founder-only helpers: recognise our own test traffic so real numbers stay honest.

const TEST_EMAILS = new Set([
  "jordan.hays@student.ie.edu",
  "jordanjayhays@gmail.com",
  "jordan@massageclub.io",
  "support@massageclub.io",
  "cata.waack@gmail.com",
  "elon_yilong@student.ie.edu",
  "guest@massageclub.io",
]);

const TEST_DOMAINS = ["@testing.com", "@example.com", "@test.com", "@example.org", "@mailinator.com"];

const TEST_PHONES = ["15622355063", "17867276503"];

export function isTestEmail(email?: string | null): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;
  if (TEST_EMAILS.has(e)) return true;
  return TEST_DOMAINS.some((d) => e.endsWith(d));
}

export function isTestName(name?: string | null): boolean {
  const n = (name || "").trim().toLowerCase();
  if (!n) return false;
  return n.includes("test") || n.includes("prueba");
}

export function isTestPhone(phone?: string | null): boolean {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return false;
  if (TEST_PHONES.some((p) => digits.endsWith(p))) return true;
  // Chinese test handsets: +86 numbers ending in 997
  if (digits.startsWith("86") && digits.endsWith("997")) return true;
  return false;
}

export function isTestBookingRow(b: {
  client_email?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  is_test?: boolean | null;
}): boolean {
  return (
    b.is_test === true ||
    isTestEmail(b.client_email) ||
    isTestName(b.client_name) ||
    isTestPhone(b.client_phone)
  );
}

export function isTestWaRow(w: {
  contact_email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  client_phone?: string | null;
}): boolean {
  return (
    isTestEmail(w.contact_email) ||
    isTestName(w.first_name) ||
    isTestName(w.last_name) ||
    isTestPhone(w.client_phone)
  );
}
