import { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import BookFlowWizard, { useBookFlowLang } from "@/components/BookFlowWizard";
import { trackEvent } from "@/lib/siteVisit";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";
import { useState } from "react";

/** Price card label -> value used in step 1 of the wizard. */
const CARD_TO_MASSAGE = {
  en: { Relaxing: "Relaxing", "Deep tissue": "Deep tissue", Thai: "Thai" },
  es: { Relajante: "Relajante", Descontracturante: "Masaje descontracturante", Tailandés: "Tailandés" },
} as const;

const OTHER_TYPES = {
  en: [
    "Sports recovery",
    "Hot stone",
    "Balinese",
    "Shiatsu",
    "Reflexology",
    "Lymphatic drainage",
    "Couples",
  ],
  es: [
    "Recuperación deportiva",
    "Piedras calientes",
    "Balinés",
    "Shiatsu",
    "Reflexología",
    "Drenaje linfático",
    "En pareja",
  ],
} as const;

const COPY = {
  en: {
    seoTitle: "Book a massage in Madrid, in English | Massage Club",
    seoDesc:
      "Tell us what massage you want and when. We confirm your time with the studio. You pay at the studio, no booking fee.",
    h1: "A massage in Madrid, booked for you in English.",
    sub: "Tell us what you want and when. We confirm your time with the studio. You pay at the studio, no booking fee.",
    cta: "Book my massage",
    prices: [
      { name: "Relaxing", detail: "60 min from €45" },
      { name: "Deep tissue", detail: "60 min from €60" },
      { name: "Thai", detail: "60 min from €60" },
    ],
    priceNote: "Real prices at central Madrid studios.",
    otherCard: "Other",
    otherPlaceholder: "More massage types",
    notSure: "Not sure which massage?",
    quizOffer: "Take the 60 second quiz and we'll suggest one, or just pick below.",
    quizCta: "Start the 60 second quiz",
    howTitle: "How it works",
    how: [
      "Tell us what you want and when.",
      "We confirm your time with the studio in Spanish.",
      "You get your confirmation on WhatsApp or email.",
    ],
    trust: "50+ Madrid studios listed with real prices.",
    footerLead: "Prefer to chat? Message us on WhatsApp",
    waQ1: "What massage do you want?",
    waQ2: "What area are you in?",
    waAreaPlaceholder: "e.g. Chamberi, Sol, Parla",
    waAreaUnsure: "Not sure",
    waOpen: "Open WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  es: {
    seoTitle: "Reserva un masaje en Madrid, en inglés | Massage Club",
    seoDesc:
      "Dinos qué masaje quieres y cuándo. Confirmamos tu hora con el centro. Pagas en el centro, sin gastos de reserva.",
    h1: "Un masaje en Madrid, reservado por ti en inglés.",
    sub: "Dinos qué quieres y cuándo. Confirmamos tu hora con el centro. Pagas en el centro, sin gastos de reserva.",
    cta: "Reservar mi masaje",
    prices: [
      { name: "Relajante", detail: "60 min desde 45 €" },
      { name: "Descontracturante", detail: "60 min desde 60 €" },
      { name: "Tailandés", detail: "60 min desde 60 €" },
    ],
    priceNote: "Precios reales en centros del centro de Madrid.",
    otherCard: "Otro",
    otherPlaceholder: "Más tipos de masaje",
    notSure: "No sé cuál elegir",
    quizOffer: "Haz el test de 60 segundos y te sugerimos uno, o elige abajo.",
    quizCta: "Empezar el test de 60 segundos",
    howTitle: "Cómo funciona",
    how: [
      "Dinos qué quieres y cuándo.",
      "Confirmamos tu hora con el centro en español.",
      "Recibes tu confirmación por WhatsApp o email.",
    ],
    trust: "Más de 50 centros de Madrid con precios reales.",
    footerLead: "¿Prefieres escribirnos? Mándanos un WhatsApp",
    waQ1: "¿Qué masaje quieres?",
    waQ2: "¿En qué zona estás?",
    waAreaPlaceholder: "p. ej. Chamberí, Sol, Parla",
    waAreaUnsure: "No lo sé",
    waOpen: "Abrir WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
} as const;

export default function FbLanding() {
  const lang = useBookFlowLang();
  const t = COPY[lang];
  const location = useLocation();
  const bookingRef = useRef<HTMLDivElement>(null);
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    const params = new URLSearchParams(window.location.search);
    trackEvent("landing_fb", {
      meta: {
        source: params.get("utm_source"),
        medium: params.get("utm_medium"),
        campaign: params.get("utm_campaign"),
        content: params.get("utm_content"),
        term: params.get("utm_term"),
      },
    });
  }, []);

  const [preselect, setPreselect] = useState<{ value: string; nonce: number } | null>(null);
  const [showQuizOffer, setShowQuizOffer] = useState(false);

  const scrollToBooking = () =>
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pickMassage = (value: string) => {
    setShowQuizOffer(false);
    setPreselect({ value, nonce: Date.now() });
    trackEvent("fb_price_card_click", { meta: { massage: value, lang } });
    window.setTimeout(scrollToBooking, 50);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{t.seoTitle}</title>
        <meta name="description" content={t.seoDesc} />
        <link rel="canonical" href="https://book.massageclub.io/fb" />
      </Helmet>

      <header className="border-b border-border/60 bg-background/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link
            to={{ pathname: "/", search: location.search }}
            className="font-display text-lg tracking-tight text-foreground"
          >
            Massage Club
          </Link>
          <LanguageFlagToggle variant="compact" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-24">
        {/* 1. Hero */}
        <section className="pt-8">
          <h1 className="font-display text-3xl md:text-4xl leading-tight text-foreground">{t.h1}</h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground leading-snug">{t.sub}</p>
          <button
            type="button"
            onClick={scrollToBooking}
            className="mt-6 w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition"
          >
            {t.cta}
          </button>
        </section>

        {/* 2. Price anchors */}
        <section className="mt-10">
          <div className="grid gap-3 sm:grid-cols-2">
            {t.prices.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() =>
                  pickMassage(
                    (CARD_TO_MASSAGE[lang] as Record<string, string>)[p.name] ?? p.name
                  )
                }
                className="text-left rounded-2xl border border-border bg-card p-4 shadow-soft hover:border-primary/50 transition"
              >
                <p className="text-base font-semibold text-foreground">{p.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
              </button>
            ))}

            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <p className="text-base font-semibold text-foreground">{t.otherCard}</p>
              <select
                value=""
                onChange={(e) => { if (e.target.value) pickMassage(e.target.value); }}
                aria-label={t.otherPlaceholder}
                className="mt-2 w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">{t.otherPlaceholder}</option>
                {OTHER_TYPES[lang].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowQuizOffer(true);
              trackEvent("fb_not_sure_click", { meta: { lang } });
              window.setTimeout(scrollToBooking, 50);
            }}
            className="mt-3 w-full h-12 rounded-full border border-border bg-card text-base font-semibold text-foreground hover:border-primary/50 transition"
          >
            {t.notSure}
          </button>

          {showQuizOffer && (
            <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-4">
              <p className="text-sm text-foreground">{t.quizOffer}</p>
              <Link
                to="/app/discovery/quiz"
                className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                {t.quizCta}
              </Link>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">{t.priceNote}</p>
        </section>

        {/* 3. Booking wizard */}
        <section ref={bookingRef} className="mt-12 scroll-mt-20">
          <BookFlowWizard source="fb" lang={lang} showBrand={false} scrollTopOnStep={false} preselect={preselect} />
        </section>

        {/* 4. How it works */}
        <section className="mt-14">
          <h2 className="font-display text-2xl text-foreground">{t.howTitle}</h2>
          <ol className="mt-4 space-y-3">
            {t.how.map((line, i) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-secondary text-foreground text-sm font-bold inline-flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-base text-foreground leading-snug">{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">{t.trust}</p>
        </section>

        {/* 5. WhatsApp fallback: two quick questions, then open WhatsApp */}
        <footer className="mt-14 border-t border-border pt-8">
          <WhatsAppAskButton
            source="fb"
            lang={lang}
            label={t.footerLead}
            note={lang === "es" ? "Os he visto en Facebook." : "I saw you on Facebook."}
            className="text-center"
          />

          <p className="mt-6 text-xs text-muted-foreground text-center">{t.footer}</p>
        </footer>
      </main>
    </div>
  );
}
