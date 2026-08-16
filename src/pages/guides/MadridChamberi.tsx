import GuideLayout, { CalmaCard, GuideLinks } from "./GuideLayout";

export default function MadridChamberi() {
  const title = "Massage in Chamberí, Madrid — book in English | Massage Club";
  const description =
    "Massage in Chamberí, Madrid: a quiet, well-connected barrio near metro Ríos Rosas, Iglesia and Canal. Book Calma Madrid online in English and pay at the studio.";

  return (
    <GuideLayout path="/madrid/chamberi" title={title} description={description}>
      <article>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">Guide · Neighbourhood</p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          Massage in Chamberí, Madrid
        </h1>
        <p className="text-base text-foreground/85 mt-4 leading-relaxed">
          Chamberí sits just north of the centre and is the district Madrileños point to when they
          want somewhere calm to live rather than somewhere loud to go out. Wide streets, nineteenth
          century blocks, food markets, and — usefully for anyone looking for bodywork — a dense
          layer of small independent studios that serve residents rather than tourists.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Getting there</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          The barrio is very well connected. <strong className="text-foreground">Ríos Rosas</strong>{" "}
          (line 1), <strong className="text-foreground">Iglesia</strong> (line 1) and{" "}
          <strong className="text-foreground">Canal</strong> (lines 2 and 7) all drop you within a few
          minutes' walk of the streets around Calle de Domenico Scarlatti, and Nuevos Ministerios and
          Alonso Cano are close enough to walk from if you're coming from the north. From Sol it's
          about ten minutes on line 1. Streets are flat and easy to walk, which matters more than it
          sounds when you're leaving a deep tissue session.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Why book massage here</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Chamberí studios are typically owner-run with one or two treatment rooms. Prices are a
          little below the centre — expect €45–€65 for a relaxing hour and €60–€90 for deep tissue,
          in line with the ranges in our{" "}
          <a className="text-primary underline underline-offset-2" href="/guides/massage-prices-madrid">
            Madrid price guide
          </a>{" "}
          — and the therapists tend to be the same people week after week, which is what you want if
          you're staying in the city for a while and plan to come back.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          The trade-off, and the reason this site exists, is that owner-run studios take bookings by
          phone, in Spanish, between clients. Booking through Massage Club skips that entirely.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Featured: Calma Madrid</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Calma Madrid is on{" "}
          <strong className="text-foreground">C. de Domenico Scarlatti 5</strong>, a two-minute walk
          from metro Ríos Rosas, and holds a{" "}
          <strong className="text-foreground">4.9★ Google rating</strong> from its clients. Their menu
          covers deep tissue (<em>Masaje Descontracturante</em>, 60 min · €85), Kobido manual facial
          work (60 min · €45) and relaxing full-body rituals. You choose your pressure and focus
          areas in English when you book, the studio confirms with one tap, and you pay there — no
          card, no prepayment, and a one-click cancel link in your confirmation email.
        </p>

        <CalmaCard />

        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          If you're specifically after firm, targeted work on a stiff back or shoulders, the{" "}
          <a className="text-primary underline underline-offset-2" href="/guides/deep-tissue-massage-madrid">
            deep tissue guide
          </a>{" "}
          explains what to ask for and what a good session feels like.
        </p>

        <p className="text-sm text-muted-foreground mt-8 border-t border-border/60 pt-4">
          More Chamberí studios joining soon.
        </p>

        <GuideLinks exclude="/madrid/chamberi" />
      </article>
    </GuideLayout>
  );
}
