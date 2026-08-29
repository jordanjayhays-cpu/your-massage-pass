import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { DealsFooterLine } from "@/components/DealsLink";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";
import { MessageSquare, CalendarCheck, Banknote, ChevronRight } from "lucide-react";


const COPY = {
  en: {
    title: "How Massage Club works",
    sub: "Massages in Madrid, booked for you in English. Free to use.",
    steps: [
      {
        title: "Tell us what you want",
        body: "What massage, roughly when, and where in Madrid. That's all we need.",
      },
      {
        title: "We confirm your time",
        body: "We arrange it with the studio and confirm your slot, usually within the hour.",
      },
      {
        title: "You pay at the studio",
        body: "Directly to them, same price as walking in. We charge nothing — no booking fee, no commission.",
      },
    ],
    book: "Book a massage",
    whatsapp: "Or message us on WhatsApp",
    faq: [
      { q: "Do I pay online?", a: "No. You pay the studio directly when you're there, cash or card." },
      { q: "What does it cost?", a: "The studio's normal price. Our service is free." },
      { q: "Do the studios speak English?", a: "The booking is in English. Some studios speak English, some don't — we tell you before you book." },
      { q: "Can I cancel?", a: "Yes, just message us. No charges, we only ask you tell us in time." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  es: {
    title: "Cómo funciona Massage Club",
    sub: "Masajes en Madrid, reservados por ti en inglés o español. Gratis.",
    steps: [
      {
        title: "Dinos qué quieres",
        body: "Qué masaje, cuándo más o menos, y en qué zona de Madrid. No necesitamos más.",
      },
      {
        title: "Confirmamos tu hora",
        body: "Lo organizamos con el centro y te confirmamos, normalmente en menos de una hora.",
      },
      {
        title: "Pagas en el centro",
        body: "Directamente a ellos, al mismo precio que entrando por la puerta. No cobramos nada — sin comisión.",
      },
    ],
    book: "Reserva un masaje",
    whatsapp: "O escríbenos por WhatsApp",
    faq: [
      { q: "¿Pago online?", a: "No. Pagas en el centro, en efectivo o tarjeta." },
      { q: "¿Cuánto cuesta?", a: "El precio normal del centro. Nuestro servicio es gratis." },
      { q: "¿Hablan inglés los centros?", a: "La reserva la hacemos nosotros en el idioma que necesites. Algunos centros hablan inglés y otros no — te lo decimos antes de reservar." },
      { q: "¿Puedo cancelar?", a: "Sí, escríbenos. Sin cargos, solo pedimos que avises con tiempo." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
} as const;

type PageLang = keyof typeof COPY;

const ICONS = [MessageSquare, CalendarCheck, Banknote];

export default function HowItWorks() {
  const { i18n } = useTranslation();
  const resolved = (i18n.resolvedLanguage || "en").slice(0, 2);
  const lang: PageLang = resolved === "es" ? "es" : "en";
  const t = COPY[lang] ?? COPY.en;

  // Restore persisted page language (default English) and keep <html lang> + mc_lang in sync.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mc_lang");
      if ((saved === "en" || saved === "es") && saved !== resolved) {
        i18n.changeLanguage(saved);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("mc_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  return (
    <>
      <Helmet>
        <title>{t.title} · Massage Club</title>
        <meta name="description" content={t.sub} />
        <link rel="canonical" href="https://book.massageclub.io/how-it-works" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-b border-border bg-background sticky top-0 z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt="Massage Club"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-semibold text-foreground" style={{ letterSpacing: 0.2 }}>
              Massage Club
            </span>
          </Link>
          <LanguageFlagToggle />
        </header>

        <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8 md:py-12">
          {/* Intro */}
          <div className="text-center mb-10 md:mb-12">
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-3">
              {t.title}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
              {t.sub}
            </p>
          </div>

          {/* Steps */}
          <ol className="space-y-6 md:space-y-7 mb-10 md:mb-12">
            {t.steps.map((step, idx) => {
              const Icon = ICONS[idx];
              return (
                <li
                  key={idx}
                  className="flex items-start gap-4 p-4 md:p-5 rounded-2xl bg-white border border-border/60 shadow-soft"
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#211C1A] text-[#F7F4F0] text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      <h2 className="font-display text-lg md:text-xl font-semibold text-foreground">
                        {step.title}
                      </h2>
                    </div>
                    <p className="text-[15px] text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* CTAs */}
          <div className="space-y-3 mb-12 md:mb-14">
            <Button
              asChild
              className="w-full h-13 text-base md:text-lg rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              <Link to="/book">
                {t.book}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <WhatsAppAskButton source="how-it-works" lang={lang} label={t.whatsapp} />
          </div>

          {/* FAQ */}
          <section className="mb-10 md:mb-12">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              FAQ
            </h2>
            <div className="space-y-4">
              {t.faq.map((item, idx) => (
                <div key={idx} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                  <h3 className="text-[15px] font-semibold text-foreground mb-1">
                    {item.q}
                  </h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center border-t border-border">
          <DealsFooterLine className="mb-2" />
          <p className="text-xs text-muted-foreground">
            {t.footer}
          </p>
        </footer>
      </div>
    </>
  );
}
