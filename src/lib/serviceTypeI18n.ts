import { toFlowLang, type FlowLang } from "@/lib/flowLang";

/**
 * Studios enter their menu in Spanish (and sometimes English), so raw
 * `partner_services.name` values leak untranslated words into flow text.
 * This maps the common massage types onto localized labels.
 *
 * Only used for DISPLAY. Anything sent to a studio (WhatsApp, email) must
 * keep the Spanish name - see src/lib/serviceName.ts.
 */

export type MassageTypeKey =
  | "deep_tissue"
  | "thai"
  | "relaxing"
  | "sports"
  | "hot_stone"
  | "balinese"
  | "shiatsu"
  | "reflexology"
  | "lymphatic"
  | "couples"
  | "prenatal"
  | "facial";

const LABELS: Record<MassageTypeKey, Record<FlowLang, string>> = {
  deep_tissue: {
    en: "Deep tissue", es: "Descontracturante", fr: "Tissus profonds", de: "Tiefengewebsmassage",
    it: "Tessuti profondi", pt: "Tecidos profundos", zh: "深层组织按摩",
  },
  thai: {
    en: "Thai massage", es: "Masaje tailandés", fr: "Massage thaï", de: "Thai-Massage",
    it: "Massaggio thailandese", pt: "Massagem tailandesa", zh: "泰式按摩",
  },
  relaxing: {
    en: "Relaxing massage", es: "Masaje relajante", fr: "Massage relaxant", de: "Entspannungsmassage",
    it: "Massaggio rilassante", pt: "Massagem relaxante", zh: "放松按摩",
  },
  sports: {
    en: "Sports massage", es: "Masaje deportivo", fr: "Massage sportif", de: "Sportmassage",
    it: "Massaggio sportivo", pt: "Massagem desportiva", zh: "运动按摩",
  },
  hot_stone: {
    en: "Hot stone", es: "Piedras calientes", fr: "Pierres chaudes", de: "Hot-Stone-Massage",
    it: "Pietre calde", pt: "Pedras quentes", zh: "热石按摩",
  },
  balinese: {
    en: "Balinese", es: "Balinés", fr: "Balinais", de: "Balinesische Massage",
    it: "Balinese", pt: "Balinesa", zh: "巴厘岛按摩",
  },
  shiatsu: {
    en: "Shiatsu", es: "Shiatsu", fr: "Shiatsu", de: "Shiatsu", it: "Shiatsu", pt: "Shiatsu", zh: "指压按摩",
  },
  reflexology: {
    en: "Reflexology", es: "Reflexología", fr: "Réflexologie", de: "Reflexzonenmassage",
    it: "Riflessologia", pt: "Reflexologia", zh: "反射疗法",
  },
  lymphatic: {
    en: "Lymphatic drainage", es: "Drenaje linfático", fr: "Drainage lymphatique", de: "Lymphdrainage",
    it: "Drenaggio linfatico", pt: "Drenagem linfática", zh: "淋巴引流",
  },
  couples: {
    en: "Couples massage", es: "Masaje en pareja", fr: "Massage en duo", de: "Paarmassage",
    it: "Massaggio di coppia", pt: "Massagem para casais", zh: "情侣按摩",
  },
  prenatal: {
    en: "Prenatal massage", es: "Masaje prenatal", fr: "Massage prénatal", de: "Schwangerschaftsmassage",
    it: "Massaggio prenatale", pt: "Massagem pré-natal", zh: "孕期按摩",
  },
  facial: {
    en: "Facial", es: "Facial", fr: "Soin du visage", de: "Gesichtsbehandlung",
    it: "Trattamento viso", pt: "Facial", zh: "面部护理",
  },
};

/** Words (any language we see in the database) that identify a massage type. */
const MATCHERS: Array<[MassageTypeKey, RegExp]> = [
  ["deep_tissue", /(deep\s*tissue|descontractur|profund|tiefengew|tessuti\s*profond|descontratur)/i],
  ["thai", /(thai|tailand|tailandes|thaï)/i],
  ["hot_stone", /(hot\s*stone|piedras\s*calientes|pierres\s*chaudes|pietre\s*calde|pedras\s*quentes|hot-stone)/i],
  ["lymphatic", /(lymphat|linfat|linfát|lymphdrain|drainage\s*lymph)/i],
  ["reflexology", /(reflexolog|réflexolog|reflexzon)/i],
  ["shiatsu", /shiatsu/i],
  ["balinese", /(balines|balinés|balinais|bali)/i],
  ["couples", /(couple|pareja|parejas|duo|coppia|casais|paarmassage)/i],
  ["prenatal", /(prenatal|pre-natal|embarazad|schwangersch|prénatal|grávid)/i],
  ["sports", /(sport|deportiv|desportiv|sportiv)/i],
  ["facial", /(facial|visage|gesichts|viso)/i],
  ["relaxing", /(relax|relajante|rilassante|entspann|relaxant)/i],
];

/** Best-effort type key for a raw database service name. */
export function massageTypeKey(rawName: string | null | undefined): MassageTypeKey | null {
  const v = (rawName || "").trim();
  if (!v) return null;
  for (const [key, re] of MATCHERS) if (re.test(v)) return key;
  return null;
}

/** Localized label for a known massage type key. */
export function massageTypeLabel(key: MassageTypeKey, lang?: string | null): string {
  return LABELS[key][toFlowLang(lang)];
}

/**
 * Localized display name for a raw database service name.
 * Falls back to the original name when we do not recognise the type, so a
 * studio's own wording is never lost.
 */
export function localizedServiceName(rawName: string | null | undefined, lang?: string | null): string {
  const key = massageTypeKey(rawName);
  if (!key) return (rawName || "").trim();
  return massageTypeLabel(key, lang);
}
