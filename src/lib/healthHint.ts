/**
 * The line under every free-text note a customer writes for a studio
 * (19 Nov 2026). Health details are special-category data (GDPR art. 9), we
 * do not need them to find a time, and a request note goes to every studio we
 * ask, so the forms ask people to leave them out. The privacy page (section 3)
 * says the same. public/go.html carries the en/es lines itself (noteHelp).
 */
export const NOTE_HEALTH_HINT: Record<string, string> = {
  en: "Please do not write health details here. You can tell the therapist at the studio.",
  es: "Por favor, no escribas aquí datos de salud. Puedes contárselo al terapeuta en el centro.",
  fr: "Merci de ne pas écrire ici de données de santé. Vous pourrez en parler au thérapeute sur place.",
  de: "Bitte schreibe hier keine Gesundheitsangaben. Du kannst sie im Studio direkt erwähnen.",
  it: "Per favore non scrivere qui dati sulla salute. Puoi dirlo al terapeuta in centro.",
  pt: "Por favor, não escrevas aqui dados de saúde. Podes dizê-lo ao terapeuta no estúdio.",
  zh: "请不要在这里填写健康信息。你可以在门店直接告诉理疗师。",
};

export function noteHealthHint(lang?: string | null): string {
  const k = String(lang || "en").slice(0, 2).toLowerCase();
  return NOTE_HEALTH_HINT[k] || NOTE_HEALTH_HINT.en;
}

/**
 * The first layer of the privacy information, next to every booking form's
 * contact fields (LOPDGDD art. 11.2: who is responsible, what for, and that
 * you can exercise your rights). public/go.html carries the same en/es words
 * (privacy, privacyRemind).
 */
export const PRIVACY_FIRST_LAYER: Record<string, string> = {
  en: "Massage Club (Kinsol LLC) uses your details for this request, and to send offers only if you say yes. To see, correct or delete them, write to support@massageclub.io.",
  es: "Massage Club (Kinsol LLC) usa tus datos para esta solicitud y, solo si dices que sí, para enviarte ofertas. Para verlos, corregirlos o borrarlos, escribe a support@massageclub.io.",
  fr: "Massage Club (Kinsol LLC) utilise vos données pour cette demande et, seulement si vous dites oui, pour vous envoyer des offres. Pour les consulter, les corriger ou les supprimer, écrivez à support@massageclub.io.",
  de: "Massage Club (Kinsol LLC) nutzt deine Daten für diese Anfrage und, nur wenn du Ja sagst, um dir Angebote zu schicken. Um sie einzusehen, zu korrigieren oder zu löschen, schreib an support@massageclub.io.",
  it: "Massage Club (Kinsol LLC) usa i tuoi dati per questa richiesta e, solo se dici di sì, per inviarti offerte. Per vederli, correggerli o cancellarli, scrivi a support@massageclub.io.",
  pt: "O Massage Club (Kinsol LLC) usa os teus dados para este pedido e, só se disseres que sim, para te enviar ofertas. Para os veres, corrigires ou apagares, escreve para support@massageclub.io.",
  zh: "Massage Club（Kinsol LLC）将你的信息用于本次请求；只有在你同意后，才会向你发送优惠。如需查看、更正或删除，请写信至 support@massageclub.io。",
};

export function privacyFirstLayer(lang?: string | null): string {
  const k = String(lang || "en").slice(0, 2).toLowerCase();
  return PRIVACY_FIRST_LAYER[k] || PRIVACY_FIRST_LAYER.en;
}
