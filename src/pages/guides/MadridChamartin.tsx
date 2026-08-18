import NeighbourhoodPage from "./NeighbourhoodPage";

export default function MadridChamartin() {
  return (
    <NeighbourhoodPage
      path="/madrid/chamartin"
      neighbourhood="Chamartín"
      barrio="Chamartín"
      title="Massage in Chamartín, Madrid — studios, prices and booking"
      description="Massage studios in Chamartín, Madrid: addresses, treatments and prices, near metro Cuzco, Colombia and Nuevos Ministerios. Book online in English."
      h1="Massage in Chamartín, Madrid"
      intro={
        <>
          <p>
            Chamartín is Madrid's business north — Paseo de la Castellana towers, the Cuatro Torres
            skyline, and behind them quiet residential streets around Prosperidad and Hispanoamérica.
            The massage studios here mostly serve two crowds: office workers coming down from a
            desk-bound week, and families who live in the barrio year-round.
          </p>
          <p>
            That means a lot of therapeutic and decontracting work rather than spa theatre, plenty of
            early-evening availability, and prices a notch below Salamanca for a comparable hour.
          </p>
        </>
      }
      metro={
        <p>
          <strong className="text-foreground">Cuzco</strong> and{" "}
          <strong className="text-foreground">Santiago Bernabéu</strong> (line 10) serve the
          Castellana side, <strong className="text-foreground">Colombia</strong> and{" "}
          <strong className="text-foreground">Concha Espina</strong> (line 9) the residential streets
          east, and <strong className="text-foreground">Nuevos Ministerios</strong> (lines 6, 8 and
          10) links the whole district to the airport in about twenty minutes — handy if you're
          booking a session on the way in or out of Madrid.
        </p>
      }
    />
  );
}
