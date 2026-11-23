import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import WhatsAppAskButton from "@/components/WhatsAppAskButton";
import { MessageSquare, Send, Store, CircleCheck, ChevronRight } from "lucide-react";
import HowItWorksVideo from "@/components/HowItWorksVideo";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";

const COPY = {
  en: {
    title: "How Massage Club works",
    sub: "Massages in Madrid. You tell us once, we ask the studios for you and bring you the best offer. Free for you.",
    steps: [
      { title: "Tell us what you want", body: "Your massage, the day, the time and the area. One request, in English." },
      { title: "We ask several studios for you", body: "We write to studios near you in Spanish, so you don't have to." },
      { title: "The studios send their offers", body: "Each one with space answers with a time and its price." },
      { title: "You get the best offer", body: "We send you the best one. Nothing is booked until you tap Yes, and you pay at the studio." },
    ],
    book: "Book a massage",
    whatsapp: "Or message us on WhatsApp",
    faqTitle: "FAQ",
    faq: [
      { q: "Do I pay online?", a: "No. You pay the studio directly when you're there." },
      { q: "What does it cost?", a: "The studio's own price, which you see in the offer before you say yes. Our service is free for you." },
      { q: "Do the studios speak English?", a: "We write to the studio in Spanish for you. Some therapists speak English and some don't, so we don't promise it." },
      { q: "Can I cancel?", a: "Yes, just message us and we tell the studio. Please let us know as early as you can." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  es: {
    title: "Cómo funciona Massage Club",
    sub: "Masajes en Madrid. Nos lo cuentas una vez, preguntamos a los centros por ti y te traemos la mejor oferta. Gratis para ti.",
    steps: [
      { title: "Dinos qué quieres", body: "Tu masaje, el día, la hora y la zona. Una sola petición." },
      { title: "Preguntamos a varios centros por ti", body: "Escribimos a centros cerca de ti, para que no tengas que hacerlo tú." },
      { title: "Los centros mandan sus ofertas", body: "Cada uno con hueco responde con una hora y su precio." },
      { title: "Te llega la mejor oferta", body: "Te mandamos la mejor. No se reserva nada hasta que tocas Sí, y pagas en el centro." },
    ],
    book: "Reserva un masaje",
    whatsapp: "O escríbenos por WhatsApp",
    faqTitle: "Preguntas frecuentes",
    faq: [
      { q: "¿Pago online?", a: "No. Pagas directamente en el centro cuando vas." },
      { q: "¿Cuánto cuesta?", a: "El precio del propio centro, que ves en la oferta antes de decir que sí. Nuestro servicio es gratis para ti." },
      { q: "¿Hablan inglés los centros?", a: "Escribimos al centro por ti en español. Algunos masajistas hablan inglés y otros no, así que no lo prometemos." },
      { q: "¿Puedo cancelar?", a: "Sí, escríbenos y se lo decimos al centro. Avísanos con el mayor tiempo posible." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  fr: {
    title: "Comment fonctionne Massage Club",
    sub: "Massages à Madrid. Vous nous le dites une fois, nous demandons aux centres pour vous et vous apportons la meilleure offre. Gratuit pour vous.",
    steps: [
      { title: "Dites-nous ce que vous voulez", body: "Votre massage, le jour, l'heure et le quartier. Une seule demande." },
      { title: "Nous demandons à plusieurs centres", body: "Nous écrivons en espagnol aux centres près de chez vous, pour que vous n'ayez pas à le faire." },
      { title: "Les centres envoient leurs offres", body: "Chacun qui a de la place répond avec un horaire et son prix." },
      { title: "Vous recevez la meilleure offre", body: "Nous vous envoyons la meilleure. Rien n'est réservé tant que vous ne touchez pas Oui, et vous payez au centre." },
    ],
    book: "Réserver un massage",
    whatsapp: "Ou écrivez-nous sur WhatsApp",
    faqTitle: "FAQ",
    faq: [
      { q: "Je paie en ligne ?", a: "Non. Vous payez directement le centre sur place." },
      { q: "Combien ça coûte ?", a: "Le prix du centre, que vous voyez dans l'offre avant de dire oui. Notre service est gratuit pour vous." },
      { q: "Les centres parlent-ils français ?", a: "Nous écrivons au studio en espagnol pour vous. Certains masseurs parlent français et d'autres non, donc nous ne le promettons pas." },
      { q: "Puis-je annuler ?", a: "Oui, écrivez-nous et nous prévenons le centre. Dites-le-nous le plus tôt possible." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  de: {
    title: "So funktioniert Massage Club",
    sub: "Massagen in Madrid. Du sagst es uns einmal, wir fragen die Studios für dich und bringen dir das beste Angebot. Für dich kostenlos.",
    steps: [
      { title: "Sag uns, was du willst", body: "Deine Massage, der Tag, die Uhrzeit und die Gegend. Eine einzige Anfrage." },
      { title: "Wir fragen mehrere Studios für dich", body: "Wir schreiben Studios in deiner Nähe auf Spanisch, damit du es nicht musst." },
      { title: "Die Studios schicken ihre Angebote", body: "Jedes mit freiem Platz antwortet mit einer Uhrzeit und seinem Preis." },
      { title: "Du bekommst das beste Angebot", body: "Wir schicken dir das beste. Gebucht ist erst, wenn du Ja tippst, und du zahlst im Studio." },
    ],
    book: "Massage buchen",
    whatsapp: "Oder schreib uns auf WhatsApp",
    faqTitle: "Häufige Fragen",
    faq: [
      { q: "Zahle ich online?", a: "Nein. Du zahlst direkt im Studio, wenn du dort bist." },
      { q: "Was kostet es?", a: "Den Preis des Studios, den du im Angebot siehst, bevor du Ja sagst. Unser Service ist für dich kostenlos." },
      { q: "Sprechen die Studios Deutsch?", a: "Wir schreiben dem Studio für dich auf Spanisch. Manche Masseure sprechen Deutsch und manche nicht, deshalb versprechen wir es nicht." },
      { q: "Kann ich stornieren?", a: "Ja, schreib uns und wir sagen es dem Studio. Gib uns bitte so früh wie möglich Bescheid." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  it: {
    title: "Come funziona Massage Club",
    sub: "Massaggi a Madrid. Ce lo dici una volta, chiediamo noi ai centri e ti portiamo l'offerta migliore. Gratis per te.",
    steps: [
      { title: "Dicci cosa vuoi", body: "Il tuo massaggio, il giorno, l'ora e la zona. Una sola richiesta." },
      { title: "Chiediamo a più centri per te", body: "Scriviamo in spagnolo ai centri vicino a te, così non devi farlo tu." },
      { title: "I centri mandano le loro offerte", body: "Ognuno che ha posto risponde con un orario e il suo prezzo." },
      { title: "Ricevi l'offerta migliore", body: "Ti mandiamo la migliore. Non è prenotato nulla finché non tocchi Sì, e paghi al centro." },
    ],
    book: "Prenota un massaggio",
    whatsapp: "O scrivici su WhatsApp",
    faqTitle: "Domande frequenti",
    faq: [
      { q: "Pago online?", a: "No. Paghi direttamente al centro quando ci vai." },
      { q: "Quanto costa?", a: "Il prezzo del centro, che vedi nell'offerta prima di dire sì. Il nostro servizio è gratis per te." },
      { q: "I centri parlano italiano?", a: "Scriviamo noi allo studio in spagnolo. Alcuni massaggiatori parlano italiano e altri no, quindi non lo promettiamo." },
      { q: "Posso cancellare?", a: "Sì, scrivici e lo diciamo al centro. Avvisaci il prima possibile." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  pt: {
    title: "Como funciona a Massage Club",
    sub: "Massagens em Madrid. Dizes-nos uma vez, perguntamos aos estúdios por ti e trazemos-te a melhor oferta. Grátis para ti.",
    steps: [
      { title: "Diz-nos o que queres", body: "A tua massagem, o dia, a hora e a zona. Um só pedido." },
      { title: "Perguntamos a vários estúdios por ti", body: "Escrevemos em espanhol aos estúdios perto de ti, para não teres de o fazer." },
      { title: "Os estúdios enviam as suas ofertas", body: "Cada um com vaga responde com um horário e o seu preço." },
      { title: "Recebes a melhor oferta", body: "Enviamos-te a melhor. Nada fica reservado até tocares em Sim, e pagas no estúdio." },
    ],
    book: "Reservar uma massagem",
    whatsapp: "Ou manda-nos WhatsApp",
    faqTitle: "Perguntas frequentes",
    faq: [
      { q: "Pago online?", a: "Não. Pagas diretamente no estúdio quando lá estás." },
      { q: "Quanto custa?", a: "O preço do próprio estúdio, que vês na oferta antes de dizeres que sim. O nosso serviço é grátis para ti." },
      { q: "Os estúdios falam português?", a: "Escrevemos ao estúdio em espanhol por ti. Alguns massagistas falam português e outros não, por isso não o prometemos." },
      { q: "Posso cancelar?", a: "Sim, manda-nos mensagem e avisamos o estúdio. Avisa-nos o mais cedo possível." },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
  zh: {
    title: "Massage Club 使用方法",
    sub: "马德里的按摩。您只需告诉我们一次，我们替您询问按摩店，并为您带来最好的报价。对您免费。",
    steps: [
      { title: "告诉我们您想要什么", body: "按摩类型、日期、时间和区域。只需一个请求。" },
      { title: "我们替您询问多家按摩店", body: "我们用西班牙语联系您附近的按摩店，您不必亲自去问。" },
      { title: "按摩店发来报价", body: "有空位的按摩店会回复时间和价格。" },
      { title: "您收到最好的报价", body: "我们把最好的报价发给您。在您点击“是”之前不会预订任何东西，您在按摩店付款。" },
    ],
    book: "预订按摩",
    whatsapp: "或在WhatsApp上给我们留言",
    faqTitle: "常见问题",
    faq: [
      { q: "我需要在线付款吗？", a: "不需要。您到店时直接付款给按摩店。" },
      { q: "费用是多少？", a: "按摩店自己的价格，您在说“是”之前就能在报价中看到。我们的服务对您免费。" },
      { q: "按摩中心会说中文吗？", a: "我们用西班牙语替您联系工作室。有些按摩师会说中文，有些不会，所以我们不作保证。" },
      { q: "我可以取消吗？", a: "可以，给我们留言，我们会通知按摩店。请尽早告诉我们。" },
    ],
    footer: "Massage Club · Madrid · book.massageclub.io",
  },
} as const;

type PageLang = FlowLang;

const ICONS = [MessageSquare, Send, Store, CircleCheck];

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
        <header className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-b border-border bg-background sticky top-0 z-10 desk:hidden">
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

          {/* The 22 s film (23 Nov): the same four steps, shown. */}
          <HowItWorksVideo lang={lang} where="how-it-works" className="mb-10 md:mb-12" />

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
        <footer className="py-6 text-center border-t border-border desk:hidden">
          <p className="text-xs text-muted-foreground">
            {t.footer}
          </p>
        </footer>
      </div>
    </>
  );
}
