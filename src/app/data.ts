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
    description: "Long, flowing strokes designed to release surface tension and ease your nervous system. Perfect after a busy week in the city.",
    tags: ["Relax", "Aromatherapy", "Full body"],
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
    description: "Targeted pressure that reaches the deeper layers of muscle. Ideal for chronic tension and recovery.",
    tags: ["Recovery", "Pressure", "Targeted"],
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
    description: "Heated basalt stones melt tension while warm oils restore your skin. A signature ritual.",
    tags: ["Heat", "Luxury", "Signature"],
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
    description: "Built for athletes. Combines stretching, deep work and trigger-point release.",
    tags: ["Athletic", "Stretch", "Recovery"],
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
    description: "Assisted stretches and rhythmic compression. You leave feeling longer, lighter, freer.",
    tags: ["Stretch", "Energy", "Mobility"],
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
  },
];

export const PRESSURE_LEVELS = ["Light", "Medium", "Firm", "Deep"] as const;
export const FOCUS_AREAS = ["Neck & shoulders", "Back", "Lower back", "Legs", "Feet", "Full body"] as const;
export const ADD_ONS = [
  { id: "aroma", name: "Aromatherapy", price: 0 },
  { id: "scalp", name: "Scalp & head massage", price: 0 },
  { id: "hot-towel", name: "Hot towel finish", price: 0 },
  { id: "extend-30", name: "Extend +30 min", price: 25 },
] as const;

export const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:30", "14:00", "15:30", "17:00", "18:30", "20:00",
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
