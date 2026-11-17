// Letters (17 Nov 2026): the letter's words. Pure data, no imports, so Node
// tests load it with --experimental-strip-types.
//
// Everything Spanish here has its English beside it: the English is for
// Jordan only and is never printed.
//
// The default template is Jordan's draft of 17 Nov, word for word. It is NOT
// approved yet, and its fee sentence does not pass the fee guard in rules.ts
// (see FEE_SENTENCES below), so no letter made from it can be approved until
// Jordan picks the wording. useApprovedFeeWording() is the editor's one-tap
// swap.

export type Template = {
  version: number;
  body_es: string;
  body_en: string;
  body_en_stale: boolean;
  optout_es: string;
  optout_en: string;
  optout_en_stale: boolean;
  privacy_es: string;
  privacy_en: string;
  privacy_en_stale: boolean;
  qr_caption_es: string;
  qr_caption_en: string;
};

// The fee sentences a letter may print, keyed by the /socios terms version
// they come from (SOCIOS_TERMS["2026-10-19"] in wa-bot/bot.ts: free until
// 31 Dec 2026, then 5 EUR + IVA for every visit Massage Club books, only if
// the customer comes; no monthly fee, no contract). Adding a sentence here is
// a code change with review, on purpose.
export const FEE_SENTENCES: Record<string, { es: string; en: string }> = {
  "2026-10-19": {
    es: "Sin coste hasta el 31 de diciembre de 2026. Desde el 1 de enero de 2027, 5 € + IVA por cada visita que os reservemos nosotros, solo si el cliente viene. Sin cuota mensual y sin contrato.",
    en: "Free until 31 December 2026. From 1 January 2027, 5 € + VAT for each visit we book for you, only if the customer comes. No monthly fee and no contract.",
  },
};
export const CURRENT_FEE_VERSION = "2026-10-19";

// Jordan's draft wording (17 Nov). Shown in the editor's chooser next to the
// approved one; it fails the fee guard ("desde enero" has no year, and "por
// cada cliente" reads as once per customer while the terms bill every visit).
export const DRAFT_FEE_SENTENCE = {
  es: "Sin coste hasta el 31 de diciembre de 2026. Desde enero, 5 € + IVA solo por cada cliente que venga. Sin cuota mensual y sin contrato.",
  en: "Free until 31 December 2026. From January, 5 € + VAT only for each customer who comes. No monthly fee and no contract.",
};

export const SIGN_OFF = "Jordan, de Massage Club";

const BODY_ES = `Hola, equipo de {{nombre}}:

Soy Jordan, de Massage Club. Nos escriben personas en Madrid, muchas de ellas extranjeras, que quieren reservar un masaje y no saben dónde. Nosotros les buscamos centro.

Nos gustaría enviaros clientes. Funciona así:
• Nos dais 2 o 3 horas libres a la semana, cuando os venga bien.
• Un cliente elige una y os llega la reserva por escrito, con su nombre y teléfono. Si no os viene bien, la rechazáis en 15 minutos.
• El cliente paga en vuestro centro, a vuestro precio.

${DRAFT_FEE_SENTENCE.es}

Escanead el código QR para apuntaros en 2 minutos, o escribidme por WhatsApp al +34 612 474 827.

Un saludo,
Jordan, de Massage Club`;

const BODY_EN = `Hello, {{nombre}} team:

I'm Jordan, from Massage Club. People in Madrid write to us, many of them from abroad, who want to book a massage and don't know where. We find them a place.

We'd like to send you customers. It works like this:
• You give us 2 or 3 free times a week, whenever suits you.
• A customer picks one and the booking reaches you in writing, with their name and phone number. If it doesn't suit you, you reject it within 15 minutes.
• The customer pays at your place, at your price.

${DRAFT_FEE_SENTENCE.en}

Scan the QR code to sign up in 2 minutes, or message me on WhatsApp at +34 612 474 827.

Best regards,
Jordan, from Massage Club`;

const OPTOUT_ES = "¿No queréis recibir más cartas? Escribid BAJA por WhatsApp al {{whatsapp}} o a {{email_contacto}}. Es gratis y no hace falta dar motivos.";
const OPTOUT_EN = "Don't want any more letters? Write BAJA (unsubscribe) on WhatsApp to {{whatsapp}} or to {{email_contacto}}. It's free and you don't need to give a reason.";

