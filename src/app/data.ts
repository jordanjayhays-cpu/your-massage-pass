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
};

export const MASSAGES: Massage[] = [
  {
    id: "swedish-cibeles",
    name: "Swedish Relax",
    studio: "Casa Cibeles",
    district: "Centro",
    duration: 60,
    rating: 4.9,
    reviews: 248,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
    description:
      "Long, flowing strokes designed to release surface tension and ease your nervous system. Perfect after a busy week in the city.",
    tags: ["Relax", "Aromatherapy", "Full body"],
    type: "swedish",
    lat: 40.4193,
    lng: -3.6929,
  },
  {
    id: "deep-retiro",
    name: "Deep Tissue",
    studio: "El Retiro Wellness",
    district: "Retiro",
    duration: 75,
    rating: 4.8,
    reviews: 189,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description:
      "Targeted pressure that reaches the deeper layers of muscle. Ideal for chronic tension and recovery.",
    tags: ["Recovery", "Pressure", "Targeted"],
    type: "deep",
    lat: 40.4153,
    lng: -3.6844,
  },
  {
    id: "stone-salamanca",
    name: "Hot Stone Ritual",
    studio: "Salamanca Spa Real",
    district: "Salamanca",
    duration: 90,
    rating: 5.0,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
    description:
      "Heated basalt stones melt tension while warm oils restore your skin. A signature ritual.",
    tags: ["Heat", "Luxury", "Signature"],
    type: "stone",
    lat: 40.4288,
    lng: -3.6797,
  },
  {
    id: "sports-chamberi",
    name: "Sports Recovery",
    studio: "Chamberí Manos",
    district: "Chamberí",
    duration: 60,
    rating: 4.7,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1620733723572-11c53f73a416?w=800&q=80",
    description:
      "Built for athletes. Combines stretching, deep work and trigger-point release.",
    tags: ["Athletic", "Stretch", "Recovery"],
    type: "sports",
    lat: 40.4351,
    lng: -3.7038,
  },
  {
    id: "thai-malasana",
    name: "Thai Bodywork",
    studio: "Malasaña Holístico",
    district: "Malasaña",
    duration: 75,
    rating: 4.9,
    reviews: 203,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description:
      "Assisted stretches and rhythmic compression. You leave feeling longer, lighter, freer.",
    tags: ["Stretch", "Energy", "Mobility"],
    type: "thai",
    lat: 40.4262,
    lng: -3.7044,
  },
  {
    id: "lomi-latina",
    name: "Lomi Lomi",
    studio: "La Latina Termas",
    district: "La Latina",
    duration: 90,
    rating: 4.8,
    reviews: 174,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Hawaiian flowing massage with forearm work. Deeply meditative.",
    tags: ["Flow", "Meditative", "Oils"],
    type: "lomi",
    lat: 40.4109,
    lng: -3.7106,
  },
];

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
    description:
      "The most popular massage worldwide. Long, gliding strokes with light to medium pressure to relax muscles and improve circulation.",
    bestFor: ["First-timers", "Stress", "General relaxation"],
    pressure: "Medium",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
  },
  {
    id: "deep",
    name: "Deep Tissue",
    short: "Reach the deep layers",
    description:
      "Slower strokes with sustained, firm pressure to target chronic tension in deeper layers of muscle and connective tissue.",
    bestFor: ["Chronic pain", "Office tension", "Posture issues"],
    pressure: "Deep",
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
  },
  {
    id: "stone",
    name: "Hot Stone",
    short: "Warm, melting calm",
    description:
      "Heated basalt stones placed on the body and used as massage tools. The warmth penetrates deeply and softens tight muscles.",
    bestFor: ["Cold weather", "Anxiety", "Sleep"],
    pressure: "Medium",
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
  },
  {
    id: "sports",
    name: "Sports",
    short: "Recover & perform",
    description:
      "Combines stretching, trigger-point work and deep tissue. Designed for active bodies before or after training.",
    bestFor: ["Athletes", "Soreness", "Mobility"],
    pressure: "Firm",
    image: "https://images.unsplash.com/photo-1620733723572-11c53f73a416?w=800&q=80",
  },
  {
    id: "thai",
    name: "Thai",
    short: "Assisted stretching",
    description:
      "On a mat, fully clothed. The therapist uses hands, elbows and feet to apply pressure and guide you through deep stretches.",
    bestFor: ["Stiffness", "Energy", "Flexibility"],
    pressure: "Firm",
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
  },
  {
    id: "lomi",
    name: "Lomi Lomi",
    short: "Hawaiian flow",
    description:
      "Long, continuous forearm strokes that move across the whole body. Deeply meditative and rhythmic.",
    bestFor: ["Mental fatigue", "Emotional release", "Full-body flow"],
    pressure: "Medium",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
  },
];

