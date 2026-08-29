import { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { DealsFooterLine } from "@/components/DealsLink";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import AccountHeaderLink from "@/components/AccountHeaderLink";
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
    howTitle: "How it works",
    how: [
      "Tell us what you want and when.",
      "We confirm your time with the studio in Spanish.",
      "You get your confirmation on WhatsApp or email.",
    ],
    trust: "50+ Madrid studios listed with real prices.",
    footerLead: "Prefer to chat? Message us on WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "I saw you on Google.",
    sawFb: "I saw you on Facebook.",
    sawSite: "I saw you on Massage Club.",
  },
  es: {
    seoTitle: "Reserva un masaje en Madrid, en inglés | Massage Club",
    seoDesc:
      "Dinos qué masaje quieres y cuándo. Confirmamos tu hora con el centro. Pagas en el centro, sin gastos de reserva.",
    h1: "Un masaje en Madrid, reservado por ti en inglés.",
    sub: "Dinos qué quieres y cuándo. Confirmamos tu hora con el centro. Pagas en el centro, sin gastos de reserva.",
    cta: "Reservar mi masaje",
    howTitle: "Cómo funciona",
    how: [
      "Dinos qué quieres y cuándo.",
      "Confirmamos tu hora con el centro en español.",
      "Recibes tu confirmación por WhatsApp o email.",
    ],
    trust: "Más de 50 centros de Madrid con precios reales.",
    footerLead: "¿Prefieres escribirnos? Mándanos un WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "Os he visto en Google.",
    sawFb: "Os he visto en Facebook.",
    sawSite: "Os he visto en Massage Club.",
  },
  fr: {
    seoTitle: "Réservez un massage à Madrid, en français | Massage Club",
    seoDesc:
      "Dites-nous quel massage vous voulez et quand. Nous confirmons votre créneau avec le centre. Vous payez sur place, sans frais de réservation.",
    h1: "Un massage à Madrid, réservé pour vous en français.",
    sub: "Dites-nous ce que vous voulez et quand. Nous confirmons votre créneau avec le centre. Vous payez sur place, sans frais de réservation.",
    cta: "Réserver mon massage",
    howTitle: "Comment ça marche",
    how: [
      "Dites-nous ce que vous voulez et quand.",
      "Nous confirmons votre créneau avec le centre en espagnol.",
      "Vous recevez votre confirmation sur WhatsApp ou par e-mail.",
    ],
    trust: "Plus de 50 centres à Madrid avec de vrais prix.",
    footerLead: "Vous préférez discuter ? Écrivez-nous sur WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "Je vous ai vus sur Google.",
    sawFb: "Je vous ai vus sur Facebook.",
    sawSite: "Je vous ai vus sur Massage Club.",
  },
  de: {
    seoTitle: "Massage in Madrid buchen, auf Deutsch | Massage Club",
    seoDesc:
      "Sag uns, welche Massage du möchtest und wann. Wir bestätigen deinen Termin mit dem Studio. Du zahlst im Studio, keine Buchungsgebühr.",
    h1: "Eine Massage in Madrid, für dich auf Deutsch gebucht.",
    sub: "Sag uns, was du möchtest und wann. Wir bestätigen deinen Termin mit dem Studio. Du zahlst im Studio, keine Buchungsgebühr.",
    cta: "Meine Massage buchen",
    howTitle: "So funktioniert's",
    how: [
      "Sag uns, was du möchtest und wann.",
      "Wir bestätigen deinen Termin mit dem Studio auf Spanisch.",
      "Du bekommst deine Bestätigung per WhatsApp oder E-Mail.",
    ],
    trust: "Über 50 Studios in Madrid mit echten Preisen.",
    footerLead: "Lieber chatten? Schreib uns auf WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "Ich habe euch bei Google gesehen.",
    sawFb: "Ich habe euch bei Facebook gesehen.",
    sawSite: "Ich habe euch bei Massage Club gesehen.",
  },
  it: {
    seoTitle: "Prenota un massaggio a Madrid, in italiano | Massage Club",
    seoDesc:
      "Dicci che massaggio vuoi e quando. Confermiamo l'orario con il centro. Paghi sul posto, senza costi di prenotazione.",
    h1: "Un massaggio a Madrid, prenotato per te in italiano.",
    sub: "Dicci cosa vuoi e quando. Confermiamo l'orario con il centro. Paghi sul posto, senza costi di prenotazione.",
    cta: "Prenota il mio massaggio",
    howTitle: "Come funziona",
    how: [
      "Dicci cosa vuoi e quando.",
      "Confermiamo il tuo orario con il centro in spagnolo.",
      "Ricevi la conferma su WhatsApp o email.",
    ],
    trust: "Oltre 50 centri a Madrid con prezzi reali.",
    footerLead: "Preferisci chattare? Scrivici su WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "Vi ho visti su Google.",
    sawFb: "Vi ho visti su Facebook.",
    sawSite: "Vi ho visti su Massage Club.",
  },
  pt: {
    seoTitle: "Reserve uma massagem em Madrid, em português | Massage Club",
    seoDesc:
      "Diz-nos que massagem queres e quando. Confirmamos o teu horário com o estúdio. Pagas no estúdio, sem taxa de reserva.",
    h1: "Uma massagem em Madrid, reservada para ti em português.",
    sub: "Diz-nos o que queres e quando. Confirmamos o teu horário com o estúdio. Pagas no estúdio, sem taxa de reserva.",
    cta: "Reservar a minha massagem",
    howTitle: "Como funciona",
    how: [
      "Diz-nos o que queres e quando.",
      "Confirmamos o teu horário com o estúdio em espanhol.",
      "Recebes a confirmação no WhatsApp ou email.",
    ],
    trust: "Mais de 50 estúdios em Madrid com preços reais.",
    footerLead: "Prefere conversar? Manda-nos WhatsApp",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "Vi-vos no Google.",
    sawFb: "Vi-vos no Facebook.",
    sawSite: "Vi-vos no Massage Club.",
  },
  zh: {
    seoTitle: "在马德里预订按摩，中文服务 | Massage Club",
    seoDesc: "告诉我们您想要什么按摩以及时间。我们会与按摩中心确认您的时间。您到店付款，没有预订费。",
    h1: "在马德里的按摩，用中文为您预订。",
    sub: "告诉我们您想要什么以及什么时间。我们会与按摩中心确认您的时间。您到店付款，没有预订费。",
    cta: "预订我的按摩",
    howTitle: "使用方法",
    how: [
      "告诉我们您想要什么以及时间。",
      "我们用西班牙语与按摩中心确认您的时间。",
      "您会通过WhatsApp或邮件收到确认信息。",
    ],
    trust: "已收录马德里50多家按摩中心，价格真实。",
    footerLead: "更想聊聊？在WhatsApp上给我们留言",
    footer: "Massage Club · Madrid · book.massageclub.io",
    sawGoogle: "我在谷歌上看到你们的。",
    sawFb: "我在Facebook上看到你们的。",
    sawSite: "我在Massage Club上看到你们的。",
  },
} as const;

