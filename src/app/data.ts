export type MassageType =
  | "swedish"
  | "deep"
  | "stone"
  | "sports"
  | "thai"
  | "lomi";

export type Massage = {
  id: string;
  name: string;
  studio: string;
  district: string;
  duration: number;
  rating: number;
  reviews: number;
  image: string;
  description: string;
  tags: string[];
  type: MassageType;
  lat: number;
  lng: number;
  whatsapp?: string;
  bookingUrl?: string;
  address: string;
  phone?: string;
  email?: string;
  services?: string[];
  basePrice?: number;
  km?: number;
  walkingText?: string;
};

// Studio data comes from the database (partners table). No hardcoded demo studios.

export const MASSAGE_TYPES: {
  id: MassageType;
  name: string;
  short: string;
  description: string;
  bestFor: string[];
  pressure: "Light" | "Medium" | "Firm" | "Deep";
  image: string;
}[] = [
  {
    id: "swedish",
    name: "Swedish",
    short: "Classic relaxation",
    description: "Long, gliding strokes with light to medium pressure to relax muscles and improve circulation.",
    bestFor: ["First-timers", "Stress", "General relaxation"],
    pressure: "Medium",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
  },
  {
    id: "deep",
    name: "Deep Tissue",
    short: "Reach the deep layers",
    description: "Slower strokes with sustained, firm pressure to target chronic tension in deeper muscle layers.",
    bestFor: ["Chronic pain", "Office tension", "Posture issues"],
    pressure: "Deep",
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
  },
  {
    id: "stone",
    name: "Hot Stone",
    short: "Heated basalt ritual",
    description: "Heated basalt stones melt tension while warm oils restore your skin.",
    bestFor: ["Muscle tension", "Circulation", "Deep relaxation"],
    pressure: "Medium",
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
  },
  {
    id: "sports",
    name: "Sports Recovery",
    short: "Athletic performance",
    description: "Built for athletes. Combines stretching, deep work and trigger-point release.",
    bestFor: ["Athletes", "Post-workout", "Injury recovery"],
    pressure: "Firm",
    image: "https://images.unsplash.com/photo-1620733723572-11c53f73a416?w=800&q=80",
  },
  {
    id: "thai",
    name: "Thai Bodywork",
    short: "Stretch & compress",
    description: "Assisted stretches and rhythmic compression. You leave feeling longer, lighter, freer.",
    bestFor: ["Mobility", "Energy", "Chronic tightness"],
    pressure: "Firm",
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
  },
  {
    id: "lomi",
    name: "Lomi Lomi",
    short: "Hawaiian flowing massage",
    description: "Hawaiian flowing massage with forearm work. Deeply meditative.",
    bestFor: ["Flow state", "Meditation", "Deep relaxation"],
    pressure: "Medium",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
  },
];

export type MassageGuide = {
  id: string;
  name: string;
  origin: string;
  tagline: string;
  description: string;
  howItWorks: string;
  feels: string;
  pressure: "Light" | "Medium" | "Firm" | "Deep" | "Varies";
  duration: string;
  usesOil: boolean;
  clothed: boolean;
  bestFor: string[];
  goodToKnow: string;
  bookable: boolean;
  relatedType?: MassageType;
  studioMatch: string[];
  image: string;
};

