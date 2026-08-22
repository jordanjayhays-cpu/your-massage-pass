/**
 * Studio tag chips come straight from the database, so values look like
 * "facial_specialists" or "masaje_deportivo". This turns them into readable
 * labels, translating the ones we know into English while leaving proper
 * names (like "Sauna finlandesa") alone.
 */
const KNOWN: Record<string, string> = {
  facial_specialists: "Facial specialists",
  facial: "Facial",
  deep_tissue: "Deep tissue",
  sports_massage: "Sports massage",
  masaje_deportivo: "Sports massage",
  masaje_descontracturante: "Deep tissue",
  masaje_relajante: "Relaxing massage",
  masaje_terapeutico: "Therapeutic massage",
  drenaje_linfatico: "Lymphatic drainage",
  pareja: "Couples",
  parejas: "Couples",
  couples: "Couples",
  english_spoken: "English spoken",
  habla_ingles: "English spoken",
  ingles: "English",
  espanol: "Spanish",
  wheelchair_accessible: "Wheelchair accessible",
  free_parking: "Free parking",
  parking: "Parking",
  aparcamiento: "Parking",
  shower: "Shower",
  ducha: "Shower",
  toallas: "Towels",
  towels: "Towels",
  wifi: "WiFi",
  tea: "Tea",
  te: "Tea",
  hot_stones: "Hot stones",
  piedras_calientes: "Hot stones",
  prenatal: "Prenatal",
  embarazadas: "Prenatal",
  sauna: "Sauna",
  jacuzzi: "Jacuzzi",
  spa: "Spa",
};

export function tagLabel(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const key = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (KNOWN[key]) return KNOWN[key];
  // Already a nicely written label (has spaces and a capital), keep as is.
  if (/\s/.test(value) && value[0] === value[0].toUpperCase()) return value;
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
