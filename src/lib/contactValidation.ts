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

/**
 * Copy for the now mandatory email field. Email is our only reliable channel
 * once the 24 hour WhatsApp reply window closes, so every booking request
 * form asks for it and blocks submission without a valid one.
 */
export const EMAIL_REQUIRED_COPY = {
  en: {
    label: "Your email",
    helper:
      "Your confirmation goes here as well as WhatsApp, so nothing gets lost if we cannot reach you there.",
    error: "We need a valid email so your confirmation reaches you.",
  },
  es: {
    label: "Tu email",
    helper:
      "Ahí te llega la confirmación además de por WhatsApp, así no se pierde nada si no podemos contactarte por ahí.",
    error: "Necesitamos un email válido para que te llegue la confirmación.",
  },
  fr: {
    label: "Votre email",
    helper:
      "Votre confirmation arrive ici en plus de WhatsApp, comme ça rien ne se perd si on ne peut pas vous joindre là bas.",
    error: "Il nous faut un email valide pour que votre confirmation vous parvienne.",
  },
  de: {
    label: "Deine E-Mail",
    helper:
      "Deine Bestätigung kommt hierhin und zusätzlich per WhatsApp, so geht nichts verloren, falls wir dich dort nicht erreichen.",
    error: "Wir brauchen eine gültige E-Mail, damit deine Bestätigung ankommt.",
  },
  it: {
    label: "La tua email",
    helper:
      "La conferma arriva qui oltre che su WhatsApp, così non si perde nulla se non riusciamo a contattarti lì.",
    error: "Ci serve un'email valida perché ti arrivi la conferma.",
  },
  pt: {
    label: "O teu email",
    helper:
      "A confirmação chega aqui além do WhatsApp, assim não se perde nada se não conseguirmos falar contigo por lá.",
    error: "Precisamos de um email válido para que a confirmação te chegue.",
  },
  zh: {
    label: "你的邮箱",
    helper: "确认信息除了通过 WhatsApp 发送，也会发到这里，即使联系不上你也不会遗漏。",
    error: "我们需要一个有效的邮箱，确认信息才能发给你。",
  },
} as const;

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

