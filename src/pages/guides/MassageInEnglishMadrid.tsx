import LiteYouTube from "@/components/LiteYouTube";
import GuideLayout, { CalmaCard, GuideLinks } from "./GuideLayout";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do Madrid massage studios speak English?",
    a: "Some do, many don't — and even where a therapist speaks English, the booking itself usually happens by phone or WhatsApp in Spanish. Massage Club exists to remove that step: you browse and book in English online, and the studio receives your request already translated into the details they need.",
  },
  {
    q: "Do I pay online?",
    a: "No. There is no prepayment and no card required. You book your slot through Massage Club and pay the studio directly when you arrive, by card or cash depending on the studio.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Every confirmation email contains a one-click cancel link, so you can release the slot in a second without phoning anyone or writing in Spanish.",
  },
  {
    q: "What does a massage cost in Madrid?",
    a: "A 60-minute massage in Madrid typically costs between €45 and €90 depending on the type of treatment, the neighbourhood and the studio. Relaxing massages sit at the lower end, deep tissue and specialised work at the higher end.",
  },
  {
    q: "Do I need to speak Spanish?",
    a: "No. The booking flow is available in English and seven other languages, and your preferences — pressure level, focus areas, health notes — are sent to the studio in a structured form so nothing is lost in translation.",
  },
];

export default function MassageInEnglishMadrid() {
  const title = "Massage in Madrid, booked in English | Massage Club";
  const description =
    "Book a massage in Madrid in English — browse real menus and prices, book online in 8 languages, pay at the studio. No prepayment, one-click cancellation.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <GuideLayout
      path="/massage-in-english-madrid"
      title={title}
      description={description}
      jsonLd={jsonLd}
    >
      <article className="prose-none">
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">Guide · Madrid</p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          Massage in Madrid, booked in English
        </h1>
        <p className="text-base text-foreground/85 mt-4 leading-relaxed">
          Madrid is full of good massage studios. Getting into one, if you don't speak Spanish, is
          the hard part. This guide explains why that happens and how to book a massage here in
          English without phone calls, WhatsApp threads or guesswork.
        </p>

        <LiteYouTube id="cYTLBYTVAwY" title="Massage in Madrid" className="mt-6" />

        <h2 className="font-display text-2xl text-foreground mt-8">The problem: bookings happen by phone, in Spanish</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Most independent massage studios in Madrid are small businesses — one or two therapists, a
          couple of treatment rooms, no receptionist. Their booking channel is a mobile phone. You
          call, or you send a WhatsApp, and someone replies between clients, in Spanish. Their
          Google listing often has no menu, so you don't know what a treatment costs until you ask.
          Their website, if there is one, may be a single page from years ago.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          For a resident who speaks Spanish, that's mildly inconvenient. For someone new to the city,
          or here for a week, it's usually enough friction to give up and book an overpriced hotel
          spa instead. The studios lose the customer; the customer gets a worse massage for more
          money.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">How Massage Club fixes it</h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground/85">
          <li>
            <strong className="text-foreground">Browse in English.</strong> Real menus with real
            prices and durations — what each treatment is, how long it lasts, what it costs, before
            you commit to anything.
          </li>
          <li>
            <strong className="text-foreground">Book online in 8 languages.</strong> Pick a day and
            time, choose your pressure (light, medium, firm or deep) and the areas you want worked
            on, and add any health notes. All of it in your own language.
          </li>
          <li>
            <strong className="text-foreground">One-tap studio confirmation.</strong> The studio gets
            your request with every detail already structured, and confirms with a single tap. You
            get an email the moment they do.
          </li>
          <li>
            <strong className="text-foreground">Pay at the studio.</strong> No prepayment, no card
            stored, no booking fee for you. You settle directly with the therapist afterwards.
          </li>
          <li>
            <strong className="text-foreground">Cancel in one click.</strong> The confirmation email
            carries a cancel link. No phone call needed.
          </li>
        </ul>

        <h2 className="font-display text-2xl text-foreground mt-8">Where you can book right now</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          We're being honest about scale: Massage Club is new, and Calma Madrid in Chamberí is
          currently our one live, bookable studio. More Madrid studios are joining, and we'd rather
          list one studio you can actually book than fifty you can't.
        </p>

        <CalmaCard />

        <h2 className="font-display text-2xl text-foreground mt-8">What to expect at a Madrid studio</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Arrive five minutes early. Treatments are quoted by table time, so a 60-minute massage is
          roughly 60 minutes of hands-on work plus a short consultation. Tipping is not expected in
          Spain — the listed price is the price. If you have an injury, are pregnant, or take
          medication that affects circulation, say so in the health notes field when you book; the
          studio reads them before you arrive and adapts the session.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          On price: a 60-minute treatment in Madrid generally lands between €45 and €90. Our{" "}
          <a className="text-primary underline underline-offset-2" href="/guides/massage-prices-madrid">
            Madrid massage price guide
          </a>{" "}
          breaks that down by treatment type, and the{" "}
          <a className="text-primary underline underline-offset-2" href="/guides/deep-tissue-massage-madrid">
            deep tissue guide
          </a>{" "}
          covers what to ask for if you carry tension in your back, neck or shoulders.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Frequently asked questions</h2>
        <div className="mt-3 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-2xl border border-border/60 bg-card p-4">
              <h3 className="font-display text-lg text-foreground">{f.q}</h3>
              <p className="text-sm text-foreground/85 mt-1.5 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <GuideLinks exclude="/massage-in-english-madrid" />
      </article>
    </GuideLayout>
  );
}
