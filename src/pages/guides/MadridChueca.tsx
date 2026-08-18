import NeighbourhoodPage from "./NeighbourhoodPage";

export default function MadridChueca() {
  return (
    <NeighbourhoodPage
      path="/madrid/chueca"
      neighbourhood="Chueca"
      barrio="Chueca"
      title="Massage in Chueca, Madrid — studios, prices and booking"
      description="Massage studios in Chueca, Madrid: addresses, treatments and prices, near metro Chueca, Gran Vía and Alonso Martínez. Book online in English."
      h1="Massage in Chueca, Madrid"
      intro={
        <>
          <p>
            Chueca packs a lot into a few blocks: Plaza de Chueca, the Mercado de San Antón, and
            narrow streets like Hortaleza, Augusto Figueroa and Pelayo lined with small businesses
            that stay open late. Massage studios here follow the same rhythm — compact, one or two
            rooms, and often the last appointment of the day is at nine in the evening.
          </p>
          <p>
            It's the barrio where you're most likely to find sports and deep tissue work sold next to
            relaxing rituals, plus a strong tradition of English-speaking therapists thanks to the
            neighbourhood's international crowd.
          </p>
        </>
      }
      metro={
        <p>
          <strong className="text-foreground">Chueca</strong> (line 5) puts you in the middle of it,
          with <strong className="text-foreground">Gran Vía</strong> (lines 1 and 5),{" "}
          <strong className="text-foreground">Banco de España</strong> (line 2) and{" "}
          <strong className="text-foreground">Alonso Martínez</strong> (lines 4, 5 and 10) all within
          a ten-minute walk. Streets are narrow and pedestrian-heavy, so walking beats a taxi almost
          every time.
        </p>
      }
    />
  );
}
