// Letters (17 Nov 2026, review fix H2): how the bot reads a studio's answer to
// a postal letter. Pure functions, no imports, so `npm run replay` tests them.
//
// Every letter says: "¿No queréis recibir más cartas? Escribid BAJA por
// WhatsApp al +34 612 474 827" ("Don't want any more letters? Write BAJA on
// WhatsApp to ..."), and prints a six-character reference ("Ref. K7M2QX").
// Before this, a studio's BAJA from a number the bot did not know went into
// the customer flow (an offer with prices, signed "Massage Club") and its
// objection was never recorded. bot.ts (handleLetterReply) now:
//   - records a BAJA in letter_optouts, marks the studio and sends Jordan a
//     card, with nothing said back and no customer offer;
//   - sends Jordan a card for any other message that quotes a letter's
//     reference, and keeps that number out of the customer flow for 2 days;
//   - stores a BAJA from one of its test numbers as a test row, which is
//     what lets Jordan confirm the BAJA route in the letters tool.

// The reference alphabet (rules.ts REF_ALPHABET): no 0 O 1 I L.
export const LETTER_REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const REF_TOKEN_RE = /(?<![A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ])[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}(?![A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ])/g;

// Up to three candidate references, as printed: six capitals or digits from
// the alphabet, standing alone ("Ref. K7M2QX", "BAJA K7M2QX"). A capitalised
// word such as "MASAJE" can look like one; bot.ts only trusts a candidate
// that is the reference of a letter that was posted.
export function letterRefCandidates(text: string): string[] {
  const t = String(text || "").normalize("NFC");
  if (t.length > 600) return [];
  const out: string[] = [];
  for (const m of t.matchAll(REF_TOKEN_RE)) {
    const c = m[0];
    // Common words in capitals that fit the alphabet spare a lookup.
    if (COMMON_CAPS.has(c)) continue;
    if (!out.includes(c)) out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}
const COMMON_CAPS = new Set(["MASAJE", "THANKS", "SEMANA", "MARTES", "JUEVES"]);

// "BAJA" as the letter asks, in a short message: the word first ("BAJA",
// "Baja, gracias", "BAJA K7M2QX"), or a plain request ("queremos darnos de
// baja", "no queremos recibir más cartas", "no nos escribáis más"). Not
// "planta baja" (ground floor), "baja por maternidad" in the middle of a
// sentence, or a long message that only mentions the word.
const BAJA_FIRST_RE = /^\s*[¡!¿"'«(*_]*\s*baja(?![\p{L}\p{N}])/iu;
const BAJA_PHRASE_RE = /(?<![\p{L}])(?:da[rd](?:me|nos|se|os)?\s+de\s+baja|(?:quiero|queremos|pido|pedimos|solicito|solicitamos|tramitad|tramitar)\s+(?:la\s+)?baja|no\s+(?:quiero|queremos)\s+(?:recibir\s+)?m[aá]s\s+cartas|no\s+nos\s+(?:escrib[aá]is|envi[eé]is|mand[eé]is)\s+m[aá]s(?:\s+cartas)?)(?![\p{L}])/iu;
const NOT_BAJA_RE = /^\s*baja\s+(?:por|de)\s+(?:maternidad|paternidad|enfermedad|m[eé]dica|laboral)/iu;
export function letterBajaIntent(text: string): boolean {
  const t = String(text || "").normalize("NFC").trim();
  if (!t || t.length > 240) return false;
  if (NOT_BAJA_RE.test(t)) return false;
  return BAJA_FIRST_RE.test(t) || BAJA_PHRASE_RE.test(t);
}
// The message is BAJA and nothing else (no translation needed).
export const BAJA_ONLY_RE = /^\s*[¡!¿"'«(*_]*\s*baja[\s.!¡*_"'»)]*$/iu;

// The draft Jordan may send from his own WhatsApp after a BAJA (studio-facing:
// from "Jordan, de Massage Club"). The bot never sends it.
export const LETTER_BAJA_ACK_ES = "Hecho: no os volveremos a escribir por carta. Gracias por decírnoslo.\n\nJordan, de Massage Club";
export const LETTER_BAJA_ACK_EN = "Done: we won't write to you by post again. Thanks for letting us know.\n\nJordan, from Massage Club";