// GDPR art. 14 basics. A draft for Jordan and a legal check.
const PRIVACY_ES = "Protección de datos. Responsable: {{remitente}}{{nif}}, {{direccion_remitente}}, {{email_contacto}}. Finalidad: presentaros Massage Club por correo postal como posible colaborador. Base jurídica: nuestro interés legítimo en dar a conocer el servicio a negocios de masaje (art. 6.1.f del RGPD). Datos: el nombre comercial y la dirección de vuestro negocio, tomados de vuestra ficha pública en Google Maps y de vuestra web. Quién más: el proveedor que imprime y envía esta carta (Pingen GmbH, Suiza) y el operador postal que la entrega, y los proveedores que guardan nuestros datos, solo por encargo nuestro. Conservación: hasta que nos pidáis la baja o, como mucho, 12 meses desde este envío; si pedís la baja, guardamos solo lo necesario para no volver a escribiros. Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad, en {{email_contacto}}. Os podéis oponer en cualquier momento escribiendo BAJA. Si no estáis conformes, podéis reclamar ante la Agencia Española de Protección de Datos (aepd.es). Más información: {{privacidad_url}}";
const PRIVACY_EN = "Data protection. Controller: {{remitente}}{{nif}}, {{direccion_remitente}}, {{email_contacto}}. Purpose: introducing Massage Club to you by post as a possible partner. Legal basis: our legitimate interest in making the service known to massage businesses (GDPR art. 6.1.f). Data: your business's trade name and address, taken from your public Google Maps listing and your website. Who else: the provider that prints and posts this letter (Pingen GmbH, Switzerland), the postal operator that delivers it, and the providers that store our data, only on our instructions. Retention: until you ask us to stop or at most 12 months from this mailing; if you opt out, we keep only what we need so as not to write again. Rights: access, rectification, erasure, objection, restriction and portability, at {{email_contacto}}. You can object at any time by writing BAJA. If you are not satisfied, you can complain to the Spanish Data Protection Agency (aepd.es). More information: {{privacidad_url}}";

export const DEFAULT_TEMPLATE: Template = {
  version: 1,
  body_es: BODY_ES,
  body_en: BODY_EN,
  body_en_stale: false,
  optout_es: OPTOUT_ES,
  optout_en: OPTOUT_EN,
  optout_en_stale: false,
  privacy_es: PRIVACY_ES,
  privacy_en: PRIVACY_EN,
  privacy_en_stale: false,
  qr_caption_es: "Escanead para apuntaros",
  qr_caption_en: "Scan to sign up",
};

export function defaultTemplate(): Template {
  return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
}

// The editor's "Use the wording from the /socios terms": swaps Jordan's draft
// fee sentence for the approved one, Spanish and English together.
export function useApprovedFeeWording(t: Template, version = CURRENT_FEE_VERSION): Template {
  const fee = FEE_SENTENCES[version];
  if (!fee) throw new Error(`unknown fee version ${version}`);
  const out = { ...t };
  const squash = (s: string) => s.replace(/[ \t]+/g, " ");
  if (squash(out.body_es).includes(DRAFT_FEE_SENTENCE.es)) out.body_es = squash(out.body_es).replace(DRAFT_FEE_SENTENCE.es, fee.es);
  if (squash(out.body_en).includes(DRAFT_FEE_SENTENCE.en)) out.body_en = squash(out.body_en).replace(DRAFT_FEE_SENTENCE.en, fee.en);
  return out;
}

// What the page shows for each fixed piece of printed copy, with its English.
export const PRINTED_FIXED = {
  tagline: { es: "Reservas de masaje en Madrid", en: "Massage bookings in Madrid" },
  wordmark: "Massage Club",
  web: "book.massageclub.io",
  ref: { es: "Ref.", en: "Ref." },
  qr_unsigned: { es: "QR sin firmar", en: "QR link cannot be signed" },
};

// Missing settings print as these red placeholders in a preview, and a letter
// with any placeholder can never be approved.
export const MISSING = {
  remitente: { es: "FALTA: remitente legal", en: "MISSING: legal sender" },
  nif: { es: "FALTA: NIF", en: "MISSING: NIF" },
  direccion_remitente: { es: "FALTA: dirección postal", en: "MISSING: postal address" },
  privacidad_url: { es: "FALTA: página de privacidad", en: "MISSING: privacy page" },
  email_contacto: { es: "FALTA: email de contacto", en: "MISSING: contact email" },
  whatsapp: { es: "FALTA: WhatsApp", en: "MISSING: WhatsApp" },
};
