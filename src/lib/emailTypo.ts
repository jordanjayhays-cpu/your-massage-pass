/**
 * "ana@gmial.com" -> "ana@gmail.com".
 *
 * Email is the only way to reach a customer who gives no phone (the Sharo J
 * case, 8 Sept), so a typo in the domain means the studios answer and the
 * customer never hears. The forms show "Did you mean ...?" with a one-tap fix.
 *
 * KEEP IN SYNC with the TYPO map in public/go.html (the test compares them).
 */
export const EMAIL_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotamil.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "icloud.con": "icloud.com",
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
};

const BAD_COM = /\.(con|cmo|ocm|vom)$/;

/** The corrected address, or null when the domain looks fine. */
export function emailTypoFix(email: string): string | null {
  const v = String(email || "").trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 1) return null;
  const domain = v.slice(at + 1);
  const fixed = EMAIL_TYPOS[domain] || (BAD_COM.test(domain) ? domain.replace(BAD_COM, ".com") : null);
  return fixed && fixed !== domain ? v.slice(0, at + 1) + fixed : null;
}
