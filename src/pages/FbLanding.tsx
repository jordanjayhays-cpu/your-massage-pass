import { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import BookFlowWizard, { useBookFlowLang } from "@/components/BookFlowWizard";
import { trackEvent } from "@/lib/siteVisit";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";

const COPY = {
  en: {
    seoTitle: "Book a massage in Madrid, in English | Massage Club",
    seoDesc:
      "Tell us what massage you want and when. We confirm your time with the studio. You pay at the studio, no booking fee.",
    h1: "A massage in Madrid, booked for you in English.",
    sub: "Tell us what you want and when. We confirm your time with the studio. You pay at the studio, no booking fee.",
    cta: "Book my massage",
    priceLine:
      "Real prices: relaxing 60 min from €45, deep tissue from €60, Thai from €60. You pay at the studio.",
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
    priceLine:
      "Precios reales: relajante 60 min desde 45 €, descontracturante desde 60 €, tailandés desde 60 €. Pagas en el centro.",
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
          <p className="mt-3 text-sm text-muted-foreground text-center">{t.priceLine}</p>
        </section>

        {/* 2. Booking wizard */}
        <section ref={bookingRef} className="mt-12 scroll-mt-20">
          <BookFlowWizard source="fb" lang={lang} showBrand={false} scrollTopOnStep={false} />
        </section>

        {/* 3. How it works */}
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

        {/* 4. WhatsApp fallback */}
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
