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
  },,
  {
    id: "swedish-relaxingmadrid",
    name: "Swedish Relaxation Massage",
    studio: "Relaxing Madrid",
    district: "Centro",
    address: "C. de la Luna 24, Centro, Madrid 28004",
    duration: 60,
    rating: 4.7,
    reviews: 142,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Therapeutic and relaxing massage center open daily by appointment. Located in central Madrid near Chueca.",
    tags: ["Swedish", "Relaxing", "Therapeutic"],
    type: "swedish",
    lat: 40.4230,
    lng: -3.7000,
    bookingUrl: "https://www.relaxing-madrid.com/",
    phone: "+34 654 064 925",
    services: ["Relaxing Massage", "Therapeutic Massage"],
  },
  {
    id: "swedish-esteticaeivissa",
    name: "Relaxing Massage",
    studio: "Estetica Eivissa by Juan",
    district: "Chueca",
    address: "Calle Colmenares 3, Chueca, Madrid 28004",
    duration: 60,
    rating: 4.6,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
    description: "Professional male/female aesthetic center in Chueca since 2004. Relaxing massage promotions available.",
    tags: ["Massage", "Beauty", "Aesthetics"],
    type: "swedish",
    lat: 40.4220,
    lng: -3.6980,
    phone: "+34 91 522 71 97",
    whatsapp: "+34 682 371 596",
    services: ["Relaxing Massage", "Beauty Treatments"],
  },
  {
    id: "thai-kamiraku",
    name: "Thai Bodywork",
    studio: "Kamiraku",
    district: "Salamanca",
    address: "Calle General Oraa 19, Bajo Izquierda, Salamanca, Madrid 28006",
    duration: 75,
    rating: 4.8,
    reviews: 167,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Oriental wellness center in Salamanca. Thai, shiatsu, kobido, ayurvedic. Experts in couples massage.",
    tags: ["Thai", "Shiatsu", "Ayurvedic", "Couples"],
    type: "thai",
    lat: 40.4310,
    lng: -3.6730,
    bookingUrl: "https://kamiraku.es/",
    phone: "+34 651 217 881",
    services: ["Thai Massage", "Shiatsu", "Kobido", "Ayurvedic", "Couples Massage"],
  },
  {
    id: "swedish-botanique",
    name: "Wellness Massage",
    studio: "Botanique Wellness",
    district: "Retiro",
    address: "Calle Walia s/n, Retiro, Madrid 28007",
    duration: 60,
    rating: 4.7,
    reviews: 94,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Aesthetics and wellness center in the Retiro area. Corporate wellness packages and massage services.",
    tags: ["Wellness", "Aesthetics", "Corporate"],
    type: "swedish",
    lat: 40.4080,
    lng: -3.6700,
    phone: "+34 664 477 088",
    services: ["Massage", "Aesthetics", "Corporate Wellness"],
  },
  {
    id: "thai-kenika",
    name: "Thai Traditional Massage",
    studio: "Kenika Thai Massage",
    district: "Chamartin",
    address: "Paseo de La Habana 42 Local, Chamartin, Madrid 28036",
    duration: 75,
    rating: 4.9,
    reviews: 203,
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
    description: "One of the best Thai massages outside Thailand. Expert Thai therapists in elegant Chamartin setting.",
    tags: ["Thai", "Traditional", "Expert"],
    type: "thai",
    lat: 40.4530,
    lng: -3.6790,
    bookingUrl: "http://www.kenikathaimassage.es",
    phone: "+34 912 792 081",
    services: ["Thai Massage", "Traditional Thai", "Oil Massage"],
  },
  {
    id: "thai-zazen",
    name: "Thai Massage Original",
    studio: "Zazen Thai",
    district: "Serrano",
    address: "Calle Francisca Moreno 5, Serrano, Madrid 28001",
    duration: 75,
    rating: 4.8,
    reviews: 178,
    image: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80",
    description: "Thai massage in original setting with highly trained Thai professionals. One of Madrid's top-rated Thai spas.",
    tags: ["Thai", "Original", "Professional"],
    type: "thai",
    lat: 40.4290,
    lng: -3.6850,
    bookingUrl: "https://www.zazenthai.com/",
    phone: "+34 912 770 794",
    email: "zazenspa.es@gmail.com",
    services: ["Thai Massage", "Traditional Thai", "Oil Massage"],
  },
  {
    id: "swedish-spazziowellness",
    name: "Full Spa Experience",
    studio: "Spazio Wellness",
    district: "La Latina",
    address: "Calle de los Estudios 4, La Latina, Madrid 28012",
    duration: 90,
    rating: 4.7,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Day spa between Plaza Cascorro and Plaza Mayor in La Latina. Wide variety of massages and body treatments.",
    tags: ["Day Spa", "Massage", "Body Treatments", "La Latina"],
    type: "swedish",
    lat: 40.4150,
    lng: -3.7070,
    bookingUrl: "https://spaziowellness.es/#reservas",
    phone: "+34 615 94 55 21",
    services: ["Massage", "Body Treatments", "Day Spa"],
  },,
  {
    id: "swedish-lushspa",
    name: "Lush Spa Experience",
    studio: "Lush Spa Madrid",
    district: "Sol",
    address: "Calle del Carmen 24, Sol, Madrid 28013",
    duration: 90,
    rating: 5.0,
    reviews: 1644,
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80",
    description: "Iconic cosmetics brand spa in central Madrid near Sol. Luxury treatments with signature Lush products. Massive 1,644 reviews with perfect 5-star rating.",
    tags: ["Luxury", "Spa", "Signature", "Central"],
    type: "swedish",
    lat: 40.4168,
    lng: -3.7010,
    bookingUrl: "https://www.fresha.com/lvp/lush-calle-del-carmen-madrid-6Qgo4E",
    phone: "+34 915 327 667",
    services: ["Massage", "Facial", "Body Treatments", "Infrared Sauna"],
  },
  {
    id: "deep-masajescamino",
    name: "Deep Therapeutic Massage",
    studio: "Masajes Camino",
    district: "Malasaña",
    address: "Calle Andrés Borrego 5, Malasaña, Madrid 28004",
    duration: 60,
    rating: 4.8,
    reviews: 31,
    image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80",
    description: "Best professional massage in central Malasaña. TripAdvisor Top Pick for massage in Madrid. Skilled therapist with great results.",
    tags: ["Deep Tissue", "Therapeutic", "Professional", "Top Pick"],
    type: "deep",
    lat: 40.4260,
    lng: -3.7060,
    bookingUrl: "https://masajescamino.es/",
    phone: "+34 607 754 740",
    email: "masajescamino@gmail.com",
    services: ["Deep Massage", "Therapeutic Massage"],
  },
  {
    id: "swedish-quietkarma",
    name: "Harmony Massage Ritual",
    studio: "A Quiet Karma",
    district: "Sol",
    address: "Gran Via 69, Centro, Madrid 28013",
    duration: 60,
    rating: 5.0,
    reviews: 6,
    image: "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80",
    description: "A sanctuary for body, mind and soul. Harmony-focused massage in the heart of Madrid on Gran Via. Calming atmosphere with professional service.",
    tags: ["Holistic", "Harmony", "Central", "Calming"],
    type: "swedish",
    lat: 40.4190,
    lng: -3.7050,
    bookingUrl: "https://www.masajesenmadrid.es/",
    services: ["Massage", "Holistic Treatments"],
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

