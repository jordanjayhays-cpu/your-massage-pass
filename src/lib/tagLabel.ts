import { toFlowLang, type FlowLang } from "@/lib/flowLang";

/**
 * Studio tag chips come straight from the database, so values look like
 * "facial_specialists" or "masaje_deportivo". This turns them into readable,
 * localized labels, translating the ones we know while leaving proper names
 * (like "Sauna finlandesa") alone.
 */
const KNOWN: Record<string, Record<FlowLang, string>> = {
  facial_specialists: { en: "Facial specialists", es: "Especialistas en facial", fr: "Spécialistes du soin du visage", de: "Gesichtsspezialisten", it: "Specialisti del viso", pt: "Especialistas em facial", zh: "面部护理专家" },
  facial: { en: "Facial", es: "Facial", fr: "Soin du visage", de: "Gesichtsbehandlung", it: "Trattamento viso", pt: "Facial", zh: "面部护理" },
  deep_tissue: { en: "Deep tissue", es: "Descontracturante", fr: "Tissus profonds", de: "Tiefengewebsmassage", it: "Tessuti profondi", pt: "Tecidos profundos", zh: "深层组织按摩" },
  sports_massage: { en: "Sports massage", es: "Masaje deportivo", fr: "Massage sportif", de: "Sportmassage", it: "Massaggio sportivo", pt: "Massagem desportiva", zh: "运动按摩" },
  masaje_deportivo: { en: "Sports massage", es: "Masaje deportivo", fr: "Massage sportif", de: "Sportmassage", it: "Massaggio sportivo", pt: "Massagem desportiva", zh: "运动按摩" },
  masaje_descontracturante: { en: "Deep tissue", es: "Descontracturante", fr: "Tissus profonds", de: "Tiefengewebsmassage", it: "Tessuti profondi", pt: "Tecidos profundos", zh: "深层组织按摩" },
  masaje_relajante: { en: "Relaxing massage", es: "Masaje relajante", fr: "Massage relaxant", de: "Entspannungsmassage", it: "Massaggio rilassante", pt: "Massagem relaxante", zh: "放松按摩" },
  masaje_terapeutico: { en: "Therapeutic massage", es: "Masaje terapéutico", fr: "Massage thérapeutique", de: "Therapeutische Massage", it: "Massaggio terapeutico", pt: "Massagem terapêutica", zh: "理疗按摩" },
  drenaje_linfatico: { en: "Lymphatic drainage", es: "Drenaje linfático", fr: "Drainage lymphatique", de: "Lymphdrainage", it: "Drenaggio linfatico", pt: "Drenagem linfática", zh: "淋巴引流" },
  pareja: { en: "Couples", es: "Parejas", fr: "Couples", de: "Paare", it: "Coppie", pt: "Casais", zh: "情侣" },
  parejas: { en: "Couples", es: "Parejas", fr: "Couples", de: "Paare", it: "Coppie", pt: "Casais", zh: "情侣" },
  couples: { en: "Couples", es: "Parejas", fr: "Couples", de: "Paare", it: "Coppie", pt: "Casais", zh: "情侣" },
  english_spoken: { en: "English spoken", es: "Habla inglés", fr: "Anglais parlé", de: "Englisch gesprochen", it: "Inglese parlato", pt: "Fala inglês", zh: "会说英语" },
  habla_ingles: { en: "English spoken", es: "Habla inglés", fr: "Anglais parlé", de: "Englisch gesprochen", it: "Inglese parlato", pt: "Fala inglês", zh: "会说英语" },
  ingles: { en: "English", es: "Inglés", fr: "Anglais", de: "Englisch", it: "Inglese", pt: "Inglês", zh: "英语" },
  espanol: { en: "Spanish", es: "Español", fr: "Espagnol", de: "Spanisch", it: "Spagnolo", pt: "Espanhol", zh: "西班牙语" },
  wheelchair_accessible: { en: "Wheelchair accessible", es: "Acceso en silla de ruedas", fr: "Accès fauteuil roulant", de: "Rollstuhlgerecht", it: "Accessibile in sedia a rotelle", pt: "Acesso para cadeira de rodas", zh: "轮椅无障碍" },
  free_parking: { en: "Free parking", es: "Aparcamiento gratis", fr: "Parking gratuit", de: "Kostenlose Parkplätze", it: "Parcheggio gratuito", pt: "Estacionamento grátis", zh: "免费停车" },
  parking: { en: "Parking", es: "Aparcamiento", fr: "Parking", de: "Parkplatz", it: "Parcheggio", pt: "Estacionamento", zh: "停车场" },
  aparcamiento: { en: "Parking", es: "Aparcamiento", fr: "Parking", de: "Parkplatz", it: "Parcheggio", pt: "Estacionamento", zh: "停车场" },
  shower: { en: "Shower", es: "Ducha", fr: "Douche", de: "Dusche", it: "Doccia", pt: "Duche", zh: "淋浴" },
  ducha: { en: "Shower", es: "Ducha", fr: "Douche", de: "Dusche", it: "Doccia", pt: "Duche", zh: "淋浴" },
  toallas: { en: "Towels", es: "Toallas", fr: "Serviettes", de: "Handtücher", it: "Asciugamani", pt: "Toalhas", zh: "毛巾" },
  towels: { en: "Towels", es: "Toallas", fr: "Serviettes", de: "Handtücher", it: "Asciugamani", pt: "Toalhas", zh: "毛巾" },
  wifi: { en: "WiFi", es: "WiFi", fr: "WiFi", de: "WLAN", it: "WiFi", pt: "WiFi", zh: "WiFi" },
  tea: { en: "Tea", es: "Té", fr: "Thé", de: "Tee", it: "Tè", pt: "Chá", zh: "茶" },
  te: { en: "Tea", es: "Té", fr: "Thé", de: "Tee", it: "Tè", pt: "Chá", zh: "茶" },
  hot_stones: { en: "Hot stones", es: "Piedras calientes", fr: "Pierres chaudes", de: "Hot-Stone", it: "Pietre calde", pt: "Pedras quentes", zh: "热石" },
  piedras_calientes: { en: "Hot stones", es: "Piedras calientes", fr: "Pierres chaudes", de: "Hot-Stone", it: "Pietre calde", pt: "Pedras quentes", zh: "热石" },
  prenatal: { en: "Prenatal", es: "Prenatal", fr: "Prénatal", de: "Schwangerschaft", it: "Prenatale", pt: "Pré-natal", zh: "孕期" },
  embarazadas: { en: "Prenatal", es: "Embarazadas", fr: "Prénatal", de: "Schwangerschaft", it: "Prenatale", pt: "Pré-natal", zh: "孕期" },
  sauna: { en: "Sauna", es: "Sauna", fr: "Sauna", de: "Sauna", it: "Sauna", pt: "Sauna", zh: "桑拿" },
  jacuzzi: { en: "Jacuzzi", es: "Jacuzzi", fr: "Jacuzzi", de: "Jacuzzi", it: "Jacuzzi", pt: "Jacuzzi", zh: "按摩浴缸" },
  spa: { en: "Spa", es: "Spa", fr: "Spa", de: "Spa", it: "Spa", pt: "Spa", zh: "水疗" },
};

/**
 * Localized label for a raw database tag key. `lang` defaults to "en" so
 * callers outside the flow (which may not have a FlowLang handy) keep working.
 */
export function tagLabel(raw: string, lang?: string | null): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const key = value.toLowerCase().replace(/[\s-]+/g, "_");
  const known = KNOWN[key];
  if (known) return known[toFlowLang(lang)] ?? known.en;
  // Already a nicely written label (has spaces and a capital), keep as is.
  if (/\s/.test(value) && value[0] === value[0].toUpperCase()) return value;
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
