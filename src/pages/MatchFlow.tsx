import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Leaf, Dumbbell, Flower2, HelpCircle, Star } from "lucide-react";
import { supabase, loadShops, cachedShops, type Shop } from "@/lib/supabase";
import { studioPath } from "@/lib/studioHref";
import { studioImageFallback } from "@/lib/studioImages";
import { useFlowLang, pickCopy } from "@/lib/flowLang";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import AccountHeaderLink from "@/components/AccountHeaderLink";
import { MASSAGE_CLUB_WA } from "@/app/lib/whatsapp";

type NeedKey = "stress" | "sore" | "pamper" | "unsure";
type WhenKey = "today" | "tomorrow" | "week" | "flexible";

const NEED_KEYWORD: Record<NeedKey, string | null> = {
  stress: "relaxing",
  sore: "deep tissue",
  pamper: "hot stone",
  unsure: null,
};

const COPY = {
  en: {
    title: "Smart matching with AI",
    subtitle:
      "Answer three quick questions and we find the right studio at the right price. You pay the studio directly, no booking fee.",
    q1: "What does your body need?",
    q2: "When would you like to go?",
    q3: "Where in Madrid?",
    needs: {
      stress: "Melt away stress",
      sore: "Fix sore muscles",
      pamper: "Pure pampering",
      unsure: "Help me figure it out",
    },
    when: { today: "Today", tomorrow: "Tomorrow", week: "This week", flexible: "I'm flexible" },
    anywhere: "Anywhere",
    finding: "Finding your match...",
    findingSub: "Our smart matching is comparing studios, treatments and prices",
    results: "Your matches",
    none: "No match yet. Try a wider area or a different massage.",
    why: "Why this match",
    whyNeed: {
      stress: "Great for melting away stress",
      sore: "Great for sore muscles",
      pamper: "Great for pure pampering",
      unsure: "A well rated studio",
    },
    inArea: (a: string) => `in ${a}`,
    realPrice: "real price shown",
    view: "View studio",
    book: "Book on WhatsApp",
    seeAll: "See all studios",
    reviews: (n: number) => `${n} reviews`,
    waWhen: { today: "today", tomorrow: "tomorrow", week: "this week", flexible: "whenever there is space" },
    waMsg: (studio: string, service: string, when: string) =>
      `Hi! Smart match found me ${studio}. I'd like ${service} ${when}. Can you book it for me?`,
    back: "Back",
    step: (n: number) => `Step ${n} of 3`,
  },
  es: {
    title: "Emparejamiento inteligente con IA",
    subtitle:
      "Responde tres preguntas rápidas y encontramos el estudio adecuado al precio adecuado. Pagas directamente en el estudio, sin gastos de reserva.",
    q1: "¿Qué necesita tu cuerpo?",
    q2: "¿Cuándo te gustaría ir?",
    q3: "¿En qué zona de Madrid?",
    needs: {
      stress: "Soltar el estrés",
      sore: "Aliviar músculos cargados",
      pamper: "Puro mimo",
      unsure: "Ayúdame a decidir",
    },
    when: { today: "Hoy", tomorrow: "Mañana", week: "Esta semana", flexible: "Soy flexible" },
    anywhere: "Cualquier zona",
    finding: "Buscando tu match...",
    findingSub: "Nuestro emparejamiento inteligente compara estudios, tratamientos y precios",
    results: "Tus coincidencias",
    none: "Aún sin coincidencias. Prueba con otra zona u otro masaje.",
    why: "Por qué encaja",
    whyNeed: {
      stress: "Ideal para soltar el estrés",
      sore: "Ideal para músculos cargados",
      pamper: "Ideal para puro mimo",
      unsure: "Un estudio bien valorado",
    },
    inArea: (a: string) => `en ${a}`,
    realPrice: "precio real a la vista",
    view: "Ver estudio",
    book: "Reservar por WhatsApp",
    seeAll: "Ver todos los estudios",
    reviews: (n: number) => `${n} reseñas`,
    waWhen: { today: "hoy", tomorrow: "mañana", week: "esta semana", flexible: "cuando haya hueco" },
    waMsg: (studio: string, service: string, when: string) =>
      `¡Hola! El emparejamiento inteligente me ha encontrado ${studio}. Me gustaría ${service} ${when}. ¿Me lo podéis reservar?`,
    back: "Atrás",
    step: (n: number) => `Paso ${n} de 3`,
  },
  fr: {
    title: "Matching intelligent avec IA",
    subtitle:
      "Répondez à trois questions rapides et nous trouvons le bon centre au bon prix. Vous payez directement au centre, sans frais de réservation.",
    q1: "De quoi votre corps a-t-il besoin ?",
    q2: "Quand souhaitez-vous y aller ?",
    q3: "Où à Madrid ?",
    needs: {
      stress: "Évacuer le stress",
      sore: "Soulager les muscles",
      pamper: "Pur moment de douceur",
      unsure: "Aidez-moi à choisir",
    },
    when: { today: "Aujourd'hui", tomorrow: "Demain", week: "Cette semaine", flexible: "Je suis flexible" },
    anywhere: "Partout",
    finding: "Recherche de votre match...",
    findingSub: "Notre matching intelligent compare centres, soins et prix",
    results: "Vos correspondances",
    none: "Pas encore de correspondance. Essayez une autre zone ou un autre massage.",
    why: "Pourquoi ce choix",
    whyNeed: {
      stress: "Parfait pour évacuer le stress",
      sore: "Parfait pour les muscles endoloris",
      pamper: "Parfait pour se faire plaisir",
      unsure: "Un centre bien noté",
    },
    inArea: (a: string) => `à ${a}`,
    realPrice: "prix réel affiché",
    view: "Voir le centre",
    book: "Réserver sur WhatsApp",
    seeAll: "Voir tous les centres",
    reviews: (n: number) => `${n} avis`,
    waWhen: { today: "aujourd'hui", tomorrow: "demain", week: "cette semaine", flexible: "quand il y a de la place" },
    waMsg: (studio: string, service: string, when: string) =>
      `Bonjour ! Le matching intelligent m'a trouvé ${studio}. Je voudrais ${service} ${when}. Pouvez-vous le réserver pour moi ?`,
    back: "Retour",
    step: (n: number) => `Étape ${n} sur 3`,
  },
  de: {
    title: "Smartes Matching mit KI",
    subtitle:
      "Beantworte drei kurze Fragen und wir finden das passende Studio zum passenden Preis. Du zahlst direkt im Studio, keine Buchungsgebühr.",
    q1: "Was braucht dein Körper?",
    q2: "Wann möchtest du hin?",
    q3: "Wo in Madrid?",
    needs: {
      stress: "Stress abbauen",
      sore: "Verspannte Muskeln lösen",
      pamper: "Reines Verwöhnen",
      unsure: "Hilf mir bei der Wahl",
    },
    when: { today: "Heute", tomorrow: "Morgen", week: "Diese Woche", flexible: "Ich bin flexibel" },
    anywhere: "Überall",
    finding: "Wir suchen dein Match...",
    findingSub: "Unser smartes Matching vergleicht Studios, Behandlungen und Preise",
    results: "Deine Treffer",
    none: "Noch kein Treffer. Probiere eine andere Gegend oder Massage.",
    why: "Warum dieser Treffer",
    whyNeed: {
      stress: "Gut zum Stressabbau",
      sore: "Gut für verspannte Muskeln",
      pamper: "Gut zum Verwöhnen",
      unsure: "Ein gut bewertetes Studio",
    },
    inArea: (a: string) => `in ${a}`,
    realPrice: "echter Preis sichtbar",
    view: "Studio ansehen",
    book: "Über WhatsApp buchen",
    seeAll: "Alle Studios ansehen",
    reviews: (n: number) => `${n} Bewertungen`,
    waWhen: { today: "heute", tomorrow: "morgen", week: "diese Woche", flexible: "wann immer es passt" },
    waMsg: (studio: string, service: string, when: string) =>
      `Hallo! Das smarte Matching hat mir ${studio} vorgeschlagen. Ich hätte gern ${service} ${when}. Könnt ihr das für mich buchen?`,
    back: "Zurück",
    step: (n: number) => `Schritt ${n} von 3`,
  },
  it: {
    title: "Abbinamento intelligente con IA",
    subtitle:
      "Rispondi a tre domande veloci e troviamo il centro giusto al prezzo giusto. Paghi direttamente al centro, senza costi di prenotazione.",
    q1: "Di cosa ha bisogno il tuo corpo?",
    q2: "Quando vorresti andare?",
    q3: "In quale zona di Madrid?",
    needs: {
      stress: "Sciogliere lo stress",
      sore: "Muscoli indolenziti",
      pamper: "Puro relax e coccole",
      unsure: "Aiutami a scegliere",
    },
    when: { today: "Oggi", tomorrow: "Domani", week: "Questa settimana", flexible: "Sono flessibile" },
    anywhere: "Ovunque",
    finding: "Stiamo cercando il tuo match...",
    findingSub: "Il nostro abbinamento intelligente confronta centri, trattamenti e prezzi",
    results: "I tuoi abbinamenti",
    none: "Ancora nessun risultato. Prova un'altra zona o un altro massaggio.",
    why: "Perché questo abbinamento",
    whyNeed: {
      stress: "Ottimo per sciogliere lo stress",
      sore: "Ottimo per muscoli indolenziti",
      pamper: "Ottimo per coccolarsi",
      unsure: "Un centro con buone recensioni",
    },
    inArea: (a: string) => `a ${a}`,
    realPrice: "prezzo reale mostrato",
    view: "Vedi il centro",
    book: "Prenota su WhatsApp",
    seeAll: "Vedi tutti i centri",
    reviews: (n: number) => `${n} recensioni`,
    waWhen: { today: "oggi", tomorrow: "domani", week: "questa settimana", flexible: "quando c'è posto" },
    waMsg: (studio: string, service: string, when: string) =>
      `Ciao! L'abbinamento intelligente mi ha trovato ${studio}. Vorrei ${service} ${when}. Potete prenotarlo per me?`,
    back: "Indietro",
    step: (n: number) => `Passo ${n} di 3`,
  },
  pt: {
    title: "Correspondência inteligente com IA",
    subtitle:
      "Responde a três perguntas rápidas e encontramos o estúdio certo ao preço certo. Pagas diretamente ao estúdio, sem taxa de reserva.",
    q1: "Do que precisa o teu corpo?",
    q2: "Quando queres ir?",
    q3: "Em que zona de Madrid?",
    needs: {
      stress: "Aliviar o stress",
      sore: "Músculos doridos",
      pamper: "Puro mimo",
      unsure: "Ajuda-me a decidir",
    },
    when: { today: "Hoje", tomorrow: "Amanhã", week: "Esta semana", flexible: "Sou flexível" },
    anywhere: "Qualquer zona",
    finding: "A encontrar a tua correspondência...",
    findingSub: "A nossa correspondência inteligente compara estúdios, tratamentos e preços",
    results: "As tuas correspondências",
    none: "Ainda sem resultados. Experimenta outra zona ou outra massagem.",
    why: "Porquê esta escolha",
    whyNeed: {
      stress: "Ótimo para aliviar o stress",
      sore: "Ótimo para músculos doridos",
      pamper: "Ótimo para puro mimo",
      unsure: "Um estúdio bem avaliado",
    },
    inArea: (a: string) => `em ${a}`,
    realPrice: "preço real à vista",
    view: "Ver estúdio",
    book: "Reservar no WhatsApp",
    seeAll: "Ver todos os estúdios",
    reviews: (n: number) => `${n} avaliações`,
    waWhen: { today: "hoje", tomorrow: "amanhã", week: "esta semana", flexible: "quando houver vaga" },
    waMsg: (studio: string, service: string, when: string) =>
      `Olá! A correspondência inteligente encontrou-me ${studio}. Gostaria de ${service} ${when}. Podem reservar para mim?`,
    back: "Voltar",
    step: (n: number) => `Passo ${n} de 3`,
  },
  zh: {
    title: "AI 智能匹配",
    subtitle: "回答三个简单问题，我们为您找到合适的按摩中心和合适的价格。您到店直接付款，没有预订费。",
    q1: "您的身体需要什么？",
    q2: "您想什么时候去？",
    q3: "马德里哪个区域？",
    needs: {
      stress: "舒缓压力",
      sore: "缓解酸痛肌肉",
      pamper: "纯粹享受",
      unsure: "帮我决定",
    },
    when: { today: "今天", tomorrow: "明天", week: "本周", flexible: "时间灵活" },
    anywhere: "任意区域",
    finding: "正在为您匹配...",
    findingSub: "我们的智能匹配正在比较按摩中心、项目和价格",
    results: "为您匹配的结果",
    none: "暂无匹配结果。请尝试其他区域或其他按摩。",
    why: "匹配理由",
    whyNeed: {
      stress: "适合舒缓压力",
      sore: "适合酸痛肌肉",
      pamper: "适合纯粹享受",
      unsure: "评价良好的按摩中心",
    },
    inArea: (a: string) => `位于${a}`,
    realPrice: "价格真实透明",
    view: "查看按摩中心",
    book: "通过WhatsApp预订",
    seeAll: "查看全部按摩中心",
    reviews: (n: number) => `${n} 条评价`,
    waWhen: { today: "今天", tomorrow: "明天", week: "本周", flexible: "有空位的时候" },
    waMsg: (studio: string, service: string, when: string) =>
      `你好！智能匹配为我找到了 ${studio}。我想预约 ${service}（${when}）。可以帮我预订吗？`,
    back: "返回",
    step: (n: number) => `第 ${n} 步，共 3 步`,
  },
} as const;

