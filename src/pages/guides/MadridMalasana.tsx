import NeighbourhoodPage from "./NeighbourhoodPage";

export default function MadridMalasana() {
  return (
    <NeighbourhoodPage
      path="/madrid/malasana"
      neighbourhood="Malasaña"
      barrio="Malasaña"
      title="Massage in Malasaña, Madrid — studios, prices and booking"
      description="Massage studios in Malasaña, Madrid: addresses, treatments and prices, near metro Tribunal, Noviciado and Bilbao. Book online in English."
      h1="Massage in Malasaña, Madrid"
      intro={
        <>
          <p>
            Malasaña — officially Universidad — is the barrio around Plaza del Dos de Mayo, and its
            studios tend to look like the neighbourhood: independent, small, a little design-led, run
            by one or two therapists who also know their regulars by name.
          </p>
          <p>
            You'll find more holistic and Thai-influenced work here than in the business districts,
            often at friendlier prices, and studios that are genuinely comfortable working in English
            because half the street already is.
          </p>
        </>
      }
      metro={
        <p>
          <strong className="text-foreground">Tribunal</strong> (lines 1 and 10) is the main way in,
          with <strong className="text-foreground">Noviciado</strong> (line 2) to the west,{" "}
          <strong className="text-foreground">Bilbao</strong> (lines 1 and 4) at the northern edge and{" "}
          <strong className="text-foreground">San Bernardo</strong> (lines 2 and 4) nearby. Chueca is
          a five-minute walk east if nothing here has the slot you want.
        </p>
      }
    />
  );
}