export const MASSAGE_GUIDE: MassageGuide[] = [
  { id: "swedish", name: "Swedish", origin: "Sweden · the modern classic", tagline: "The gentle all-rounder", description: "The most common Western massage. Long, gliding strokes with light-to-medium pressure to relax the whole body and boost circulation. The safe starting point if you're not sure what to book.", howItWorks: "Gliding (effleurage), kneading and light tapping with oil, head to toe.", feels: "Soothing and warming — you'll likely drift off.", pressure: "Medium", duration: "60–90 min", usesOil: true, clothed: false, bestFor: ["First-timers", "Stress relief", "Better circulation", "Winding down"], goodToKnow: "Ask for firmer pressure any time — Swedish adapts easily.", bookable: true, relatedType: "swedish", studioMatch: ["swedish", "relax", "wellness", "spa"], image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80" },
  { id: "deep", name: "Deep Tissue", origin: "Western therapeutic", tagline: "For stubborn knots", description: "Slow strokes and sustained, firm pressure that reach the deeper muscle layers to release chronic tension. Therapeutic rather than purely relaxing.", howItWorks: "Slow, deliberate pressure and friction across the muscle, often with elbows and forearms.", feels: "Intense in spots ('good pain'), then a deep release.", pressure: "Deep", duration: "60–90 min", usesOil: true, clothed: false, bestFor: ["Chronic pain", "Desk/posture tension", "Tight shoulders & back"], goodToKnow: "Drink water after, and skip it on a fresh injury.", bookable: true, relatedType: "deep", studioMatch: ["deep", "therapeutic", "trigger", "sports"], image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80" },
  { id: "sports", name: "Sports Recovery", origin: "Western therapeutic", tagline: "Recovery for active bodies", description: "Built for athletes and active people. Combines stretching, deep work and trigger-point release to aid recovery and prevent injury.", howItWorks: "Targeted deep work, assisted stretching and friction on specific muscle groups.", feels: "Focused and firm, energising afterwards.", pressure: "Firm", duration: "45–75 min", usesOil: true, clothed: false, bestFor: ["Athletes", "Post-workout recovery", "Injury prevention", "Mobility"], goodToKnow: "Great the day after hard training, not right before a race.", bookable: true, relatedType: "sports", studioMatch: ["sport", "recovery", "deep", "therapeutic"], image: "https://images.unsplash.com/photo-1620733723572-11c53f73a416?w=800&q=80" },
  { id: "thai", name: "Thai Bodywork", origin: "Thailand · 2,500-year tradition", tagline: "Assisted yoga, no effort required", description: "Done on a mat, fully clothed, with no oil. The therapist uses hands, thumbs, elbows, knees and feet to press energy lines and move you through assisted stretches.", howItWorks: "Rhythmic compression along 'sen' lines plus deep assisted stretching.", feels: "Like being gently folded and stretched — you leave longer and lighter.", pressure: "Firm", duration: "60–120 min", usesOil: false, clothed: true, bestFor: ["Mobility & flexibility", "Energy", "Chronic tightness"], goodToKnow: "Wear loose clothes. Mention pregnancy or recent surgery first.", bookable: true, relatedType: "thai", studioMatch: ["thai", "oriental", "stretch"], image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80" },
  { id: "stone", name: "Hot Stone", origin: "Indigenous & modern spa", tagline: "Heat that melts tension", description: "Smooth heated basalt stones are placed on the body and used to massage. The warmth relaxes muscles faster and deeper than hands alone.", howItWorks: "Warm stones glided over and rested on key muscles, with oil.", feels: "Deeply warming and cocooning.", pressure: "Medium", duration: "75–90 min", usesOil: true, clothed: false, bestFor: ["Deep relaxation", "Cold hands & feet", "Muscle tension"], goodToKnow: "Tell the therapist if you run hot, and skip if pregnant or heart-sensitive.", bookable: true, relatedType: "stone", studioMatch: ["stone", "hot stone", "spa", "thai"], image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80" },
  { id: "lomi", name: "Lomi Lomi", origin: "Hawaii", tagline: "Flowing, meditative strokes", description: "Traditional Hawaiian massage using long, continuous forearm strokes in flowing, wave-like movements. As much emotional as physical.", howItWorks: "Long dancing forearm strokes that flow across the whole body.", feels: "Rhythmic and trance-like, deeply calming.", pressure: "Medium", duration: "60–90 min", usesOil: true, clothed: false, bestFor: ["Emotional release", "Flow state", "Deep relaxation"], goodToKnow: "Less common in Madrid — call ahead to confirm availability.", bookable: false, relatedType: "lomi", studioMatch: ["lomi", "hawaiian", "ritual", "holistic"], image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80" },
  { id: "shiatsu", name: "Shiatsu", origin: "Japan", tagline: "Finger pressure on energy lines", description: "A Japanese technique done clothed, with no oil. The therapist applies rhythmic thumb and palm pressure to points along the body's meridians to rebalance energy and relieve tension.", howItWorks: "Pulsing thumb, palm and finger pressure on acupressure points; some gentle stretching.", feels: "Firm, rhythmic presses — relaxing and grounding.", pressure: "Firm", duration: "60–90 min", usesOil: false, clothed: true, bestFor: ["Stress", "Low-back pain", "Tension headaches", "Energy balance"], goodToKnow: "You stay fully clothed — wear something comfy.", bookable: true, relatedType: "thai", studioMatch: ["shiatsu", "oriental", "kinuan", "kamiraku"], image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80" },
  { id: "reflexology", name: "Reflexology", origin: "China & Egypt", tagline: "Your whole body, mapped on your feet", description: "Pressure is applied to specific reflex points on the feet (sometimes hands or ears) that correspond to organs and systems, to promote relaxation and balance throughout the body.", howItWorks: "Thumb-walking and pressure on mapped points of the feet.", feels: "Surprisingly relaxing; some points feel tender.", pressure: "Medium", duration: "30–60 min", usesOil: true, clothed: true, bestFor: ["Deep relaxation", "Circulation", "Tired feet", "Better sleep"], goodToKnow: "You only need to take off your shoes and socks.", bookable: true, relatedType: "thai", studioMatch: ["reflex", "oriental", "kinuan"], image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80" },
  { id: "aromatherapy", name: "Aromatherapy", origin: "Western herbal tradition", tagline: "Massage that shifts your mood", description: "A gentle full-body massage combined with essential oils chosen for how they make you feel — calming lavender, uplifting citrus, and more. Absorbed through the skin and inhaled.", howItWorks: "Soft Swedish-style strokes with a blended, diluted essential-oil mix.", feels: "Light, scented and emotionally soothing.", pressure: "Light", duration: "60–90 min", usesOil: true, clothed: false, bestFor: ["Stress & anxiety", "Low mood", "Sleep", "Self-care"], goodToKnow: "Flag pregnancy or allergies so oils can be adjusted.", bookable: true, relatedType: "swedish", studioMatch: ["aroma", "thai", "spa", "wellness"], image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80" },
  { id: "balinese", name: "Balinese", origin: "Indonesia", tagline: "Stretch, press and knead with warm oil", description: "One of Madrid's most-requested oriental massages. Combines gentle stretches, acupressure and firm kneading with aromatic oil for a full-body therapeutic-yet-relaxing experience.", howItWorks: "Long strokes, skin rolling, acupressure and stretching with warm oil.", feels: "Firm but soothing — thorough head-to-toe.", pressure: "Firm", duration: "60–90 min", usesOil: true, clothed: false, bestFor: ["Full-body relief", "Stress", "Circulation", "Headaches"], goodToKnow: "A great middle ground between relaxing and deep.", bookable: true, relatedType: "thai", studioMatch: ["balinese", "oriental", "fariolen"], image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80" },
  { id: "lymphatic", name: "Lymphatic Drainage", origin: "Western (Vodder method)", tagline: "Gentle strokes that de-puff", description: "A very light, rhythmic technique that stimulates the lymphatic system just under the skin to move fluid, reduce swelling and support recovery. Much gentler than it sounds.", howItWorks: "Feather-light, precise strokes following the direction of lymph flow.", feels: "Extremely gentle and calming.", pressure: "Light", duration: "45–75 min", usesOil: false, clothed: false, bestFor: ["Swelling / water retention", "Post-surgery recovery", "Heavy legs", "Detox feeling"], goodToKnow: "Avoid with active infection, or heart/kidney conditions — check with a doctor.", bookable: true, relatedType: "swedish", studioMatch: ["lymphatic", "drainage", "wellness", "aesthetic", "beauty"], image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80" },
  { id: "prenatal", name: "Prenatal", origin: "Western therapeutic", tagline: "Pregnancy-safe relief", description: "A gentle massage adapted for pregnancy, easing the back, hip and leg aches that come with carrying extra weight, while reducing stress and swelling.", howItWorks: "Side-lying or on a cushioned table, mild Swedish-style pressure on safe areas.", feels: "Supportive, gentle and reassuring.", pressure: "Light", duration: "50–70 min", usesOil: true, clothed: false, bestFor: ["Pregnancy aches", "Swollen legs", "Better sleep", "Stress"], goodToKnow: "Usually for 2nd & 3rd trimester — clear it with your doctor first.", bookable: true, relatedType: "swedish", studioMatch: ["prenatal", "pregnan", "wellness", "spa"], image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80" },
  { id: "ayurvedic", name: "Ayurvedic (Abhyanga)", origin: "India", tagline: "Warm herbal oils, head to toe", description: "A cornerstone of Ayurveda. Generous amounts of warm herbal oil are massaged in with rhythmic strokes to nourish the skin, calm the nervous system and balance the body.", howItWorks: "Synchronised flowing strokes with abundant warm, dosha-matched oil.", feels: "Warm, slippery and deeply sedating.", pressure: "Medium", duration: "60–90 min", usesOil: true, clothed: false, bestFor: ["Deep relaxation", "Dry skin", "Stress", "Sleep"], goodToKnow: "You'll want a shower after — lots of oil. Bring a hair tie.", bookable: true, relatedType: "swedish", studioMatch: ["ayurved", "abhyanga", "kamiraku", "oriental"], image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80" },
  { id: "hammam", name: "Hammam / Arab Bath", origin: "Andalusia & the Middle East", tagline: "A bathing ritual, not just a massage", description: "A heritage Madrid experience: a circuit of warm, hot and cold thermal baths, often with a 'kessa' exfoliating scrub and an optional massage. As much ritual as treatment.", howItWorks: "Move between thermal pools and steam, then a foam scrub and/or massage.", feels: "Cleansing, glowing and serene.", pressure: "Varies", duration: "60–120 min", usesOil: true, clothed: false, bestFor: ["Skin glow", "Couples & special occasions", "Relaxation ritual", "Circulation"], goodToKnow: "Bring or rent a swimsuit; book the scrub add-on for the full effect.", bookable: true, relatedType: "swedish", studioMatch: ["hammam", "arab", "bath", "andalus"], image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80" },
  { id: "kobido", name: "Kobido", origin: "Japan", tagline: "The Japanese facial 'lifting' massage", description: "A centuries-old Japanese facial massage using fast, rhythmic strokes to tone facial muscles, boost circulation and release jaw and brow tension — a natural glow-and-lift.", howItWorks: "Rapid percussive and kneading strokes across the face and neck with a serum or light oil.", feels: "Invigorating then deeply relaxing; your face feels awake.", pressure: "Light", duration: "45–75 min", usesOil: true, clothed: true, bestFor: ["Facial tension & jaw/TMJ", "Natural glow", "Relaxation", "Brightening"], goodToKnow: "Come without heavy makeup for the best result.", bookable: true, relatedType: "swedish", studioMatch: ["kobido", "facial", "kamiraku", "beauty", "aesthetic"], image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80" },
];

export const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };

export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============ Additional exports ============

export const TIME_SLOTS = [
  "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

export function getNextDays(n: number) {
  const days: { date: Date; iso: string; label: string; day: string; num: string }[] = [];
  const today = new Date();
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d,
      iso: d.toISOString().slice(0, 10),
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayLabels[d.getDay()],
      day: dayLabels[d.getDay()],
      num: String(d.getDate()),
    });
  }
  return days;
}

export const PRESSURE_LEVELS: string[] = ["Light", "Medium", "Firm", "Deep"];

export const FOCUS_AREAS: string[] = [
  "Neck", "Shoulders", "Upper Back", "Lower Back",
  "Legs", "Feet", "Arms", "Hands",
];

export const ADD_ONS: { id: string; name: string; price: number; description: string }[] = [
  { id: "aromatherapy", name: "Aromatherapy", price: 10, description: "Essential oil blend" },
  { id: "hot-stones", name: "Hot Stones", price: 15, description: "Heated basalt stones" },
  { id: "scalp", name: "Scalp Massage", price: 12, description: "10-minute scalp work" },
  { id: "extended", name: "+15 minutes", price: 20, description: "Extra time" },
];

export const QUIZ: {
  id: string;
  question: string;
  options: { id: string; label: string; scores: Partial<Record<MassageType, number>> }[];
}[] = [
  {
    id: "goal",
    question: "What's your main goal today?",
    options: [
      { id: "relax", label: "Pure relaxation", scores: { swedish: 3, lomi: 2, stone: 2 } },
      { id: "pain", label: "Relieve pain or tension", scores: { deep: 3, sports: 2, thai: 1 } },
      { id: "energy", label: "Feel energized", scores: { thai: 3, sports: 2 } },
      { id: "ritual", label: "A special ritual", scores: { stone: 3, lomi: 3 } },
    ],
  },
  {
    id: "pressure",
    question: "How much pressure do you like?",
    options: [
      { id: "light", label: "Light & gentle", scores: { swedish: 3, lomi: 2 } },
      { id: "medium", label: "Medium", scores: { swedish: 2, stone: 2, lomi: 1 } },
      { id: "firm", label: "Firm", scores: { thai: 3, sports: 2, deep: 1 } },
      { id: "deep", label: "Deep & intense", scores: { deep: 3, sports: 2 } },
    ],
  },
  {
    id: "experience",
    question: "How often do you get massages?",
    options: [
      { id: "first", label: "First time", scores: { swedish: 3, stone: 1 } },
      { id: "occasional", label: "Occasionally", scores: { swedish: 2, deep: 1, thai: 1 } },
      { id: "regular", label: "Regularly", scores: { deep: 2, sports: 2, thai: 2 } },
    ],
  },
];

