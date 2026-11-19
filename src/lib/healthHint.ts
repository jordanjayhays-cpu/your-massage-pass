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
