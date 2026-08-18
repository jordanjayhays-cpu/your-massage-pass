import NeighbourhoodPage from "./NeighbourhoodPage";

export default function MadridSalamanca() {
  return (
    <NeighbourhoodPage
      path="/madrid/salamanca"
      neighbourhood="Salamanca"
      barrio="Salamanca"
      title="Massage in Salamanca, Madrid — studios, prices and booking"
      description="Massage studios in Barrio de Salamanca, Madrid: addresses, treatments and prices from €, near metro Serrano, Velázquez and Goya. Book online in English."
      h1="Massage in Salamanca, Madrid"
      intro={
        <>
          <p>
            Barrio de Salamanca is Madrid's grid of wide avenues, embassies and flagship stores, and
            its bodywork scene reflects that: clinical, appointment-led studios tucked into ground
            floors on Serrano, Velázquez, Claudio Coello and Goya, often sharing a building with a
            physiotherapist or an aesthetics clinic.
          </p>
          <p>
            Expect the higher end of Madrid pricing here, and expect it to buy you a private room, a
            proper intake conversation and therapists who are used to office backs, marathon
            training and long-haul travel. Several also work in English by default because of the
            local expat and business population.
          </p>
        </>
      }
      metro={
        <p>
          <strong className="text-foreground">Serrano</strong> and{" "}
          <strong className="text-foreground">Velázquez</strong> (line 4) cover the western half of
          the barrio, <strong className="text-foreground">Goya</strong> (lines 2 and 4) the busy
          shopping streets to the south, and <strong className="text-foreground">Núñez de Balboa</strong>{" "}
          (lines 5 and 9) the quieter blocks north of Ortega y Gasset. Retiro park is a short walk
          west, which is a pleasant way to finish a session rather than diving straight back onto the
          metro.
        </p>
      }
    />
  );
}
