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
