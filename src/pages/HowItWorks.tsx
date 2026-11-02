import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";
import { MessageSquare, CalendarCheck, Banknote, ChevronRight } from "lucide-react";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";

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
        title: "You pick the time",
        body: "We ask the studios and send you their times. You tap Yes on the one you want.",
      },
      {
        title: "You pay at the studio",
        body: "Directly to them, same price as walking in. We charge nothing: no booking fee, no commission.",
      },
    ],
    book: "Book a massage",
    whatsapp: "Or message us on WhatsApp",
    faqTitle: "FAQ",
    faq: [
      { q: "Do I pay online?", a: "No. You pay the studio directly when you're there, cash or card." },
      { q: "What does it cost?", a: "The studio's normal price. Our service is free." },
      { q: "Do the studios speak English?", a: "We write to the studio in Spanish for you. Some therapists speak English and some don't, so we don't promise it." },
      { q: "Can I cancel?", a: "Yes, just message us. No charges, we only ask you tell us in time." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  es: {
    title: "Cómo funciona Massage Club",
    sub: "Masajes en Madrid, reservados por ti en tu idioma. Gratis.",
    steps: [
      {
        title: "Dinos qué quieres",
        body: "Qué masaje, cuándo más o menos, y en qué zona de Madrid. No necesitamos más.",
      },
      {
        title: "Tú eliges la hora",
        body: "Preguntamos a los centros y te mandamos sus horas. Tocas Sí en la que quieras.",
      },
      {
        title: "Pagas en el centro",
        body: "Directamente a ellos, al mismo precio que entrando por la puerta. No cobramos nada: sin comisión.",
      },
    ],
    book: "Reserva un masaje",
    whatsapp: "O escríbenos por WhatsApp",
    faqTitle: "Preguntas frecuentes",
    faq: [
      { q: "¿Pago online?", a: "No. Pagas en el centro, en efectivo o tarjeta." },
      { q: "¿Cuánto cuesta?", a: "El precio normal del centro. Nuestro servicio es gratis." },
      { q: "¿Hablan inglés los centros?", a: "Escribimos al centro por ti en español. Algunos masajistas hablan inglés y otros no, así que no lo prometemos." },
      { q: "¿Puedo cancelar?", a: "Sí, escríbenos. Sin cargos, solo pedimos que avises con tiempo." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  fr: {
    title: "Comment fonctionne Massage Club",
    sub: "Massages à Madrid, réservés pour vous dans votre langue. Gratuit.",
    steps: [
      {
        title: "Dites-nous ce que vous voulez",
        body: "Quel massage, à peu près quand, et dans quel quartier de Madrid. C'est tout ce qu'il nous faut.",
      },
      {
        title: "Vous choisissez l'horaire",
        body: "Nous demandons aux studios et vous envoyons leurs horaires. Vous touchez Oui sur celui qui vous convient.",
      },
      {
        title: "Vous payez sur place",
        body: "Directement au centre, au même prix qu'en passant par la porte. Nous ne prenons rien : pas de frais, pas de commission.",
      },
    ],
    book: "Réserver un massage",
    whatsapp: "Ou écrivez-nous sur WhatsApp",
    faqTitle: "FAQ",
    faq: [
      { q: "Je paie en ligne ?", a: "Non. Vous payez directement le centre sur place, en espèces ou par carte." },
      { q: "Combien ça coûte ?", a: "Le prix normal du centre. Notre service est gratuit." },
      { q: "Les centres parlent-ils français ?", a: "Nous écrivons au studio en espagnol pour vous. Certains masseurs parlent français et d'autres non, donc nous ne le promettons pas." },
      { q: "Puis-je annuler ?", a: "Oui, écrivez-nous simplement. Aucun frais, on demande juste de prévenir à temps." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  de: {
    title: "So funktioniert Massage Club",
    sub: "Massagen in Madrid, für dich in deiner Sprache gebucht. Kostenlos.",
    steps: [
      {
        title: "Sag uns, was du willst",
        body: "Welche Massage, ungefähr wann und in welcher Gegend von Madrid. Mehr brauchen wir nicht.",
      },
      {
        title: "Du wählst die Uhrzeit",
        body: "Wir fragen die Studios und schicken dir ihre Zeiten. Du tippst Ja bei der, die du willst.",
      },
      {
        title: "Du zahlst im Studio",
        body: "Direkt vor Ort, zum selben Preis wie beim Reingehen. Wir verlangen nichts: keine Gebühr, keine Provision.",
      },
    ],
    book: "Massage buchen",
    whatsapp: "Oder schreib uns auf WhatsApp",
    faqTitle: "Häufige Fragen",
    faq: [
      { q: "Zahle ich online?", a: "Nein. Du zahlst direkt im Studio, bar oder mit Karte." },
      { q: "Was kostet es?", a: "Den normalen Preis des Studios. Unser Service ist kostenlos." },
      { q: "Sprechen die Studios Deutsch?", a: "Wir schreiben dem Studio für dich auf Spanisch. Manche Masseure sprechen Deutsch und manche nicht, deshalb versprechen wir es nicht." },
      { q: "Kann ich stornieren?", a: "Ja, schreib uns einfach. Keine Kosten, wir bitten nur um rechtzeitige Info." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  it: {
    title: "Come funziona Massage Club",
    sub: "Massaggi a Madrid, prenotati per te nella tua lingua. Gratis.",
    steps: [
      {
        title: "Dicci cosa vuoi",
        body: "Che massaggio, più o meno quando e in quale zona di Madrid. Non ci serve altro.",
      },
      {
        title: "Scegli tu l'orario",
        body: "Chiediamo agli studi e ti mandiamo i loro orari. Tocchi Sì su quello che vuoi.",
      },
      {
        title: "Paghi al centro",
        body: "Direttamente a loro, allo stesso prezzo di chi entra dalla porta. Non ti facciamo pagare nulla: niente commissioni.",
      },
    ],
    book: "Prenota un massaggio",
    whatsapp: "O scrivici su WhatsApp",
    faqTitle: "Domande frequenti",
    faq: [
      { q: "Pago online?", a: "No. Paghi direttamente al centro, in contanti o con carta." },
      { q: "Quanto costa?", a: "Il prezzo normale del centro. Il nostro servizio è gratuito." },
      { q: "I centri parlano italiano?", a: "Scriviamo noi allo studio in spagnolo. Alcuni massaggiatori parlano italiano e altri no, quindi non lo promettiamo." },
      { q: "Posso cancellare?", a: "Sì, scrivici e basta. Nessun costo, ti chiediamo solo di avvisare in tempo." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  pt: {
    title: "Como funciona a Massage Club",
    sub: "Massagens em Madrid, reservadas para ti no teu idioma. Grátis.",
    steps: [
      {
        title: "Diz-nos o que queres",
        body: "Que massagem, mais ou menos quando e em que zona de Madrid. É só isso que precisamos.",
      },
      {
        title: "Tu escolhes o horário",
        body: "Perguntamos aos estúdios e enviamos-te os horários deles. Tocas em Sim no que quiseres.",
      },
      {
        title: "Pagas no estúdio",
        body: "Diretamente a eles, ao mesmo preço de quem entra na porta. Não cobramos nada: sem taxa, sem comissão.",
      },
    ],
    book: "Reservar uma massagem",
    whatsapp: "Ou manda-nos WhatsApp",
    faqTitle: "Perguntas frequentes",
    faq: [
      { q: "Pago online?", a: "Não. Pagas diretamente no estúdio, em dinheiro ou cartão." },
      { q: "Quanto custa?", a: "O preço normal do estúdio. O nosso serviço é grátis." },
      { q: "Os estúdios falam português?", a: "Escrevemos ao estúdio em espanhol por ti. Alguns massagistas falam português e outros não, por isso não o prometemos." },
      { q: "Posso cancelar?", a: "Sim, é só mandar mensagem. Sem custos, só pedimos que avises a tempo." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  zh: {
    title: "Massage Club 使用方法",
    sub: "在马德里的按摩，用您的语言为您预订。完全免费。",
    steps: [
      {
        title: "告诉我们您想要什么",
        body: "什么按摩、大概什么时间、马德里的哪个区域。我们只需要这些信息。",
      },
      {
        title: "由您选择时间",
        body: "我们询问各家工作室，并把他们的时间发给您。您在想要的时间上点击“是”即可。",
      },
      {
        title: "您在按摩中心付款",
        body: "直接付给他们，价格与到店一样。我们不收取任何费用：没有预订费，没有佣金。",
      },
    ],
    book: "预订按摩",
    whatsapp: "或在WhatsApp上给我们留言",
    faqTitle: "常见问题",
    faq: [
      { q: "我需要在线付款吗？", a: "不需要。您到店时直接付款给按摩中心，现金或刷卡均可。" },
      { q: "费用是多少？", a: "按摩中心的正常价格。我们的服务是免费的。" },
      { q: "按摩中心会说中文吗？", a: "我们用西班牙语替您联系工作室。有些按摩师会说中文，有些不会，所以我们不作保证。" },
      { q: "我可以取消吗？", a: "可以，给我们留言即可。没有任何费用，我们只要求您提前告知。" },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
} as const;

type PageLang = FlowLang;

const ICONS = [MessageSquare, CalendarCheck, Banknote];

export default function HowItWorks() {
  const lang: PageLang = useFlowLang();
  const t = COPY[lang] ?? COPY.en;

  useEffect(() => {
    document.documentElement.lang = lang;
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
              {t.faqTitle}
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
          <p className="text-xs text-muted-foreground">
            {t.footer}
          </p>
        </footer>
      </div>
    </>
  );
}
