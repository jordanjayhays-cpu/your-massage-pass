/**
 * Massage Club type education library.
 *
 * STRICT EDITORIAL RULE: describe what the massage IS, where it comes from,
 * who picks it and what happens in the room. Never claim it cures, treats,
 * heals, "releases toxins", "detoxes" or "boosts immunity".
 *
 * Matching runs on the service's English name first (falling back to the
 * Spanish name), using lowercase "contains" keywords.
 */

export type MassageTypeContent = {
  slug: string;
  name: { en: string; es: string };
  /** lowercase substrings matched against service names */
  match: string[];
  firstTimer?: boolean;
  what: { en: string; es: string };
  from: { en: string; es: string };
  who: { en: string; es: string };
  expect: { en: string; es: string };
};

export const MASSAGE_TYPES_CONTENT: MassageTypeContent[] = [
  {
    slug: "swedish",
    name: { en: "Swedish / Relaxing massage", es: "Masaje sueco / relajante" },
    match: ["swedish", "relax", "sueco", "sueca", "relajante", "classic", "clasico", "clásico"],
    firstTimer: true,
    what: {
      en: "Long, gliding strokes with light to medium pressure, usually with oil. The classic relaxation massage.",
      es: "Movimientos largos y deslizantes con presión suave o media, normalmente con aceite. El masaje de relajación clásico.",
    },
    from: {
      en: "Developed in 19th century Europe, the foundation of Western massage.",
      es: "Nació en la Europa del siglo XIX y es la base del masaje occidental.",
    },
    who: {
      en: "Anyone who wants to unwind, sleep better, or slow down a busy week.",
      es: "Cualquiera que quiera desconectar, dormir mejor o bajar el ritmo de una semana intensa.",
    },
    expect: {
      en: "You undress to your comfort level, lie under a towel, and the therapist works your back, legs, arms and neck with smooth flowing movements. Most people leave deeply relaxed.",
      es: "Te desvistes hasta donde te sientas cómodo, te tumbas bajo una toalla y el terapeuta trabaja espalda, piernas, brazos y cuello con movimientos suaves y continuos. La mayoría sale profundamente relajada.",
    },
  },
  {
    slug: "deep-tissue",
    name: { en: "Deep tissue massage", es: "Masaje de tejido profundo" },
    match: ["deep tissue", "deep-tissue", "tejido profundo", "descontracturante", "profundo"],
    what: {
      en: "Slow, firm pressure that works into deeper muscle layers, focused on knots and chronic tension.",
      es: "Presión lenta y firme que llega a las capas musculares profundas, centrada en nudos y tensión crónica.",
    },
    from: {
      en: "Rooted in Swedish technique, developed for therapeutic focus on stubborn tension.",
      es: "Parte de la técnica sueca y se desarrolló para trabajar de forma terapéutica la tensión más persistente.",
    },
    who: {
      en: "Desk workers with tight shoulders, people with sore backs, anyone who likes strong pressure.",
      es: "Quien trabaja sentado y carga los hombros, quien tiene la espalda dolorida y a quien le gusta la presión fuerte.",
    },
    expect: {
      en: "Pressure can feel intense in tight spots and mild soreness the next day is normal. Tell your therapist the moment it is too much, they adjust.",
      es: "La presión puede sentirse intensa en las zonas cargadas y es normal notar algo de agujetas al día siguiente. Dile al terapeuta en cuanto sea demasiado y lo ajustará.",
    },
  },
  {
    slug: "thai",
    name: { en: "Thai massage", es: "Masaje tailandés" },
    match: ["thai", "tailandes", "tailandés"],
    what: {
      en: "Done on a floor mat in loose clothing: stretching, compression and rocking, often called passive yoga.",
      es: "Se hace sobre una colchoneta y con ropa cómoda: estiramientos, compresiones y balanceos, a menudo llamado yoga pasivo.",
    },
    from: {
      en: "A centuries-old tradition from Thailand blending yoga stretches and acupressure.",
      es: "Una tradición tailandesa de siglos que combina estiramientos de yoga y digitopresión.",
    },
    who: {
      en: "People who feel stiff, sit a lot, or want to feel looser and more mobile.",
      es: "Quien se siente rígido, pasa muchas horas sentado o quiere ganar soltura y movilidad.",
    },
    expect: {
      en: "No oil, you stay dressed. The therapist moves your body through stretches and presses along energy lines. You leave feeling stretched and awake.",
      es: "Sin aceite y vestido. El terapeuta lleva tu cuerpo por distintos estiramientos y presiona a lo largo de las líneas de energía. Sales estirado y despierto.",
    },
  },
  {
    slug: "balinese",
    name: { en: "Balinese massage", es: "Masaje balinés" },
    match: ["balinese", "bali", "balines", "balinés"],
    what: {
      en: "A full-body oil massage combining gentle stretches, acupressure, rolling and rhythmic kneading.",
      es: "Un masaje corporal con aceite que combina estiramientos suaves, digitopresión, rodamientos y amasamiento rítmico.",
    },
    from: {
      en: "Bali, Indonesia, drawing on Indian, Chinese and local traditions.",
      es: "De Bali, Indonesia, con influencias de las tradiciones india, china y local.",
    },
    who: {
      en: "Those who want deep relaxation with a bit more variety and pressure than Swedish.",
      es: "Quien busca una relajación profunda con algo más de variedad y presión que el sueco.",
    },
    expect: {
      en: "Aromatic oil, flowing strokes alternating with firmer pressure points, sometimes gentle stretching. A sensory, unhurried session.",
      es: "Aceite aromático, movimientos fluidos que alternan con puntos de presión más firmes y, a veces, estiramientos suaves. Una sesión sensorial y sin prisa.",
    },
  },
  {
    slug: "shiatsu",
    name: { en: "Shiatsu", es: "Shiatsu" },
    match: ["shiatsu"],
    what: {
      en: "Japanese finger-pressure massage along the body's meridian points, done in comfortable clothing without oil.",
      es: "Masaje japonés de presión con los dedos sobre los puntos de los meridianos, con ropa cómoda y sin aceite.",
    },
    from: {
      en: "Japan, formalized in the 20th century from traditional Japanese and Chinese bodywork.",
      es: "De Japón, formalizado en el siglo XX a partir del trabajo corporal tradicional japonés y chino.",
    },
    who: {
      en: "People who prefer staying dressed, or want firm rhythmic pressure without oil.",
      es: "Quien prefiere quedarse vestido o busca una presión firme y rítmica sin aceite.",
    },
    expect: {
      en: "The therapist presses with thumbs, palms and sometimes elbows in steady rhythms. Grounding and focused.",
      es: "El terapeuta presiona con pulgares, palmas y a veces codos en ritmos constantes. Una sesión centrada y con los pies en la tierra.",
    },
  },
  {
    slug: "sports",
    name: { en: "Sports massage", es: "Masaje deportivo" },
    match: ["sports", "sport", "deportivo"],
    what: {
      en: "Targeted, vigorous work on muscles stressed by training: kneading, friction, stretching.",
      es: "Trabajo dirigido y enérgico sobre los músculos que carga el entrenamiento: amasamiento, fricción y estiramiento.",
    },
    from: {
      en: "Developed alongside modern athletics for training recovery.",
      es: "Se desarrolló junto al deporte moderno para la recuperación del entrenamiento.",
    },
    who: {
      en: "Runners, gym goers, anyone preparing for or recovering from exercise.",
      es: "Corredores, gente de gimnasio y cualquiera que prepare o recupere una sesión de ejercicio.",
    },
    expect: {
      en: "The therapist focuses on the muscle groups you name. Can be intense; communicate your comfort level.",
      es: "El terapeuta se centra en los grupos musculares que le indiques. Puede ser intenso, así que dile hasta dónde te resulta cómodo.",
    },
  },
  {
    slug: "lymphatic",
    name: { en: "Lymphatic drainage", es: "Drenaje linfático" },
    match: ["lymphatic", "lymph", "linfatico", "linfático", "drenaje"],
    what: {
      en: "Very light, slow, rhythmic strokes that follow the direction of lymph flow.",
      es: "Movimientos muy suaves, lentos y rítmicos que siguen la dirección del flujo linfático.",
    },
    from: {
      en: "Developed in 1930s Europe by the Vodder method.",
      es: "Desarrollado en la Europa de los años treinta con el método Vodder.",
    },
    who: {
      en: "People who feel puffy or heavy-legged, and those who want an extremely gentle session.",
      es: "Quien nota hinchazón o piernas pesadas y quien busca una sesión extremadamente suave.",
    },
    expect: {
      en: "Much lighter than a regular massage, almost feather-like. Many find it deeply calming.",
      es: "Mucho más suave que un masaje normal, casi como una pluma. A mucha gente le resulta muy calmante.",
    },
  },
  {
    slug: "hot-stone",
    name: { en: "Hot stone massage", es: "Masaje con piedras calientes" },
    match: ["hot stone", "stone", "piedras calientes", "piedras"],
    what: {
      en: "Smooth heated stones glided over muscles and rested on key points, combined with hand strokes.",
      es: "Piedras lisas calientes que se deslizan sobre los músculos y se colocan en puntos clave, combinadas con el trabajo de manos.",
    },
    from: {
      en: "Stone-warming traditions from several cultures, modernized in the 1990s.",
      es: "Tradiciones de piedras calientes de varias culturas, modernizadas en los años noventa.",
    },
    who: {
      en: "People who love warmth, or find deep pressure uncomfortable but still want tension released.",
      es: "A quien le encanta el calor o le incomoda la presión profunda pero quiere soltar tensión.",
    },
    expect: {
      en: "The stones feel intensely warm but never burning. Heat lets muscles soften without hard pressure.",
      es: "Las piedras se sienten muy cálidas pero nunca queman. El calor ablanda el músculo sin necesidad de presión fuerte.",
    },
  },
  {
    slug: "kobido",
    name: { en: "Kobido facial massage", es: "Masaje facial kobido" },
    match: ["kobido"],
    what: {
      en: "A Japanese facial massage of fast, precise movements over face, neck and scalp.",
      es: "Un masaje facial japonés de movimientos rápidos y precisos sobre cara, cuello y cuero cabelludo.",
    },
    from: {
      en: "Japan, a lineage dating to the 15th century, historically for nobility.",
      es: "De Japón, con un linaje que se remonta al siglo XV y que históricamente se reservaba a la nobleza.",
    },
    who: {
      en: "People who carry tension in the jaw and face, or want a natural facial treatment.",
      es: "Quien acumula tensión en la mandíbula y la cara o busca un tratamiento facial natural.",
    },
    expect: {
      en: "You lie face up while the therapist works quick rhythmic movements over your face. No needles, no products beyond light oil.",
      es: "Te tumbas boca arriba mientras el terapeuta realiza movimientos rápidos y rítmicos por la cara. Sin agujas y sin más producto que un aceite ligero.",
    },
  },
  {
    slug: "gua-sha",
    name: { en: "Gua sha", es: "Gua sha" },
    match: ["gua sha", "gua-sha", "guasha"],
    what: {
      en: "A smooth stone tool glided over oiled skin with gentle strokes, usually on the face or neck at our studios.",
      es: "Una herramienta de piedra lisa que se desliza con movimientos suaves sobre la piel con aceite, normalmente en cara o cuello en nuestros estudios.",
    },
    from: {
      en: "Traditional Chinese practice, adapted into modern facial treatments.",
      es: "Práctica tradicional china, adaptada a los tratamientos faciales modernos.",
    },
    who: {
      en: "Those curious about facial treatments and jaw or neck tension.",
      es: "Quien siente curiosidad por los tratamientos faciales y nota tensión en mandíbula o cuello.",
    },
    expect: {
      en: "Gentle scraping strokes that feel unusual at first, then pleasant. Facial gua sha is soft; some redness can appear briefly.",
      es: "Pasadas suaves que al principio resultan raras y luego agradables. El gua sha facial es delicado y puede aparecer algo de rojez durante un rato.",
    },
  },
  {
    slug: "head-scalp",
    name: { en: "Head and scalp massage", es: "Masaje de cabeza y cuero cabelludo" },
    match: ["head", "scalp", "cabeza", "craneal", "craneofacial", "champi"],
    firstTimer: true,
    what: {
      en: "Focused massage of the scalp, head, neck and sometimes shoulders.",
      es: "Masaje centrado en el cuero cabelludo, la cabeza, el cuello y a veces los hombros.",
    },
    from: {
      en: "Influenced by Indian champi head massage traditions.",
      es: "Influido por la tradición india del masaje de cabeza champi.",
    },
    who: {
      en: "Screen-heavy workers, headache-prone people, anyone who melts when their head is touched.",
      es: "Quien pasa el día ante pantallas, quien sufre dolores de cabeza y a quien le encanta que le toquen la cabeza.",
    },
    expect: {
      en: "Seated or lying down, mostly fingertip work. Short sessions, big relaxation. You stay dressed except perhaps your collar.",
      es: "Sentado o tumbado, sobre todo con las yemas de los dedos. Sesiones cortas y mucha relajación. Te quedas vestido, quizá salvo el cuello de la camisa.",
    },
  },
  {
    slug: "prenatal",
    name: { en: "Prenatal massage", es: "Masaje prenatal" },
    match: ["prenatal", "pregnancy", "pregnant", "embarazada", "embarazo", "premama", "premamá"],
    what: {
      en: "Gentle massage adapted for pregnancy, with side-lying positioning and supportive cushions.",
      es: "Masaje suave adaptado al embarazo, en posición de lado y con cojines de apoyo.",
    },
    from: {
      en: "An adaptation of Swedish techniques for expectant mothers.",
      es: "Una adaptación de las técnicas suecas para futuras mamás.",
    },
    who: {
      en: "Pregnant women, generally from the second trimester; studios may ask how far along you are.",
      es: "Mujeres embarazadas, normalmente a partir del segundo trimestre. El estudio puede preguntarte de cuánto estás.",
    },
    expect: {
      en: "Careful positioning, lighter pressure, focus on lower back, hips and legs. Tell the studio you are pregnant when booking.",
      es: "Colocación cuidadosa, presión más ligera y atención a lumbares, caderas y piernas. Avisa al estudio de que estás embarazada al reservar.",
    },
  },
  {
    slug: "couples",
    name: { en: "Couples massage", es: "Masaje en pareja" },
    match: ["couple", "couples", "pareja", "duo", "dúo"],
    what: {
      en: "Two people, two therapists, one room, massages at the same time.",
      es: "Dos personas, dos terapeutas, una sala y los dos masajes a la vez.",
    },
    from: {
      en: "A spa format built for sharing the experience.",
      es: "Un formato de spa pensado para compartir la experiencia.",
    },
    who: {
      en: "Couples, friends, or a nervous first-timer who wants company.",
      es: "Parejas, amigos o quien va por primera vez con algo de nervios y prefiere compañía.",
    },
    expect: {
      en: "Same as an individual massage, side by side. A good way to make a first massage less intimidating.",
      es: "Igual que un masaje individual, uno al lado del otro. Una buena forma de que el primer masaje imponga menos.",
    },
  },
  {
    slug: "foot-legs",
    name: { en: "Foot and legs massage", es: "Masaje de pies y piernas" },
    match: ["foot", "feet", "leg", "legs", "reflexology", "pies", "piernas", "reflexologia", "reflexología", "podal"],
    firstTimer: true,
    what: {
      en: "Focused work on feet, calves and legs, often with reflexology-style pressure points on the soles.",
      es: "Trabajo centrado en pies, gemelos y piernas, a menudo con puntos de presión estilo reflexología en las plantas.",
    },
    from: {
      en: "Reflexology traditions from China and beyond.",
      es: "Tradiciones de reflexología de China y de otros lugares.",
    },
    who: {
      en: "People on their feet all day, travelers, tired-leg sufferers.",
      es: "Quien pasa el día de pie, viajeros y quien sufre piernas cansadas.",
    },
    expect: {
      en: "You stay dressed except shoes and socks, seated or reclined. Firm thumb pressure on the soles; oddly wonderful.",
      es: "Te quedas vestido salvo zapatos y calcetines, sentado o reclinado. Presión firme con los pulgares en las plantas y una sensación curiosamente maravillosa.",
    },
  },
  {
    slug: "four-hands",
    name: { en: "Four hands massage", es: "Masaje a cuatro manos" },
    match: ["four hands", "four-hands", "4 hands", "cuatro manos", "4 manos"],
    what: {
      en: "Two therapists working simultaneously in synchronized rhythm.",
      es: "Dos terapeutas trabajando a la vez en un ritmo sincronizado.",
    },
    from: {
      en: "A luxury spa format.",
      es: "Un formato de spa de lujo.",
    },
    who: {
      en: "Experienced massage lovers wanting something immersive, or anyone marking an occasion.",
      es: "Amantes del masaje con experiencia que buscan algo envolvente o quien celebra una ocasión especial.",
    },
    expect: {
      en: "Twice the coverage, hard for the brain to track, deeply immersive. Premium priced.",
      es: "El doble de cobertura, difícil de seguir para el cerebro y muy envolvente. Precio premium.",
    },
  },
];