type MatchCard = {
  key: string;
  studio: string;
  area: string;
  slug: string | null;
  image: string;
  rating: number | null;
  reviews: number | null;
  service: string;
  duration: number | null;
  price: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function fromRpcRow(row: Record<string, unknown>, i: number, shops: Shop[]): MatchCard {
  const slug = (row.slug as string) || null;
  const shop = shops.find((s) => (slug && s.slug === slug) || s.studio === row.studio_name || s.studio === row.name);
  return {
    key: String(row.id ?? slug ?? i),
    studio: String(row.studio_name ?? row.name ?? shop?.studio ?? ""),
    area: String(row.area ?? row.district ?? shop?.district ?? ""),
    slug: slug || shop?.slug || shop?.partner_id || null,
    image: String(row.image ?? row.cover_url ?? shop?.image ?? ""),
    rating: num(row.rating ?? row.google_rating) ?? shop?.rating ?? null,
    reviews: num(row.reviews ?? row.review_count ?? row.google_reviews) ?? shop?.reviews ?? null,
    service: String(row.service ?? row.service_name ?? shop?.partner_services?.[0]?.name ?? ""),
    duration: num(row.duration ?? row.duration_min) ?? shop?.partner_services?.[0]?.duration ?? null,
    price: num(row.price) ?? shop?.partner_services?.[0]?.price ?? null,
  };
}

function fromShop(shop: Shop, keyword: string | null): MatchCard {
  const svc =
    (keyword
      ? shop.partner_services?.find((s) =>
          `${s.name} ${s.name_en ?? ""} ${s.type ?? ""}`.toLowerCase().includes(keyword.split(" ")[0]),
        )
      : null) || shop.partner_services?.[0];
  return {
    key: shop.partner_id || shop.id,
    studio: shop.studio,
    area: shop.district,
    slug: shop.slug || shop.partner_id || null,
    image: shop.image,
    rating: shop.rating,
    reviews: shop.reviews,
    service: svc?.name_en || svc?.name || "",
    duration: svc?.duration ?? null,
    price: svc?.price ?? null,
  };
}

export default function MatchFlow() {
  const lang = useFlowLang();
  const t = pickCopy(COPY, lang) as (typeof COPY)["en"];
  const navigate = useNavigate();

  const [shops, setShops] = useState<Shop[]>(() => cachedShops() ?? []);
  const [step, setStep] = useState(1);
  const [need, setNeed] = useState<NeedKey | null>(null);
  const [when, setWhen] = useState<WhenKey | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [phase, setPhase] = useState<"quiz" | "finding" | "results">("quiz");
  const [cards, setCards] = useState<MatchCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadShops().then((s) => {
      if (!cancelled) setShops(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const s of shops) if (s.district?.trim()) set.add(s.district.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const keyword = need ? NEED_KEYWORD[need] : null;

  async function run(chosenArea: string | null) {
    setPhase("finding");
    const started = Date.now();
    let result: MatchCard[] = [];
    try {
      const { data, error } = await supabase.rpc("match_studios", {
        p_area: chosenArea,
        p_want: keyword,
        p_exclude: null,
        p_limit: 3,
      });
      if (!error && Array.isArray(data)) {
        result = (data as Record<string, unknown>[]).map((row, i) => fromRpcRow(row, i, shops));
      }
    } catch {
      /* fall through to the client-side fallback */
    }

    if (result.length === 0) {
      const pool = (cachedShops() ?? shops).filter((s) => {
        if (chosenArea && s.district?.trim() !== chosenArea) return false;
        if (!keyword) return true;
        const hay = [s.name, s.type, ...(s.tags || []), ...(s.services || []), ...(s.partner_services || []).map((x) => `${x.name} ${x.name_en ?? ""} ${x.type ?? ""}`)]
          .join(" ")
          .toLowerCase();
        return keyword.split(" ").some((w) => hay.includes(w));
      });
      result = pool
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 3)
        .map((s) => fromShop(s, keyword));
    }

    const wait = Math.max(0, 1200 - (Date.now() - started));
    window.setTimeout(() => {
      setCards(result);
      setPhase("results");
    }, wait);
  }

  const goBack = () => {
    if (phase === "results" || phase === "finding") {
      setPhase("quiz");
      setStep(3);
      return;
    }
    if (step > 1) setStep(step - 1);
    else navigate("/");
  };

  const whyLine = (c: MatchCard) => {
    const bits: string[] = [t.whyNeed[need ?? "unsure"]];
    if (c.area) bits.push(t.inArea(c.area));
    bits.push(t.realPrice);
    return bits.join(", ");
  };

  const waHref = (c: MatchCard) => {
    const msg = t.waMsg(c.studio, c.service || t.needs[need ?? "unsure"], t.waWhen[when ?? "flexible"]);
    return `https://wa.me/${MASSAGE_CLUB_WA}?text=${encodeURIComponent(msg)}`;
  };

  const chip = (active: boolean) =>
    `h-11 px-4 rounded-full border text-sm font-medium transition ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-foreground border-border/70 hover:border-primary/60"
    }`;

  const needIcons: Record<NeedKey, JSX.Element> = {
    stress: <Leaf className="h-5 w-5" />,
    sore: <Dumbbell className="h-5 w-5" />,
    pamper: <Flower2 className="h-5 w-5" />,
    unsure: <HelpCircle className="h-5 w-5" />,
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${t.title} | Massage Club`}</title>
        <meta name="description" content={t.subtitle} />
        <link rel="canonical" href="https://book.massageclub.io/match" />
      </Helmet>

      <header className="border-b border-border/60 bg-background/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label={t.back}
            className="h-10 w-10 -ml-2 rounded-full inline-flex items-center justify-center text-foreground hover:bg-secondary transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-lg tracking-tight text-foreground">
            Massage Club
          </Link>
          <div className="flex items-center gap-3">
            <AccountHeaderLink />
            <LanguageFlagToggle variant="compact" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24">
        <section className="pt-8">
          <h1 className="font-display text-3xl md:text-4xl leading-tight text-foreground inline-flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-snug">{t.subtitle}</p>
        </section>

        {phase === "quiz" && (
          <>
            <div className="mt-6 flex items-center gap-2" aria-label={t.step(step)}>
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-secondary"}`}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">{t.step(step)}</span>
            </div>

            {step === 1 && (
              <section className="mt-8">
                <h2 className="font-display text-2xl text-foreground">{t.q1}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(Object.keys(t.needs) as NeedKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setNeed(k);
                        setStep(2);
                      }}
                      className={`text-left p-5 rounded-2xl border shadow-soft transition ${
                        need === k ? "border-primary bg-secondary" : "border-border/70 bg-card hover:border-primary/60"
                      }`}
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
                        {needIcons[k]}
                      </span>
                      <span className="mt-3 block text-base font-semibold text-foreground">{t.needs[k]}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="mt-8">
                <h2 className="font-display text-2xl text-foreground">{t.q2}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(t.when) as WhenKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setWhen(k);
                        setStep(3);
                      }}
                      className={chip(when === k)}
                    >
                      {t.when[k]}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="mt-8">
                <h2 className="font-display text-2xl text-foreground">{t.q3}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setArea(null);
                      run(null);
                    }}
                    className={chip(area === null)}
                  >
                    {t.anywhere}
                  </button>
                  {areas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setArea(a);
                        run(a);
                      }}
                      className={chip(area === a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {phase === "finding" && (
          <section className="mt-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-secondary animate-pulse inline-flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <p className="mt-5 font-display text-2xl text-foreground animate-pulse">{t.finding}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.findingSub}</p>
          </section>
        )}

        {phase === "results" && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-foreground">{t.results}</h2>
            {cards.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t.none}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {cards.map((c) => (
                  <article key={c.key} className="rounded-2xl border border-border/70 bg-card shadow-soft overflow-hidden">
                    {c.image && (
                      <div className="relative h-40 w-full bg-secondary">
                        <img
                          src={c.image}
                          alt={c.studio}
                          loading="lazy"
                          onError={studioImageFallback}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-display text-xl text-foreground">{c.studio}</h3>
                      <p className="text-sm text-muted-foreground">{c.area}</p>
                      {c.rating != null && (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-foreground">
                          <Star className="h-4 w-4 text-primary fill-primary" />
                          {c.rating.toFixed(1)}
                          {c.reviews != null && (
                            <span className="text-muted-foreground">· {t.reviews(c.reviews)}</span>
                          )}
                        </p>
                      )}
                      {c.service && (
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {[c.service, c.duration ? `${c.duration} min` : null, c.price != null ? `${c.price} EUR` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{t.why}: </span>
                        {whyLine(c)}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <Link
                          to={studioPath({ slug: c.slug })}
                          className="flex-1 h-11 rounded-full border border-border text-sm font-semibold text-foreground inline-flex items-center justify-center hover:border-primary/60 transition"
                        >
                          {t.view}
                        </Link>
                        <a
                          href={waHref(c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center hover:opacity-90 transition"
                        >
                          {t.book}
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Link
              to="/studios"
              className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-primary transition"
            >
              {t.seeAll}
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
