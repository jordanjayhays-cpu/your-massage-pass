import NeighbourhoodPage from "./NeighbourhoodPage";

export default function MadridChamberi() {
  return (
    <NeighbourhoodPage
      path="/madrid/chamberi"
      neighbourhood="Chamberí"
      barrio="Chamberí"
      title="Massage in Chamberí, Madrid — studios, prices and booking"
      description="Massage studios in Chamberí, Madrid: addresses, treatments and prices, near metro Ríos Rosas, Iglesia and Canal. Book online in English and pay at the studio."
      h1="Massage in Chamberí, Madrid"
      intro={
        <>
          <p>
            Chamberí sits just north of the centre and is the district Madrileños point to when they
            want somewhere calm to live rather than somewhere loud to go out. Wide streets,
            nineteenth-century blocks, food markets, and — usefully for anyone looking for bodywork —
            a dense layer of small independent studios that serve residents rather than tourists.
          </p>
          <p>
            Studios here are typically owner-run with one or two treatment rooms. Prices sit a little
            below the centre — roughly €45–€65 for a relaxing hour and €60–€90 for deep tissue, in
            line with our{" "}
            <a
              className="text-primary underline underline-offset-2"
              href="/guides/massage-prices-madrid"
            >
              Madrid price guide
            </a>{" "}
            — and you tend to see the same therapist week after week.
          </p>
        </>
      }
      metro={
        <p>
          <strong className="text-foreground">Ríos Rosas</strong> (line 1),{" "}
          <strong className="text-foreground">Iglesia</strong> (line 1) and{" "}
          <strong className="text-foreground">Canal</strong> (lines 2 and 7) all drop you within a few
          minutes' walk of the streets around Calle de Domenico Scarlatti, and Nuevos Ministerios and
          Alonso Cano are walkable from the north. From Sol it's about ten minutes on line 1, and the
          streets are flat — which matters more than it sounds when you're leaving a deep tissue
          session.
        </p>
      }
    >
      <p className="text-sm text-foreground/85 mt-6 leading-relaxed">
        If you're specifically after firm, targeted work on a stiff back or shoulders, the{" "}
        <a
          className="text-primary underline underline-offset-2"
          href="/guides/deep-tissue-massage-madrid"
        >
          deep tissue guide
        </a>{" "}
        explains what to ask for and what a good session feels like.
      </p>
    </NeighbourhoodPage>
  );
}
