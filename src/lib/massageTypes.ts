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

export type ClothingKey = "towel" | "dressed" | "face-only" | "feet-only";
export type OilKey = "oil" | "light-oil" | "none";

export type MassageVitals = {
  /** 1 to 5 */
  pressure: number;
  bestFor: BestForKey[];
  clothing: ClothingKey;
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
  towel: { en: "Towel draping", es: "Con toalla" },
  dressed: { en: "Stay dressed", es: "Con ropa" },
  "face-only": { en: "Face only, stay dressed", es: "Solo rostro, con ropa" },
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
  swedish: { pressure: 2, bestFor: ["relaxation"], clothing: "towel", oil: "oil" },
  "deep-tissue": { pressure: 5, bestFor: ["tension"], clothing: "towel", oil: "oil" },
  thai: { pressure: 4, bestFor: ["energy", "tension"], clothing: "dressed", oil: "none" },
  balinese: { pressure: 3, bestFor: ["relaxation", "tension"], clothing: "towel", oil: "oil" },
  shiatsu: { pressure: 4, bestFor: ["tension", "energy"], clothing: "dressed", oil: "none" },
  sports: { pressure: 4, bestFor: ["sport", "tension"], clothing: "towel", oil: "oil" },
  lymphatic: { pressure: 1, bestFor: ["relaxation"], clothing: "towel", oil: "oil" },
  "hot-stone": { pressure: 2, bestFor: ["relaxation", "tension"], clothing: "towel", oil: "oil" },
  kobido: { pressure: 2, bestFor: ["face"], clothing: "face-only", oil: "light-oil" },
  "gua-sha": { pressure: 1, bestFor: ["face"], clothing: "face-only", oil: "oil" },
  "head-scalp": { pressure: 2, bestFor: ["relaxation", "tension"], clothing: "dressed", oil: "none" },
  prenatal: { pressure: 2, bestFor: ["pregnancy", "relaxation"], clothing: "towel", oil: "oil" },
  couples: { pressure: 3, bestFor: ["relaxation"], clothing: "towel", oil: "oil" },
  "foot-legs": { pressure: 3, bestFor: ["tension", "relaxation"], clothing: "feet-only", oil: "oil" },
  "four-hands": { pressure: 3, bestFor: ["relaxation"], clothing: "towel", oil: "oil" },
};

export function vitalsFor(slug?: string | null): MassageVitals | null {
  return (slug && MASSAGE_VITALS[slug]) || null;
}
