import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import BookFlowWizard, { useBookFlowLang } from "@/components/BookFlowWizard";
import { trackEvent } from "@/lib/siteVisit";
import { MessageCircle } from "lucide-react";

const WA_BASE = "https://wa.me/34612474827?text=";

// Massage chip options per language. `kind` drives the message template.
const MASSAGE_CHIPS = {
  en: [
    { kind: "relaxing", label: "Relaxing" },
    { kind: "deep", label: "Deep tissue" },
    { kind: "thai", label: "Thai" },
    { kind: "sports", label: "Sports" },
    { kind: "unsure", label: "Not sure" },
  ],
  es: [
    { kind: "relaxing", label: "Relajante" },
    { kind: "deep", label: "Descontracturante" },
    { kind: "thai", label: "Tailandés" },
    { kind: "sports", label: "Deportivo" },
    { kind: "unsure", label: "No lo sé" },
  ],
} as const;

const TYPE_WORDS: Record<string, { en: string; es: string }> = {
  relaxing: { en: "a relaxing massage", es: "un masaje relajante" },
  deep: { en: "a deep tissue massage", es: "un masaje descontracturante" },
  thai: { en: "a thai massage", es: "un masaje tailandés" },
  sports: { en: "a sports massage", es: "un masaje deportivo" },
};

function buildWaText(lang: "en" | "es", kind: string, area: string): string {
  const cleanArea = area.trim();
  if (kind === "unsure") {
    return lang === "es"
      ? "Hola, quiero reservar un masaje pero no sé qué tipo. Os he visto en Facebook."
      : "Hi, I'd like to book a massage but I'm not sure which type. I saw you on Facebook.";
  }
  const typeWord = TYPE_WORDS[kind]?.[lang] ?? TYPE_WORDS.relaxing[lang];
  if (cleanArea) {
    return lang === "es"
      ? `Hola, quiero reservar ${typeWord} en ${cleanArea}. Os he visto en Facebook.`
      : `Hi, I'd like to book ${typeWord} in ${cleanArea}. I saw you on Facebook.`;
  }
  return lang === "es"
    ? `Hola, quiero reservar ${typeWord}. Os he visto en Facebook.`
    : `Hi, I'd like to book ${typeWord}. I saw you on Facebook.`;
}

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
    howTitle: "How it works",
    how: [
      "Tell us what you want and when.",
      "We confirm your time with the studio in Spanish.",
      "You get your confirmation on WhatsApp or email.",
    ],
    trust: "50+ Madrid studios listed with real prices.",
    footerLead: "Prefer to chat? Message us on WhatsApp",
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
    howTitle: "Cómo funciona",
    how: [
      "Dinos qué quieres y cuándo.",
      "Confirmamos tu hora con el centro en español.",
      "Recibes tu confirmación por WhatsApp o email.",
    ],
    trust: "Más de 50 centros de Madrid con precios reales.",
    footerLead: "¿Prefieres escribirnos? Mándanos un WhatsApp",
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

  const scrollToBooking = () =>
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
          <div className="grid gap-3 sm:grid-cols-3">
            {t.prices.map((p) => (
              <div key={p.name} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <p className="text-base font-semibold text-foreground">{p.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t.priceNote}</p>
        </section>

        {/* 3. Booking wizard */}
        <section ref={bookingRef} className="mt-12 scroll-mt-20">
          <BookFlowWizard source="fb" lang={lang} showBrand={false} scrollTopOnStep={false} />
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

        {/* 5. WhatsApp fallback */}
        <footer className="mt-14 border-t border-border pt-8 text-center">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-13 px-6 py-3 rounded-full border border-border bg-card text-base font-semibold text-foreground hover:border-primary/50 transition"
          >
            <MessageCircle className="h-5 w-5 text-primary" />
            {t.footerLead}
          </a>
          <p className="mt-6 text-xs text-muted-foreground">{t.footer}</p>
        </footer>
      </main>
    </div>
  );
}
