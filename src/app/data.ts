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

export const MASSAGES: Massage[] = [
{
    id: "deep-fixroom",
    name: "Deep Tissue Recovery",
    studio: "The Fix Room",
    district: "Centro",
    address: "Calle Quiñones 13, Centro, Madrid 28015",
    duration: 60,
    rating: 4.9,
    reviews: 248,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Targeted deep tissue work for chronic tension and sports recovery. Top-rated near Malasaña.",
    tags: ["Deep Tissue", "Sports", "Trigger Points", "Anti-stress"],
    type: "deep",
    lat: 40.4290,
    lng: -3.7050,
    whatsapp: "+34 622 217 737",
    bookingUrl: "https://thefixroom.com",
    phone: "+34 622 217 737",
    services: ["Deep Tissue", "Sports Massage", "Trigger Points"],
  },
  {
    id: "thai-nook",
    name: "Thai Ritual Therapy",
    studio: "The Nook Madrid",
    district: "Chamberí",
    address: "Calle Zurbarán 10, Bajo Derecha, Almagro, Chamberí, Madrid 28010",
    duration: 75,
    rating: 4.8,
    reviews: 189,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Quiromasajes and ritual therapies in a calm Chamberí studio. Individual and couples sessions.",
    tags: ["Quiromasajes", "Ritual", "Couple's"],
    type: "thai",
    lat: 40.4351,
    lng: -3.7038,
    whatsapp: "+34 622 36 09 22",
    bookingUrl: "https://thenookmadrid.com/reservas-thnook-masajes-madrid/",
    phone: "+34 911 48 14 74",
    email: "reservas@thenookmadrid.com",
    services: ["Quiromasajes", "Ritual Therapies", "Couple's Massage"],
  },
  {
    id: "thai-philthai",
    name: "PhilThai Signature Blend",
    studio: "PhilThai Massage",
    district: "Chueca",
    address: "Calle Barbieri 16, Chueca, Madrid",
    duration: 75,
    rating: 4.9,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
    description: "Unique Thai blend combining traditional techniques with modern therapy. Direct WhatsApp booking.",
    tags: ["Thai", "Deep Tissue", "Aromatherapy"],
    type: "thai",
    lat: 40.4219,
    lng: -3.6945,
    whatsapp: "+34 624 143 044",
    bookingUrl: "https://philthaimassage.com",
    phone: "+34 624 143 044",
    email: "philthaimassage24@gmail.com",
    services: ["Thai Massage", "Deep Tissue", "Aromatherapy"],
  },
  {
    id: "wellness-esenzia",
    name: "Wellness & Aesthetics",
    studio: "Esenzia Chamartín",
    district: "Chamartín",
    address: "Calle Caleruega 18, Chamartín, Madrid 28033",
    duration: 60,
    rating: 5.0,
    reviews: 203,
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
    description: "TOP PICK — 5-star reviews, very close to IE. Full wellness and aesthetics studio.",
    tags: ["Massage", "Beauty", "Aesthetics", "Wellness"],
    type: "swedish",
    lat: 40.4510,
    lng: -3.6760,
    whatsapp: "+34 656 31 21 08",
    bookingUrl: "https://esenziachamartin.es",
    phone: "+34 656 31 21 08",
    services: ["Massage", "Beauty", "Aesthetics", "Wellness"],
  },
  {
    id: "swedish-spazio",
    name: "Day Spa Experience",
    studio: "Spazio Wellness",
    district: "Sol",
    address: "Calle de los Estudios 4, Centro, Madrid 28012",
    duration: 90,
    rating: 4.7,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Full day spa experience in the heart of Madrid. Massages, facials, and body treatments.",
    tags: ["Massage", "Facial", "Body Treatments"],
    type: "swedish",
    lat: 40.4150,
    lng: -3.7020,
    bookingUrl: "https://spaziowellness.es/#reservas",
    phone: "+34 615 94 55 21",
    services: ["Massage", "Facial", "Body Treatments"],
  },
  {
    id: "swedish-nuilea",
    name: "Madrid Day Spa",
    studio: "Madrid Day Spa by Nuilea",
    district: "Sol",
    address: "Calle Leon 4, Sol, Madrid 28014",
    duration: 90,
    rating: 4.8,
    reviews: 174,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
    description: "Full spa with multiple treatment rooms. Couple's massage and package deals available.",
    tags: ["Day Spa", "Couple's", "Packages"],
    type: "swedish",
    lat: 40.4140,
    lng: -3.6940,
    whatsapp: "+34 910 66 38 15",
    bookingUrl: "https://www.madrid-day-spa.com/es/reservas",
    phone: "+34 91 066 38 15",
    services: ["Day Spa", "Couple's Massage", "Packages"],
  },
  {
    id: "thai-kinuan",
    name: "Thai & Oriental Therapy",
    studio: "Masajes Kinuan",
    district: "Chamberí",
    address: "Calle Gaztambide 17, Chamberí, Madrid 28015",
    duration: 75,
    rating: 4.7,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Oriental massage specialists — Thai, reflexology, and shiatsu in Chamberí.",
    tags: ["Thai", "Reflexology", "Shiatsu"],
    type: "thai",
    lat: 40.4380,
    lng: -3.7050,
    whatsapp: "+34 639 130 235",
    bookingUrl: "https://kinuan.com/reserva/",
    phone: "+34 639 130 235",
    services: ["Thai Massage", "Reflexology", "Shiatsu"],
  },
  {
    id: "wellness-kirovital",
    name: "Wellness & Therapy",
    studio: "Kirovital",
    district: "Madrid",
    address: "Madrid",
    duration: 60,
    rating: 4.6,
    reviews: 98,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Wellness center offering therapeutic massage and wellness treatments.",
    tags: ["Massage", "Wellness", "Therapies"],
    type: "deep",
    lat: 40.4200,
    lng: -3.6900,
    bookingUrl: "https://kirovital.es/es/reservas/",
    services: ["Massage", "Wellness", "Therapies"],
  },
  {
    id: "deep-magical",
    name: "Therapeutic Massage",
    studio: "Magical Hands 369",
    district: "Chueca",
    address: "Calle Juan Álvarez Mendizábal 34, Madrid",
    duration: 60,
    rating: 4.8,
    reviews: 87,
    image: "https://images.unsplash.com/photo-1620733723572-11c53f73a416?w=800&q=80",
    description: "Independent neighborhood studio. WhatsApp direct booking.",
    tags: ["Massage", "Therapy"],
    type: "deep",
    lat: 40.4220,
    lng: -3.6930,
    whatsapp: "+34 617 78 18 22",
    phone: "+34 617 78 18 22",
    services: ["Massage", "Therapy"],
  },
  {
    id: "swedish-auraplena",
    name: "Wellness & Relaxation",
    studio: "Aura Plena",
    district: "Madrid",
    address: "Madrid",
    duration: 60,
    rating: 4.5,
    reviews: 64,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Calm wellness space for relaxation and massage. WhatsApp direct.",
    tags: ["Wellness", "Relaxation"],
    type: "swedish",
    lat: 40.4200,
    lng: -3.6900,
    whatsapp: "+34 637 10 88 77",
    services: ["Wellness", "Relaxation", "Massage"],
  },
  {
    id: "thai-chang",
    name: "Traditional Thai Massage",
    studio: "Chang Thai Massage",
    district: "Madrid",
    address: "Madrid",
    duration: 75,
    rating: 4.7,
    reviews: 112,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Traditional Thai techniques with aromatic oils. WhatsApp booking.",
    tags: ["Thai", "Aromatherapy"],
    type: "thai",
    lat: 40.4200,
    lng: -3.6900,
    whatsapp: "+34 657 326 513",
    services: ["Thai Massage", "Aromatherapy"],
  },
  {
    id: "thai-chada",
    name: "Thai & Couples Massage",
    studio: "Chada Thai Massage",
    district: "Madrid",
    address: "Madrid",
    duration: 90,
    rating: 4.6,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Thai specialist offering individual and couples sessions. WhatsApp booking.",
    tags: ["Thai", "Couple's"],
    type: "thai",
    lat: 40.4200,
    lng: -3.6900,
    whatsapp: "+34 696 76 29 17",
    services: ["Thai Massage", "Couple's Massage"],
  },
]
  {
    id: "thai-mthai",
    name: "Traditional Thai Massage",
    studio: "Mthai",
    district: "La Latina",
    address: "Carrera de San Francisco 11, La Latina, Madrid 28005",
    duration: 60,
    rating: 4.6,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Traditional Thai massage center in the heart of La Latina. Ancient Thai techniques combined with modern wellness.",
    tags: ["Thai", "Traditional", "Oil Massage", "Deep Tissue"],
    type: "thai",
    lat: 40.4107,
    lng: -3.7118,
    whatsapp: "+34 656 547 663",
    bookingUrl: "https://mthai.es/en/book-online/",
    phone: "+34 656 547 663",
    services: ["Traditional Thai Massage", "Oil Massage", "Deep Tissue", "Group Massage"]
  },
  {
    id: "oriental-fariolen",
    name: "Oriental Massage",
    studio: "Fariolen",
    district: "Salamanca",
    address: "Calle Lagasca 80, Bajo C, Salamanca, Madrid 28001",
    duration: 60,
    rating: 4.6,
    reviews: 673,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
    description: "Oriental massage specialists in Madrid's Salamanca district. Filipino, Thai, and Balinese techniques. Parking available.",
    tags: ["Oriental", "Filipino", "Thai", "Balinese"],
    type: "thai",
    lat: 40.4305,
    lng: -3.6865,
    whatsapp: "+34 679 44 71 38",
    bookingUrl: "https://www.fariolen.com/",
    phone: "+34 91 576 16 92",
    email: "masajes@fariolen.com",
    services: ["Oriental Massage", "Filipino Massage", "Thai Massage", "Balinese Massage"]
  },
  {
    id: "thai-kwantida",
    name: "Thai Massage & Spa",
    studio: "Kwantida Thai Massage & Spa",
    district: "Gran Via",
    address: "Calle Silva 5, Entre Gran Via y Plaza Santo Domingo, Madrid 28013",
    duration: 60,
    rating: 4.5,
    reviews: 186,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Thai massage and spa with two Madrid locations. Ancient Thai techniques for relaxation and healing.",
    tags: ["Thai", "Hot Stone", "Aromatherapy", "Spa"],
    type: "thai",
    lat: 40.4235,
    lng: -3.71,
    whatsapp: "+34 605 66 47 85",
    bookingUrl: "https://kwantidathaimassagespa.com/",
    phone: "+34 911 57 46 95",
    services: ["Thai Massage", "Hot Stone", "Aromatherapy", "Back Massage"]
  },
  {
    id: "arabic-hammam",
    name: "Arab Bath Experience",
    studio: "Hammam Al Ándalus",
    district: "Huertas",
    address: "Calle de Atocha 14, Huertas, Madrid 28012",
    duration: 90,
    rating: 4.7,
    reviews: 2841,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Arab bath experience in the heart of Madrid. Three-temperature water circuit plus optional massages.",
    tags: ["Arab Bath", "Hammam", "Ritual", "Water Journey"],
    type: "swedish",
    lat: 40.412,
    lng: -3.695,
    bookingUrl: "https://madrid.hammamalandalus.com/en/",
    phone: "+34 914 299 020",
    services: ["Hammam Circuit", "Massage", "Aromatherapy Massage"]
  },
  {
    id: "oriental-shangrila",
    name: "Oriental Massage Center",
    studio: "Shangri-La",
    district: "Chamberí",
    address: "Calle de Raimundo Lulio 10, Chamberí, Madrid 28010",
    duration: 60,
    rating: 4.4,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
    description: "Oriental massage center in Chamberí. Filipino, Thai, and traditional Chinese massage techniques.",
    tags: ["Oriental", "Filipino", "Thai", "Chinese"],
    type: "thai",
    lat: 40.432,
    lng: -3.697,
    phone: "+34 914 347 158",
    services: ["Oriental Massage", "Filipino Massage", "Thai Massage"]
  },
  {
    id: "thai-orchid",
    name: "Thai Orchid Spa & Massage",
    studio: "Thai Orchid Spa",
    district: "Chamartín",
    address: "Calle Velázquez 136 Bajo A Spa 22, Chamartín, Madrid 28006",
    duration: 60,
    rating: 4.6,
    reviews: 124,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
    description: "Thai Orchid Spa offers authentic Thai massage in the prestigious Chamartín district.",
    tags: ["Thai", "Orchid", "Spa", "Massage"],
    type: "thai",
    lat: 40.4395,
    lng: -3.687,
    services: ["Thai Massage", "Spa"]
  },
  {
    id: "sports-feelfit",
    name: "Sports & Therapeutic Massage",
    studio: "Feel Fit",
    district: "Salamanca",
    address: "Calle de Alonso Heredia 5, Salamanca, Madrid 28028",
    duration: 60,
    rating: 4.5,
    reviews: 201,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Sports and therapeutic massage clinic in Salamanca. Specializes in injury recovery, chronic pain, and athletic performance.",
    tags: ["Sports", "Therapeutic", "Deep Tissue", "Recovery"],
    type: "sports",
    lat: 40.4285,
    lng: -3.68,
    services: ["Sports Massage", "Therapeutic Massage", "Deep Tissue"]
  },
  {
    id: "swedish-labroom",
    name: "Lab Room Wellness",
    studio: "The Lab Room",
    district: "Salamanca",
    address: "Calle de Claudio Coello 13 bis, Salamanca, Madrid 28001",
    duration: 60,
    rating: 4.6,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
    description: "Premium beauty and wellness salon in Salamanca's golden mile. Expert facials and massage treatments.",
    tags: ["Beauty", "Wellness", "Facial", "Massage"],
    type: "swedish",
    lat: 40.43,
    lng: -3.685,
    bookingUrl: "https://thelabroom.com/en/",
    phone: "+34 914 312 198",
    email: "info@thelabroom.com",
    services: ["Massage", "Facial", "Beauty Treatments"]
  },
  {
    id: "thai-xiaoying",
    name: "Masajes Orientales Madrid",
    studio: "Masajes Orientales Xiao Ying",
    district: "La Latina",
    address: "Calle de la Ruda 5, La Latina, Madrid 28005",
    duration: 60,
    rating: 4.3,
    reviews: 94,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Traditional Chinese and oriental massage techniques. Budget-friendly option in La Latina.",
    tags: ["Chinese", "Oriental", "Budget-Friendly"],
    type: "thai",
    lat: 40.408,
    lng: -3.713,
    services: ["Chinese Massage", "Oriental Massage"]
  },
  {
    id: "deep-sanitas",
    name: "Deep Tissue Therapy",
    studio: "Sanitas Centro de Masaje",
    district: "Retiro",
    address: "Calle de Alcalá 173, Retiro, Madrid 28009",
    duration: 60,
    rating: 4.4,
    reviews: 178,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Deep tissue therapy and therapeutic massage near Retiro park. Professional therapists for chronic pain and stress relief.",
    tags: ["Deep Tissue", "Therapeutic", "Stress Relief", "Chronic Pain"],
    type: "deep",
    lat: 40.4165,
    lng: -3.678,
    services: ["Deep Tissue", "Therapeutic Massage", "Stress Relief"]
  },
];;

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

