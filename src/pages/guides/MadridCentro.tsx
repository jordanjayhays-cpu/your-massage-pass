import NeighbourhoodPage from "./NeighbourhoodPage";

export default function MadridCentro() {
  return (
    <NeighbourhoodPage
      path="/madrid/centro"
      neighbourhood="Centro"
      barrio="Centro (Sol)"
      title="Massage in Centro (Sol), Madrid — studios, prices and booking"
      description="Massage studios in central Madrid around Sol: addresses, treatments and prices, near metro Sol, Ópera and Callao. Book online in English, pay at the studio."
      h1="Massage in Centro (Sol), Madrid"
      intro={
        <>
          <p>
            Centro is the Madrid most visitors actually walk: Sol, Plaza Mayor, Ópera, the streets
            running down to Lavapiés. Studios here are used to short-notice bookings from people
            staying nearby for a few nights, so same-week availability is more common than in the
            residential barrios.
          </p>
          <p>
            The trade-off is space — expect smaller rooms above street level and a bit of city noise.
            What you get in return is a studio five minutes from wherever you're sleeping, and menus
            that lean towards an hour of relaxing or decontracting work rather than long spa
            circuits.
          </p>
        </>
      }
      metro={
        <p>
          <strong className="text-foreground">Sol</strong> (lines 1, 2 and 3, plus Cercanías) is the
          obvious hub, with <strong className="text-foreground">Ópera</strong> (lines 2, 5 and R),{" "}
          <strong className="text-foreground">Callao</strong> (lines 3 and 5) and{" "}
          <strong className="text-foreground">Tirso de Molina</strong> (line 1) covering the edges.
          Almost everything in this list is walkable from Sol in under fifteen minutes.
        </p>
      }
    />
  );
}