const norm = (v?: string | null) =>
  (typeof v === "string" ? v : "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Find the massage type for one or more service names (English name first). */
export function findMassageType(...names: (string | null | undefined)[]): MassageTypeContent | null {
  const hay = names.map(norm).filter(Boolean).join(" | ");
  if (!hay) return null;
  for (const type of MASSAGE_TYPES_CONTENT) {
    if (type.match.some((kw) => hay.includes(norm(kw)))) return type;
  }
  return null;
}

export function massageTypeBySlug(slug?: string | null): MassageTypeContent | null {
  return MASSAGE_TYPES_CONTENT.find((t) => t.slug === slug) ?? null;
}

export const MASSAGE_TYPE_SLUGS = MASSAGE_TYPES_CONTENT.map((t) => t.slug);

/* ---------------------------------------------------------------------- */
/* Vitals: the visual block shown above the text sections                  */
/* ---------------------------------------------------------------------- */

export type BestForKey =
  | "relaxation"
  | "tension"
  | "energy"
  | "sport"
  | "face"
  | "pregnancy";

export type ClothingKey = "dressed" | "face-only" | "feet-only";
export type OilKey = "oil" | "light-oil" | "none";

export type MassageVitals = {
  /** 1 to 5 */
  pressure: number;
  bestFor: BestForKey[];
  /** Clothing fact is only shown for types where the user stays dressed. */
  clothing?: ClothingKey;
  oil: OilKey;
};

export const BEST_FOR_LABELS: Record<BestForKey, { en: string; es: string }> = {
  relaxation: { en: "Relaxation", es: "Relajación" },
  tension: { en: "Tension relief", es: "Alivio de tensión" },
  energy: { en: "Energy and mobility", es: "Energía y movilidad" },
  sport: { en: "Sport recovery", es: "Recuperación deportiva" },
  face: { en: "Face and glow", es: "Rostro" },
  pregnancy: { en: "Pregnancy", es: "Embarazo" },
};

/** Muted tones that sit on the cream palette: bg / text / border. */
export const BEST_FOR_COLORS: Record<BestForKey, { bg: string; fg: string; border: string }> = {
  relaxation: { bg: "#ECF1EA", fg: "#4A6544", border: "#CBDBC6" },
  tension: { bg: "#FBEFE8", fg: "#8E4327", border: "#EBD3C4" },
  energy: { bg: "#FBF2DE", fg: "#8A6614", border: "#EBDDB6" },
  sport: { bg: "#EAEEF4", fg: "#465873", border: "#C8D3E2" },
  face: { bg: "#F8EDEF", fg: "#8A5560", border: "#E6CFD4" },
  pregnancy: { bg: "#F0EDF7", fg: "#5E5386", border: "#D6CFE8" },
};

export const CLOTHING_LABELS: Record<ClothingKey, { en: string; es: string }> = {
  dressed: { en: "Stay dressed", es: "Con ropa" },
  "face-only": { en: "Face only, dressed", es: "Solo rostro, con ropa" },
  "feet-only": { en: "Shoes and socks off only", es: "Solo sin zapatos ni calcetines" },
};

export const OIL_LABELS: Record<OilKey, { en: string; es: string }> = {
  oil: { en: "With oil", es: "Con aceite" },
  "light-oil": { en: "Light oil", es: "Aceite ligero" },
  none: { en: "No oil", es: "Sin aceite" },
};

export const PRESSURE_LABELS: { en: string; es: string }[] = [
  { en: "Very light", es: "Muy suave" },
  { en: "Light", es: "Suave" },
  { en: "Medium", es: "Media" },
  { en: "Firm", es: "Firme" },
  { en: "Deep", es: "Profunda" },
];

/** Fill colour by intensity: 1-2 sage, 3 amber, 4-5 terracotta. */
export function pressureColor(level: number): string {
  if (level >= 4) return "#8E4327";
  if (level === 3) return "#C89B3C";
  return "#7D9B76";
}

export const MASSAGE_VITALS: Record<string, MassageVitals> = {
  swedish: { pressure: 2, bestFor: ["relaxation"], oil: "oil" },
  "deep-tissue": { pressure: 5, bestFor: ["tension"], oil: "oil" },
  thai: { pressure: 4, bestFor: ["energy", "tension"], clothing: "dressed", oil: "none" },
  balinese: { pressure: 3, bestFor: ["relaxation", "tension"], oil: "oil" },
  shiatsu: { pressure: 4, bestFor: ["tension", "energy"], clothing: "dressed", oil: "none" },
  sports: { pressure: 4, bestFor: ["sport", "tension"], oil: "oil" },
  lymphatic: { pressure: 1, bestFor: ["relaxation"], oil: "oil" },
  "hot-stone": { pressure: 2, bestFor: ["relaxation", "tension"], oil: "oil" },
  kobido: { pressure: 2, bestFor: ["face"], clothing: "face-only", oil: "light-oil" },
  "gua-sha": { pressure: 1, bestFor: ["face"], clothing: "face-only", oil: "oil" },
  "head-scalp": { pressure: 2, bestFor: ["relaxation", "tension"], clothing: "dressed", oil: "none" },
  prenatal: { pressure: 2, bestFor: ["pregnancy", "relaxation"], oil: "oil" },
  couples: { pressure: 3, bestFor: ["relaxation"], oil: "oil" },
  "foot-legs": { pressure: 3, bestFor: ["tension", "relaxation"], clothing: "feet-only", oil: "oil" },
  "four-hands": { pressure: 3, bestFor: ["relaxation"], oil: "oil" },
};

export function vitalsFor(slug?: string | null): MassageVitals | null {
  return (slug && MASSAGE_VITALS[slug]) || null;
}

/* ---------------------------------------------------------------------- */
/* Fact chips: the visual, chip-based version of the four text sections    */
/* ---------------------------------------------------------------------- */

/** Icon keys resolved to lucide icons in MassageTypeInfo.tsx. */
export type FactIcon =
  | "mat"
  | "shirt"
  | "sparkles"
  | "globe"
  | "oil"
  | "no-oil"
  | "hands"
  | "stone"
  | "heat"
  | "feather"
  | "stretch"
  | "pressure"
  | "sun"
  | "moon"
  | "chair"
  | "feet"
  | "face"
  | "users"
  | "baby"
  | "run"
  | "clock"
  | "waves"
  | "wind"
  | "leaf"
  | "heart"
  | "tool";

export type Fact = { icon: FactIcon; en: string; es: string };
/** Who-it-is-for chips reuse the best-for colour vocabulary. */
export type WhoFact = Fact & { tone: BestForKey };

export type MassageFacts = {
  /** One short line, max one sentence, shown above the what-it-is chips. */
  line: { en: string; es: string };
  what: Fact[];
  origin: Fact;
  who: WhoFact[];
  /** Three at most. */
  expect: Fact[];
};

export const MASSAGE_FACTS: Record<string, MassageFacts> = {
  swedish: {
    line: { en: "The classic relaxation massage.", es: "El masaje de relajación clásico." },
    what: [
      { icon: "waves", en: "Long gliding strokes", es: "Movimientos largos" },
      { icon: "oil", en: "With oil", es: "Con aceite" },
      { icon: "feather", en: "Light to medium pressure", es: "Presión suave o media" },
    ],
    origin: { icon: "globe", en: "Europe · 19th century", es: "Europa · siglo XIX" },
    who: [
      { icon: "moon", tone: "relaxation", en: "Want to unwind", es: "Quieres desconectar" },
      { icon: "clock", tone: "relaxation", en: "Busy week", es: "Semana intensa" },
      { icon: "sparkles", tone: "relaxation", en: "First massage", es: "Primer masaje" },
    ],
    expect: [
      { icon: "shirt", en: "Undress to comfort", es: "Te desvistes a tu gusto" },
      { icon: "hands", en: "Back, legs, arms, neck", es: "Espalda, piernas, brazos, cuello" },
      { icon: "moon", en: "Leave deeply relaxed", es: "Sales muy relajado" },
    ],
  },
  "deep-tissue": {
    line: { en: "Slow, firm work into the deeper muscle layers.", es: "Trabajo lento y firme en las capas musculares profundas." },
    what: [
      { icon: "pressure", en: "Strong pressure", es: "Presión fuerte" },
      { icon: "hands", en: "Knots and tight spots", es: "Nudos y zonas cargadas" },
      { icon: "oil", en: "With oil", es: "Con aceite" },
    ],
    origin: { icon: "globe", en: "Swedish technique · therapeutic focus", es: "Técnica sueca · enfoque terapéutico" },
    who: [
      { icon: "chair", tone: "tension", en: "Sit at a desk", es: "Trabajas sentado" },
      { icon: "hands", tone: "tension", en: "Sore back", es: "Espalda dolorida" },
      { icon: "pressure", tone: "tension", en: "Like it strong", es: "Te gusta fuerte" },
    ],
    expect: [
      { icon: "pressure", en: "Intense on tight spots", es: "Intenso en zonas cargadas" },
      { icon: "clock", en: "Mild soreness next day", es: "Algo de agujetas al día siguiente" },
      { icon: "hands", en: "Say when it is too much", es: "Avisa si es demasiado" },
    ],
  },
  thai: {
    line: { en: "Stretching and compression, often called passive yoga.", es: "Estiramientos y compresiones, a menudo llamado yoga pasivo." },
    what: [
      { icon: "mat", en: "On a floor mat", es: "En colchoneta" },
      { icon: "shirt", en: "Loose clothing", es: "Ropa cómoda" },
      { icon: "sparkles", en: "Passive yoga", es: "Yoga pasivo" },
    ],
    origin: { icon: "globe", en: "Thailand · centuries old", es: "Tailandia · siglos de tradición" },
    who: [
      { icon: "chair", tone: "tension", en: "Sit a lot", es: "Mucho tiempo sentado" },
      { icon: "hands", tone: "tension", en: "Feel stiff", es: "Rigidez" },
      { icon: "stretch", tone: "energy", en: "Want mobility", es: "Ganar movilidad" },
    ],
    expect: [
      { icon: "no-oil", en: "No oil", es: "Sin aceite" },
      { icon: "stretch", en: "Stretch and press", es: "Estiramiento y presión" },
      { icon: "sun", en: "Leave feeling awake", es: "Sales despierto" },
    ],
  },
  balinese: {
    line: { en: "A full body oil massage with more variety than Swedish.", es: "Masaje corporal con aceite y más variedad que el sueco." },
    what: [
      { icon: "oil", en: "Aromatic oil", es: "Aceite aromático" },
      { icon: "hands", en: "Kneading and acupressure", es: "Amasamiento y digitopresión" },
      { icon: "stretch", en: "Gentle stretches", es: "Estiramientos suaves" },
    ],
    origin: { icon: "globe", en: "Bali, Indonesia", es: "Bali, Indonesia" },
    who: [
      { icon: "moon", tone: "relaxation", en: "Want deep relaxation", es: "Buscas relajación profunda" },
      { icon: "pressure", tone: "tension", en: "Want more pressure", es: "Quieres más presión" },
      { icon: "sparkles", tone: "relaxation", en: "Like a sensory session", es: "Te gusta lo sensorial" },
    ],
    expect: [
      { icon: "waves", en: "Flowing strokes", es: "Movimientos fluidos" },
      { icon: "pressure", en: "Firmer pressure points", es: "Puntos de presión firmes" },
      { icon: "clock", en: "Unhurried pace", es: "Sin prisa" },
    ],
  },
  shiatsu: {
    line: { en: "Japanese finger pressure along meridian points.", es: "Presión japonesa con los dedos sobre los meridianos." },
    what: [
      { icon: "shirt", en: "Comfortable clothing", es: "Ropa cómoda" },
      { icon: "no-oil", en: "No oil", es: "Sin aceite" },
      { icon: "pressure", en: "Thumbs, palms, elbows", es: "Pulgares, palmas, codos" },
    ],
    origin: { icon: "globe", en: "Japan · formalized 20th century", es: "Japón · formalizado en el siglo XX" },
    who: [
      { icon: "shirt", tone: "tension", en: "Prefer staying dressed", es: "Prefieres estar vestido" },
      { icon: "pressure", tone: "tension", en: "Want firm pressure", es: "Buscas presión firme" },
      { icon: "sparkles", tone: "energy", en: "Curious about meridians", es: "Curiosidad por los meridianos" },
    ],
    expect: [
      { icon: "waves", en: "Steady rhythm", es: "Ritmo constante" },
      { icon: "leaf", en: "Grounding and focused", es: "Centrado y con calma" },
      { icon: "no-oil", en: "Stay dressed", es: "Con ropa" },
    ],
  },
  sports: {
    line: { en: "Targeted work on muscles stressed by training.", es: "Trabajo dirigido sobre los músculos que carga el entrenamiento." },
    what: [
      { icon: "run", en: "Vigorous and targeted", es: "Enérgico y dirigido" },
      { icon: "hands", en: "Kneading and friction", es: "Amasamiento y fricción" },
      { icon: "stretch", en: "Stretching", es: "Estiramiento" },
    ],
    origin: { icon: "globe", en: "Modern athletics · training recovery", es: "Deporte moderno · recuperación" },
    who: [
      { icon: "run", tone: "sport", en: "Runners", es: "Corredores" },
      { icon: "run", tone: "sport", en: "Gym goers", es: "Gente de gimnasio" },
      { icon: "clock", tone: "sport", en: "Before or after training", es: "Antes o después de entrenar" },
    ],
    expect: [
      { icon: "hands", en: "You name the muscle groups", es: "Tú eliges los grupos musculares" },
      { icon: "pressure", en: "Can be intense", es: "Puede ser intenso" },
      { icon: "oil", en: "With oil", es: "Con aceite" },
    ],
  },
  lymphatic: {
    line: { en: "Very light rhythmic strokes following lymph flow.", es: "Movimientos muy suaves y rítmicos que siguen el flujo linfático." },
    what: [
      { icon: "feather", en: "Feather light", es: "Muy suave" },
      { icon: "waves", en: "Slow and rhythmic", es: "Lento y rítmico" },
      { icon: "oil", en: "With oil", es: "Con aceite" },
    ],
    origin: { icon: "globe", en: "Europe · Vodder method, 1930s", es: "Europa · método Vodder, años treinta" },
    who: [
      { icon: "feet", tone: "relaxation", en: "Heavy legs", es: "Piernas pesadas" },
      { icon: "waves", tone: "relaxation", en: "Feel puffy", es: "Sensación de hinchazón" },
      { icon: "feather", tone: "relaxation", en: "Want it very gentle", es: "Quieres algo muy suave" },
    ],
    expect: [
      { icon: "feather", en: "Much lighter than usual", es: "Mucho más suave de lo normal" },
      { icon: "waves", en: "Repetitive gentle passes", es: "Pasadas suaves repetidas" },
      { icon: "moon", en: "Very calming", es: "Muy calmante" },
    ],
  },
  "hot-stone": {
    line: { en: "Heated stones glided over muscles and rested on key points.", es: "Piedras calientes que se deslizan y se apoyan en puntos clave." },
    what: [
      { icon: "stone", en: "Smooth warm stones", es: "Piedras lisas calientes" },
      { icon: "heat", en: "Heat instead of hard pressure", es: "Calor en vez de presión fuerte" },
      { icon: "oil", en: "With oil", es: "Con aceite" },
    ],
    origin: { icon: "globe", en: "Several cultures · modernized in the 1990s", es: "Varias culturas · modernizado en los noventa" },
    who: [
      { icon: "heat", tone: "relaxation", en: "Love warmth", es: "Te encanta el calor" },
      { icon: "feather", tone: "tension", en: "Dislike deep pressure", es: "No te gusta la presión profunda" },
      { icon: "moon", tone: "relaxation", en: "Want to slow down", es: "Quieres bajar el ritmo" },
    ],
    expect: [
      { icon: "heat", en: "Warm, never burning", es: "Cálido, nunca quema" },
      { icon: "hands", en: "Stones plus hand strokes", es: "Piedras y trabajo de manos" },
      { icon: "moon", en: "Muscles soften slowly", es: "El músculo se ablanda poco a poco" },
    ],
  },
  kobido: {
    line: { en: "A Japanese facial massage of fast, precise movements.", es: "Masaje facial japonés de movimientos rápidos y precisos." },
    what: [
      { icon: "face", en: "Face, neck and scalp", es: "Cara, cuello y cuero cabelludo" },
      { icon: "hands", en: "Fast precise movements", es: "Movimientos rápidos y precisos" },
      { icon: "oil", en: "Light oil only", es: "Solo aceite ligero" },
    ],
    origin: { icon: "globe", en: "Japan · lineage since the 15th century", es: "Japón · linaje desde el siglo XV" },
    who: [
      { icon: "face", tone: "face", en: "Jaw tension", es: "Tensión de mandíbula" },
      { icon: "sparkles", tone: "face", en: "Want a natural facial", es: "Buscas un facial natural" },
      { icon: "clock", tone: "face", en: "Short focused session", es: "Sesión corta y concreta" },
    ],
    expect: [
      { icon: "face", en: "Lie face up, dressed", es: "Boca arriba y vestido" },
      { icon: "waves", en: "Quick rhythmic strokes", es: "Pasadas rápidas y rítmicas" },
      { icon: "no-oil", en: "No needles, no products", es: "Sin agujas ni productos" },
    ],
  },
  "gua-sha": {
    line: { en: "A smooth stone tool glided over oiled skin.", es: "Una herramienta de piedra lisa que se desliza sobre la piel con aceite." },
    what: [
      { icon: "tool", en: "Stone tool", es: "Herramienta de piedra" },
      { icon: "face", en: "Face and neck", es: "Cara y cuello" },
      { icon: "feather", en: "Gentle strokes", es: "Pasadas suaves" },
    ],
    origin: { icon: "globe", en: "China · traditional practice", es: "China · práctica tradicional" },
    who: [
      { icon: "face", tone: "face", en: "Curious about facials", es: "Curiosidad por los faciales" },
      { icon: "face", tone: "face", en: "Jaw or neck tension", es: "Tensión de mandíbula o cuello" },
      { icon: "feather", tone: "face", en: "Want something soft", es: "Buscas algo delicado" },
    ],
    expect: [
      { icon: "tool", en: "Unusual at first, then pleasant", es: "Raro al principio, luego agradable" },
      { icon: "feather", en: "Soft on the face", es: "Delicado en el rostro" },
      { icon: "clock", en: "Brief redness possible", es: "Puede quedar algo de rojez" },
    ],
  },
  "head-scalp": {
    line: { en: "Focused work on scalp, head and neck.", es: "Trabajo centrado en cuero cabelludo, cabeza y cuello." },
    what: [
      { icon: "hands", en: "Fingertip work", es: "Con las yemas de los dedos" },
      { icon: "shirt", en: "Stay dressed", es: "Con ropa" },
      { icon: "clock", en: "Short session", es: "Sesión corta" },
    ],
    origin: { icon: "globe", en: "India · champi tradition", es: "India · tradición champi" },
    who: [
      { icon: "chair", tone: "tension", en: "Screen heavy days", es: "Muchas horas de pantalla" },
      { icon: "face", tone: "tension", en: "Headache prone", es: "Propenso a dolor de cabeza" },
      { icon: "moon", tone: "relaxation", en: "Love head touch", es: "Te encanta que te toquen la cabeza" },
    ],
    expect: [
      { icon: "chair", en: "Seated or lying down", es: "Sentado o tumbado" },
      { icon: "no-oil", en: "Usually no oil", es: "Normalmente sin aceite" },
      { icon: "moon", en: "Big relaxation, fast", es: "Mucha relajación en poco tiempo" },
    ],
  },
  prenatal: {
    line: { en: "Gentle massage adapted for pregnancy.", es: "Masaje suave adaptado al embarazo." },
    what: [
      { icon: "baby", en: "Side lying position", es: "Tumbada de lado" },
      { icon: "feather", en: "Supportive cushions", es: "Cojines de apoyo" },
      { icon: "oil", en: "Light pressure with oil", es: "Presión ligera con aceite" },
    ],
    origin: { icon: "globe", en: "Swedish technique · adapted for pregnancy", es: "Técnica sueca · adaptada al embarazo" },
    who: [
      { icon: "baby", tone: "pregnancy", en: "Pregnant, usually from month four", es: "Embarazada, normalmente desde el cuarto mes" },
      { icon: "hands", tone: "pregnancy", en: "Lower back or hip load", es: "Carga lumbar o de cadera" },
      { icon: "feet", tone: "pregnancy", en: "Tired legs", es: "Piernas cansadas" },
    ],
    expect: [
      { icon: "baby", en: "Careful positioning", es: "Colocación cuidadosa" },
      { icon: "feather", en: "Lighter pressure", es: "Presión más ligera" },
      { icon: "clock", en: "Say you are pregnant when booking", es: "Avisa al reservar" },
    ],
  },
  couples: {
    line: { en: "Two people, two therapists, one room, at the same time.", es: "Dos personas, dos terapeutas, una sala y a la vez." },
    what: [
      { icon: "users", en: "Side by side", es: "Uno al lado del otro" },
      { icon: "hands", en: "Two therapists", es: "Dos terapeutas" },
      { icon: "oil", en: "Usually with oil", es: "Normalmente con aceite" },
    ],
    origin: { icon: "globe", en: "Spa format · made for sharing", es: "Formato de spa · para compartir" },
    who: [
      { icon: "heart", tone: "relaxation", en: "Couples", es: "Parejas" },
      { icon: "users", tone: "relaxation", en: "Friends", es: "Amigos" },
      { icon: "sparkles", tone: "relaxation", en: "Nervous first timers", es: "Primera vez con nervios" },
    ],
    expect: [
      { icon: "users", en: "Same as an individual massage", es: "Igual que un masaje individual" },
      { icon: "heart", en: "Shared room", es: "Sala compartida" },
      { icon: "sparkles", en: "Less intimidating first time", es: "Una primera vez que impone menos" },
    ],
  },
  "foot-legs": {
    line: { en: "Focused work on feet, calves and legs.", es: "Trabajo centrado en pies, gemelos y piernas." },
    what: [
      { icon: "feet", en: "Feet and legs only", es: "Solo pies y piernas" },
      { icon: "pressure", en: "Reflexology style points", es: "Puntos estilo reflexología" },
      { icon: "chair", en: "Seated or reclined", es: "Sentado o reclinado" },
    ],
    origin: { icon: "globe", en: "China · reflexology traditions", es: "China · tradiciones de reflexología" },
    who: [
      { icon: "feet", tone: "tension", en: "On your feet all day", es: "Todo el día de pie" },
      { icon: "clock", tone: "relaxation", en: "Travelling", es: "De viaje" },
      { icon: "feet", tone: "relaxation", en: "Tired legs", es: "Piernas cansadas" },
    ],
    expect: [
      { icon: "shirt", en: "Shoes and socks off only", es: "Solo sin zapatos ni calcetines" },
      { icon: "pressure", en: "Firm thumb pressure", es: "Presión firme con los pulgares" },
      { icon: "sun", en: "Lighter step after", es: "Sales con las piernas ligeras" },
    ],
  },
  "four-hands": {
    line: { en: "Two therapists working in synchronized rhythm.", es: "Dos terapeutas trabajando en ritmo sincronizado." },
    what: [
      { icon: "hands", en: "Four hands at once", es: "Cuatro manos a la vez" },
      { icon: "waves", en: "Mirrored movements", es: "Movimientos en espejo" },
      { icon: "oil", en: "With oil", es: "Con aceite" },
    ],
    origin: { icon: "globe", en: "Luxury spa format", es: "Formato de spa de lujo" },
    who: [
      { icon: "sparkles", tone: "relaxation", en: "Massage lovers", es: "Amantes del masaje" },
      { icon: "heart", tone: "relaxation", en: "Marking an occasion", es: "Celebras algo" },
      { icon: "waves", tone: "relaxation", en: "Want something immersive", es: "Buscas algo envolvente" },
    ],
    expect: [
      { icon: "hands", en: "Twice the coverage", es: "El doble de cobertura" },
      { icon: "waves", en: "Hard to track, immersive", es: "Difícil de seguir, envolvente" },
      { icon: "clock", en: "Premium priced", es: "Precio premium" },
    ],
  },
};

export function factsFor(slug?: string | null): MassageFacts | null {
  return (slug && MASSAGE_FACTS[slug]) || null;
}
