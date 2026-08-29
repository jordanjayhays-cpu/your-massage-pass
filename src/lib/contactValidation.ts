import { isValidPhoneNumber } from "libphonenumber-js";

/** True when the string looks like a real email address. */
export function isValidEmail(value: string): boolean {
  const v = (value ?? "").trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/**
 * True when the string is a plausible phone number.
 * Numbers starting with + are validated against the real country plan,
 * so things like "+3539846283682" (Irish code, too many digits) are rejected.
 * Numbers without a country code are checked as Spanish numbers.
 */
export function isValidPhone(value: string): boolean {
  const v = (value ?? "").replace(/[\s()\-.]/g, "").trim();
  if (!v) return false;
  try {
    if (v.startsWith("+")) return isValidPhoneNumber(v);
    if (v.startsWith("00")) return isValidPhoneNumber("+" + v.slice(2));
    return isValidPhoneNumber(v, "ES");
  } catch {
    return false;
  }
}

/** Contact is usable when there is at least one valid channel and no invalid one. */
export function contactOk(phone: string, email: string) {
  const p = (phone ?? "").trim();
  const e = (email ?? "").trim();
  const phoneValid = p ? isValidPhone(p) : null;
  const emailValid = e ? isValidEmail(e) : null;
  return {
    phoneValid,
    emailValid,
    ok: (phoneValid === true || emailValid === true) && phoneValid !== false && emailValid !== false,
  };
}

export const CONTACT_COPY = {
  en: {
    needContact: "We need a name and a way to reach you",
    badPhone: "That number does not look right - include your country code, e.g. +34 600 123 456",
    badEmail: "That email does not look right",
  },
  es: {
    needContact: "Necesitamos tu nombre y una forma de contactarte",
    badPhone: "Ese número no parece correcto - incluye el prefijo del país, ej. +34 600 123 456",
    badEmail: "Ese email no parece correcto",
  },
  fr: {
    needContact: "Il nous faut votre nom et un moyen de vous joindre",
    badPhone: "Ce numéro semble incorrect - indiquez votre indicatif pays, ex. +34 600 123 456",
    badEmail: "Cet email semble incorrect",
  },
  de: {
    needContact: "Wir brauchen deinen Namen und eine Möglichkeit, dich zu erreichen",
    badPhone: "Diese Nummer sieht nicht richtig aus - mit Ländervorwahl, z. B. +34 600 123 456",
    badEmail: "Diese E-Mail-Adresse sieht nicht richtig aus",
  },
  it: {
    needContact: "Ci servono il tuo nome e un modo per contattarti",
    badPhone: "Questo numero non sembra corretto - includi il prefisso internazionale, es. +34 600 123 456",
    badEmail: "Questa email non sembra corretta",
  },
  pt: {
    needContact: "Precisamos do teu nome e de uma forma de te contactar",
    badPhone: "Esse número não parece correto - inclui o indicativo do país, ex. +34 600 123 456",
    badEmail: "Esse email não parece correto",
  },
  zh: {
    needContact: "我们需要你的姓名和一种联系方式",
    badPhone: "这个号码看起来不正确，请加上国家区号，例如 +34 600 123 456",
    badEmail: "这个邮箱地址看起来不正确",
  },
} as const;