export default function FbLanding() {
  const lang = useBookFlowLang();
  const t = COPY[lang] ?? COPY.en;
  const location = useLocation();
  const bookingRef = useRef<HTMLDivElement>(null);
  const logged = useRef(false);

  const params = new URLSearchParams(location.search);
  const srcParam = params.get("src");
  const source = srcParam || "direct";

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    trackEvent("landing_start", {
      meta: {
        src: srcParam,
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
        <link rel="canonical" href="https://book.massageclub.io/start" />
      </Helmet>

      <header className="border-b border-border/60 bg-background/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link
            to={{ pathname: "/", search: location.search }}
            className="font-display text-lg tracking-tight text-foreground"
          >
            Massage Club
          </Link>
          <div className="flex items-center gap-3">
            <AccountHeaderLink />
            <LanguageFlagToggle variant="compact" />
          </div>
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

        {/* 2. Booking wizard */}
        <section ref={bookingRef} className="mt-12 scroll-mt-20">
          <BookFlowWizard source={source} lang={lang} showBrand={false} scrollTopOnStep={false} />
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
            source={source}
            lang={lang}
            label={t.footerLead}
            note={
              srcParam === "google"
                ? t.sawGoogle
                : srcParam === "fb"
                  ? t.sawFb
                  : t.sawSite
            }
            className="text-center"
          />
          <DealsFooterLine className="mt-6 text-center" />

          <p className="mt-6 text-xs text-muted-foreground text-center">{t.footer}</p>
        </footer>
      </main>
    </div>
  );
}
