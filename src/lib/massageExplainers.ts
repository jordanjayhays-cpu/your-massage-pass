/**
 * Massage Club explainers for the common massage styles.
 *
 * STRICT EDITORIAL RULE: describe what the massage IS and what people
 * choose it for. Never claim it cures, treats, heals, "releases toxins",
 * "detoxes", or "boosts immunity". No medical claims of any kind.
 *
 * Matching is done on the service's English name (falling back to the
 * Spanish name), so keywords below are lowercase substrings.
 */

export type MassageExplainer = {
  id: string;
  /** lowercase substrings matched against the service name */
  match: string[];
  title: { en: string; es: string };
  /** one line, shown under the studio's own description */
  summary: { en: string; es: string };
  /** 3 to 4 sentences, revealed by "Learn more" */
  more: { en: string; es: string };
};

export const MASSAGE_EXPLAINERS: MassageExplainer[] = [
  {
    id: "relaxing",
    match: ["relax", "swedish", "relajante", "sueco", "sueca", "clasico", "clásico", "classic"],
    title: { en: "Relaxing (Swedish)", es: "Relajante (sueco)" },
    summary: {
      en: "Relaxing massage: long, flowing strokes at a gentle to medium pressure. Most people choose it to unwind.",
      es: "Masaje relajante: movimientos largos y fluidos con presión suave o media. La mayoría lo elige para desconectar.",
    },
    more: {
      en: "You lie on a heated table, undressed to your comfort and covered with a towel, while the therapist works with oil in slow, continuous strokes. It feels warm and rhythmic rather than intense, and you can talk or stay quiet. People usually pick it after a long week, after travel, or when they simply want an hour of calm. It is a good first massage if you are not sure what you want.",
      es: "Te tumbas en una camilla templada, desvestido hasta donde te sientas cómodo y cubierto con una toalla, mientras el terapeuta trabaja con aceite en movimientos lentos y continuos. Se siente cálido y rítmico más que intenso, y puedes hablar o quedarte en silencio. Suele elegirse tras una semana larga, después de viajar o simplemente para tener una hora de calma. Es una buena primera opción si no sabes qué quieres.",
    },
  },
  {
    id: "deep-tissue",
    match: ["deep tissue", "deep-tissue", "descontracturante", "tejido profundo", "profundo"],
    title: { en: "Deep tissue", es: "Tejido profundo" },
    summary: {
      en: "Deep tissue: slow, firm pressure into deeper muscle layers. Most people choose it for sore muscles and knots.",
      es: "Tejido profundo: presión lenta y firme sobre las capas musculares profundas. La mayoría lo elige para músculos cargados y contracturas.",
    },
    more: {
      en: "The therapist works slowly with forearms, thumbs and elbows, staying on tight areas such as shoulders, neck and lower back. It feels strong and can be briefly uncomfortable, so you tell the therapist to ease off at any point and they will. People tend to book it when they sit at a desk all day, train hard, or carry tension in one specific spot. If it is your first massage, ask for medium pressure and build up from there.",
      es: "El terapeuta trabaja despacio con antebrazos, pulgares y codos, insistiendo en zonas cargadas como hombros, cuello y lumbares. Se siente intenso y puede resultar incómodo un momento, así que puedes pedir menos presión cuando quieras. Suele reservarse por trabajar sentado, entrenar fuerte o notar tensión en un punto concreto. Si es tu primer masaje, pide presión media y sube desde ahí.",
    },
  },
  {
    id: "thai",
    match: ["thai", "tailandes", "tailandés"],
    title: { en: "Thai massage", es: "Masaje tailandés" },
    summary: {
      en: "Thai massage: assisted stretching and pressure, done clothed on a mat. People choose it when they feel stiff.",
      es: "Masaje tailandés: estiramientos asistidos y presión, vestido y sobre una colchoneta. Se elige cuando uno se siente rígido.",
    },
    more: {
      en: "You stay dressed in loose clothes and lie on a floor mat, with no oil involved. The therapist uses hands, feet and body weight to press along lines of the body and move you through slow stretches. It feels active rather than sleepy, a bit like being stretched by someone else. People pick it when sitting or training has left them feeling stiff rather than sore.",
      es: "Te quedas vestido con ropa cómoda y te tumbas en una colchoneta, sin aceite. El terapeuta usa manos, pies y su propio peso para presionar líneas del cuerpo y llevarte por estiramientos lentos. Se siente activo más que adormecedor, como si otra persona te estirara. Se elige cuando estar sentado o entrenar te ha dejado rígido más que dolorido.",
    },
  },
  {
    id: "shiatsu",
    match: ["shiatsu"],
    title: { en: "Shiatsu", es: "Shiatsu" },
    summary: {
      en: "Shiatsu: rhythmic thumb and palm pressure held on points, done clothed. People choose it for a calm, structured session.",
      es: "Shiatsu: presión rítmica con pulgares y palmas sobre puntos, vestido. Se elige por ser una sesión calmada y estructurada.",
    },
    more: {
      en: "You stay clothed and lie on a mat or table while the therapist presses and holds along the body with thumbs, palms and elbows. There is no oil and very little sliding, so it feels like steady pressure that comes and goes. Sessions are quiet and follow a repeating pattern down the body. People choose it when they want something calm and precise rather than an oil massage.",
      es: "Permaneces vestido en una colchoneta o camilla mientras el terapeuta presiona y mantiene con pulgares, palmas y codos. No hay aceite ni apenas deslizamiento, así que se siente como una presión constante que va y viene. Las sesiones son silenciosas y siguen un patrón que recorre el cuerpo. Se elige cuando se busca algo tranquilo y preciso en lugar de un masaje con aceite.",
    },
  },
  {
    id: "sports",
    match: ["sport", "deportivo", "deportiva"],
    title: { en: "Sports massage", es: "Masaje deportivo" },
    summary: {
      en: "Sports massage: brisk, targeted work on the muscles you train most. People choose it around training and races.",
      es: "Masaje deportivo: trabajo rápido y localizado en los músculos que más entrenas. Se elige alrededor de entrenamientos y carreras.",
    },
    more: {
      en: "The therapist asks what you train and then focuses on those muscle groups with a mix of firm strokes, compression and some stretching. The pace is quicker than a relaxing massage and the pressure is usually medium to firm. It is often booked a few days before or after a hard session or an event. Tell the therapist about anything that hurts so they can work around it.",
      es: "El terapeuta pregunta qué entrenas y se centra en esos grupos musculares con presión firme, compresión y algún estiramiento. El ritmo es más rápido que en un relajante y la presión suele ser media o fuerte. Se reserva a menudo unos días antes o después de una sesión dura o una competición. Comenta cualquier molestia para que puedan evitarla.",
    },
  },
  {
    id: "lymphatic",
    match: ["lymph", "linfat", "linfát", "drenaje"],
    title: { en: "Lymphatic drainage", es: "Drenaje linfático" },
    summary: {
      en: "Lymphatic drainage: very light, repetitive strokes on the skin. People often choose it for a gentle, slow session.",
      es: "Drenaje linfático: movimientos muy suaves y repetitivos sobre la piel. Se elige por ser una sesión suave y lenta.",
    },
    more: {
      en: "The pressure is far lighter than most people expect, closer to a soft brushing of the skin than a muscle massage. The therapist repeats small movements in one direction for long stretches, so it is slow and very quiet. Many people find it the most relaxing thing on a menu simply because so little is happening. It suits first-timers who do not like strong pressure.",
      es: "La presión es mucho más suave de lo que se espera, más parecida a un roce sobre la piel que a un masaje muscular. El terapeuta repite movimientos pequeños en una dirección durante largos tramos, así que es lento y muy silencioso. A mucha gente le resulta lo más relajante de la carta precisamente porque pasa muy poco. Va bien si es tu primera vez y no te gusta la presión fuerte.",
    },
  },
  {
    id: "hot-stone",
    match: ["hot stone", "stone", "piedras"],
    title: { en: "Hot stone", es: "Piedras calientes" },
    summary: {
      en: "Hot stone: warmed smooth stones placed on the body and used to massage. People choose it when they want warmth.",
      es: "Piedras calientes: piedras lisas templadas colocadas sobre el cuerpo y usadas para masajear. Se elige por el calor.",
    },
    more: {
      en: "Smooth basalt stones are warmed in water and either rested on the back and shoulders or held by the therapist as an extension of their hands. The heat means the therapist can work with less pressure and it still feels substantial. Tell them straight away if a stone feels too hot, they adjust it in seconds. People pick it in winter or when a normal massage never quite feels warm enough.",
      es: "Se calientan piedras lisas de basalto en agua y se apoyan en la espalda y los hombros o el terapeuta las usa como prolongación de sus manos. El calor permite trabajar con menos presión y aun así se siente profundo. Avisa enseguida si una piedra quema, se ajusta en segundos. Se elige en invierno o cuando un masaje normal nunca resulta lo bastante cálido.",
    },
  },
  {
    id: "head-scalp",
    match: ["head", "scalp", "craneal", "cabeza", "cuero cabelludo", "indian"],
    title: { en: "Head and scalp", es: "Cabeza y cuero cabelludo" },
    summary: {
      en: "Head and scalp: fingertip work on the scalp, neck and shoulders, usually seated and clothed. Often chosen as a short session.",
      es: "Cabeza y cuero cabelludo: trabajo con las yemas en cuero cabelludo, cuello y hombros, normalmente sentado y vestido.",
    },
    more: {
      en: "You usually sit in a chair, fully clothed, while the therapist works the scalp, temples, neck and shoulders with their fingertips. Some studios use a little oil in the hair, so ask first if you have plans afterwards. Sessions are short, often twenty or thirty minutes. People book it as a quick reset in the middle of a day rather than a full hour on a table.",
      es: "Normalmente te sientas en una silla, vestido, mientras el terapeuta trabaja cuero cabelludo, sienes, cuello y hombros con las yemas. Algunos estudios usan un poco de aceite en el pelo, pregunta antes si tienes planes después. Las sesiones son cortas, de veinte o treinta minutos. Se reserva como una pausa rápida en mitad del día más que como una hora completa en camilla.",
    },
  },
  {
    id: "kobido",
    match: ["kobido", "facial", "face"],
    title: { en: "Kobido facial massage", es: "Masaje facial kobido" },
    summary: {
      en: "Kobido: fast, rhythmic massage of the face, neck and scalp. People choose it as a facial that is worked by hand.",
      es: "Kobido: masaje rápido y rítmico de cara, cuello y cuero cabelludo. Se elige como un facial trabajado a mano.",
    },
    more: {
      en: "You lie face up while the therapist works the face, jaw, neck and scalp with quick tapping and stroking movements. The rhythm is much faster than a body massage and the sound of it is part of the experience. Little or no product is used beyond a light oil or balm. People choose it when they hold tension in the jaw and forehead or simply want something different from a body massage.",
      es: "Te tumbas boca arriba mientras el terapeuta trabaja cara, mandíbula, cuello y cuero cabelludo con movimientos rápidos de percusión y deslizamiento. El ritmo es mucho más rápido que en un masaje corporal y su sonido forma parte de la experiencia. Se usa poco producto, como mucho un aceite ligero o un bálsamo. Se elige por tensión en mandíbula y frente o simplemente por probar algo distinto.",
    },
  },
  {
    id: "gua-sha",
    match: ["gua sha", "guasha"],
    title: { en: "Gua sha", es: "Gua sha" },
    summary: {
      en: "Gua sha: a smooth tool stroked along the skin in one direction. People choose it as an add-on to hands-on work.",
      es: "Gua sha: una herramienta lisa que se desliza sobre la piel en una dirección. Se elige como complemento al trabajo manual.",
    },
    more: {
      en: "The therapist uses oil and a smooth-edged stone or tool, drawing it repeatedly along one area of the body or face. On the body it can leave temporary redness for a day or so, which is normal and worth knowing before a beach day. On the face the pressure is much lighter and leaves no marks. It is usually combined with a regular massage rather than booked on its own.",
      es: "El terapeuta usa aceite y una piedra o herramienta de borde liso, deslizándola repetidamente por una zona del cuerpo o la cara. En el cuerpo puede dejar rojeces temporales durante un día, algo normal pero que conviene saber antes de ir a la playa. En la cara la presión es mucho más ligera y no deja marcas. Suele combinarse con un masaje normal en vez de reservarse solo.",
    },
  },
  {
    id: "prenatal",
    match: ["prenatal", "pregnan", "embaraz", "premama", "premamá"],
    title: { en: "Prenatal massage", es: "Masaje prenatal" },
    summary: {
      en: "Prenatal: a massage adapted for pregnancy, usually side-lying with cushions. Chosen for comfort during pregnancy.",
      es: "Prenatal: un masaje adaptado al embarazo, normalmente de lado y con cojines. Se elige por comodidad durante el embarazo.",
    },
    more: {
      en: "You lie on your side supported by cushions rather than face down, and the pressure stays gentle throughout. The therapist will ask how many weeks you are and which positions feel comfortable. Tell the studio you are pregnant when you book, since not every therapist offers it and some ask for a certain stage of pregnancy. If you have any medical questions, check with your midwife or doctor first.",
      es: "Te tumbas de lado apoyada en cojines en vez de boca abajo, y la presión se mantiene suave. El terapeuta preguntará de cuántas semanas estás y qué posturas te resultan cómodas. Indica que estás embarazada al reservar, porque no todos los terapeutas lo ofrecen y algunos piden cierta etapa del embarazo. Ante cualquier duda médica, consulta antes con tu matrona o tu médico.",
    },
  },
  {
    id: "couples",
    match: ["couple", "pareja", "dos personas"],
    title: { en: "Couples massage", es: "Masaje en pareja" },
    summary: {
      en: "Couples: two massages side by side in the same room, with two therapists. Chosen to go together with someone.",
      es: "En pareja: dos masajes uno al lado del otro en la misma sala, con dos terapeutas. Se elige para ir acompañado.",
    },
    more: {
      en: "Two tables are set up in one room and two therapists work at the same time, so you both start and finish together. Each of you can still choose your own pressure and focus areas, they do not have to match. It is a little less quiet than a solo massage because there are two of you in the room. People book it for birthdays, anniversaries or a first massage with a nervous friend or partner.",
      es: "Se preparan dos camillas en una sala y dos terapeutas trabajan a la vez, así que empezáis y terminas a la vez. Cada uno puede elegir su presión y sus zonas, no tienen que coincidir. Es algo menos silencioso que un masaje individual porque sois dos en la sala. Se reserva para cumpleaños, aniversarios o un primer masaje con alguien que va nervioso.",
    },
  },
  {
    id: "foot-leg",
    match: ["foot", "feet", "reflex", "pies", "pie", "piernas", "leg"],
    title: { en: "Foot and leg massage", es: "Masaje de pies y piernas" },
    summary: {
      en: "Foot and leg: focused work below the knee, usually seated and clothed above the waist. Chosen after long days walking.",
      es: "Pies y piernas: trabajo centrado de la rodilla hacia abajo, sentado y vestido de cintura para arriba.",
    },
    more: {
      en: "You sit in a reclining chair with your legs supported while the therapist works the feet, ankles and calves with thumbs and knuckles. Only your feet and lower legs are uncovered, so it is an easy option if undressing feels like a lot. Pressure on the soles can be surprisingly strong, so say if you want it lighter. People book it after long days on their feet or a lot of walking around the city.",
      es: "Te sientas en un sillón reclinable con las piernas apoyadas mientras el terapeuta trabaja pies, tobillos y gemelos con pulgares y nudillos. Solo se descubren pies y piernas, así que es una opción fácil si desvestirse te da pereza. La presión en las plantas puede ser sorprendentemente fuerte, avisa si la quieres más suave. Se reserva tras días largos de pie o de caminar por la ciudad.",
    },
  },
  {
    id: "four-hands",
    match: ["four hands", "4 hands", "cuatro manos", "4 manos"],
    title: { en: "Four hands massage", es: "Masaje a cuatro manos" },
    summary: {
      en: "Four hands: two therapists working on you at once, in mirrored movements. Chosen as a treat rather than a first massage.",
      es: "Cuatro manos: dos terapeutas trabajando a la vez con movimientos en espejo. Se elige como un capricho.",
    },
    more: {
      en: "Two therapists work on you at the same time, usually mirroring each other so both sides of the body are covered at once. Because there is so much happening it is hard to follow where the hands are, which is the whole point for most people. It costs more than a standard massage since two therapists are booked. It is usually chosen as a treat rather than as a first massage.",
      es: "Dos terapeutas trabajan a la vez, normalmente en espejo, de modo que ambos lados del cuerpo se cubren al mismo tiempo. Como pasan tantas cosas cuesta seguir dónde están las manos, y eso es justo lo que busca la mayoría. Cuesta más que un masaje normal porque se reservan dos terapeutas. Suele elegirse como capricho más que como primer masaje.",
    },
  },
];

/** Find the explainer for a service name. Returns null when nothing matches. */
export function findExplainer(...names: (string | null | undefined)[]): MassageExplainer | null {
  const hay = names.filter(Boolean).join(" ").toLowerCase();
  if (!hay.trim()) return null;
  for (const e of MASSAGE_EXPLAINERS) {
    if (e.match.some((k) => hay.includes(k))) return e;
  }
  return null;
}