// Quiz: 4 questions. Each option scores points toward types.
export const QUIZ: {
  id: string;
  question: string;
  options: { label: string; scores: Partial<Record<MassageType, number>> }[];
}[] = [
  {
    id: "goal",
    question: "What's your main goal today?",
    options: [
      { label: "Pure relaxation", scores: { swedish: 3, lomi: 2, stone: 2 } },
      { label: "Relieve muscle pain", scores: { deep: 3, sports: 2 } },
      { label: "Improve flexibility", scores: { thai: 3, sports: 1 } },
      { label: "Mental reset", scores: { lomi: 3, stone: 2, swedish: 1 } },
    ],
  },
  {
    id: "pressure",
    question: "How firm do you like the pressure?",
    options: [
      { label: "Light & gentle", scores: { swedish: 3, lomi: 2 } },
      { label: "Medium", scores: { swedish: 2, stone: 2, lomi: 1 } },
      { label: "Firm", scores: { sports: 2, thai: 2, deep: 1 } },
      { label: "As deep as possible", scores: { deep: 3, sports: 1 } },
    ],
  },
  {
    id: "lifestyle",
    question: "Which sounds most like you right now?",
    options: [
      { label: "Desk all day, tight shoulders", scores: { deep: 3, swedish: 1 } },
      { label: "Active / training a lot", scores: { sports: 3, thai: 1 } },
      { label: "Burned out, need calm", scores: { stone: 3, lomi: 2, swedish: 1 } },
      { label: "Stiff & inflexible", scores: { thai: 3, deep: 1 } },
    ],
  },
  {
    id: "vibe",
    question: "Which vibe do you prefer?",
    options: [
      { label: "Warm & cozy", scores: { stone: 3, lomi: 1 } },
      { label: "Quiet & meditative", scores: { lomi: 3, swedish: 1 } },
      { label: "Energizing", scores: { thai: 3, sports: 1 } },
      { label: "Therapeutic & clinical", scores: { deep: 3, sports: 2 } },
    ],
  },
];

export const PRESSURE_LEVELS = ["Light", "Medium", "Firm", "Deep"] as const;
export const FOCUS_AREAS = [
  "Neck & shoulders",
  "Back",
  "Lower back",
  "Legs",
  "Feet",
  "Full body",
] as const;
export const ADD_ONS = [
  { id: "aroma", name: "Aromatherapy", price: 0 },
  { id: "scalp", name: "Scalp & head massage", price: 0 },
  { id: "hot-towel", name: "Hot towel finish", price: 0 },
  { id: "extend-30", name: "Extend +30 min", price: 25 },
] as const;

export const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:30",
  "14:00",
  "15:30",
  "17:00",
  "18:30",
  "20:00",
];

export function getNextDays(count: number) {
  const days: { date: Date; iso: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({ date: d, iso: d.toISOString().split("T")[0] });
  }
  return days;
}

// Center of Madrid (Puerta del Sol) — used as default user location
export const MADRID_CENTER = { lat: 40.4168, lng: -3.7038 };

// Haversine distance in km
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
