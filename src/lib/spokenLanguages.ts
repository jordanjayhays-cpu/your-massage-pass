// Languages the visitor speaks, used to tell the studio which language to reply in.
// Everything produced here is SPANISH on purpose — it is sent to the studio.

export type SpokenLang = "en" | "es" | "fr" | "de" | "it" | "pt" | "zh";

export const SPOKEN_LANGS: SpokenLang[] = ["en", "es", "fr", "de", "it", "pt", "zh"];

/** Native label, matching the language switcher. */
export const SPOKEN_LANG_NATIVE: Record<SpokenLang, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  zh: "中文",
};

/** Flag country code, matching the language switcher. */
export const SPOKEN_LANG_FLAG: Record<SpokenLang, string> = {
  en: "gb",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt",
  zh: "cn",
};

/** Spanish name of each language — the studio reads Spanish. */
const ES_NAME: Record<SpokenLang, string> = {
  en: "inglés",
  es: "español",
  fr: "francés",
  de: "alemán",
  it: "italiano",
  pt: "portugués",
  zh: "chino",
};

export const STORAGE_KEY_SPOKEN = "mc-spoken-languages";

export function isSpokenLang(v: unknown): v is SpokenLang {
  return typeof v === "string" && (SPOKEN_LANGS as string[]).includes(v);
}

export function normalizeSpokenLangs(v: unknown): SpokenLang[] {
  if (!Array.isArray(v)) return [];
  const out: SpokenLang[] = [];
  for (const item of v) {
    const code = typeof item === "string" ? item.slice(0, 2).toLowerCase() : "";
    if (isSpokenLang(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

export function loadSpokenLangs(): SpokenLang[] {
  try {
    return normalizeSpokenLangs(JSON.parse(localStorage.getItem(STORAGE_KEY_SPOKEN) || "[]"));
  } catch {
    return [];
  }
}

export function saveSpokenLangs(langs: SpokenLang[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SPOKEN, JSON.stringify(langs));
  } catch {
    /* ignore */
  }
}

/** "inglés", "inglés o alemán", "inglés, alemán o francés" */
export function spanishLanguageList(langs: SpokenLang[]): string {
  const names = langs.map((l) => ES_NAME[l]);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

/** True when the visitor speaks Spanish — no apology, no language offer. */
export function speaksSpanish(langs: SpokenLang[]): boolean {
  return langs.includes("es");
}

/**
 * The Spanish line offering the languages we can continue in.
 * Empty string when the visitor speaks Spanish (line is dropped entirely).
 */
export function spanishLanguageOffer(langs: SpokenLang[]): string {
  if (speaksSpanish(langs) || langs.length === 0) return "";
  const list = spanishLanguageList(langs);
  return langs.length === 1
    ? `Si habláis ${list}, decídmelo y sigo en ${list}.`
    : `Si habláis ${list}, decídmelo y sigo en ese idioma.`;
}
