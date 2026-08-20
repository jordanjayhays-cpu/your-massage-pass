import GuideLayout, { CalmaCard, GuideLinks } from "./GuideLayout";
import { Link } from "react-router-dom";

type Row = { barrio: string; studios: number; avg: number; range: string; tone?: "high" | "low" };

const BARRIOS: Row[] = [
  { barrio: "Chueca", studios: 5, avg: 90, range: "€60 – €133", tone: "high" },
  { barrio: "Chamartín", studios: 5, avg: 73, range: "€49 – €150" },
  { barrio: "Centro", studios: 5, avg: 69, range: "€55 – €110" },
  { barrio: "Chamberí", studios: 9, avg: 67, range: "€45 – €100" },
  { barrio: "Salamanca", studios: 8, avg: 65, range: "€30 – €111" },
  { barrio: "Malasaña", studios: 4, avg: 58, range: "€49 – €90", tone: "low" },
];

const TYPES: { label: string; avg: number }[] = [
  { label: "Thai", avg: 68 },
  { label: "Sports", avg: 65 },
  { label: "Facial and Kobido", avg: 65 },
  { label: "Deep tissue", avg: 63 },
  { label: "Relaxing", avg: 58 },
];

const NEIGHBOURHOODS: { path: string; label: string }[] = [
  { path: "/madrid/chueca", label: "Chueca" },
  { path: "/madrid/salamanca", label: "Salamanca" },
  { path: "/madrid/chamberi", label: "Chamberí" },
  { path: "/madrid/malasana", label: "Malasaña" },
  { path: "/madrid/centro", label: "Centro" },
  { path: "/madrid/chamartin", label: "Chamartín" },
];

export default function MassagePricesMadridStudy() {
  const path = "/guides/massage-prices-madrid-study";
  const title = "What a massage actually costs in Madrid | Massage Club";
  const description =
    "We checked the published prices of 48 Madrid massage studios. A 60-minute massage averages €68 — but it costs 55% more in Chueca than in Malasaña, and the city's wealthiest barrio is cheaper than average.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "What a massage actually costs in Madrid",
        description,
        inLanguage: "en",
        datePublished: "2026-08-20",
        dateModified: "2026-08-20",
        mainEntityOfPage: `https://book.massageclub.io${path}`,
        author: { "@type": "Organization", name: "Massage Club" },
        publisher: {
          "@type": "Organization",
          name: "Massage Club",
          url: "https://book.massageclub.io",
        },
        about: "Massage prices in Madrid, August 2026",
      },
      {
        "@type": "Dataset",
        name: "Average price of a 60-minute massage in Madrid by barrio (August 2026)",
        description:
          "232 published 60-minute treatment prices from 48 Madrid massage studios, collected August 2026.",
        creator: { "@type": "Organization", name: "Massage Club" },
        temporalCoverage: "2026-08",
        spatialCoverage: "Madrid, Spain",
        license: "https://book.massageclub.io" + path,
        variableMeasured: BARRIOS.map((b) => ({
          "@type": "PropertyValue",
          name: `${b.barrio} — average 60-minute massage`,
          value: b.avg,
          unitText: "EUR",
        })),
      },
    ],
  };

  return (
    <GuideLayout path={path} title={title} description={description} jsonLd={jsonLd}>
      <article>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">
          Data study · August 2026
        </p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          What a massage actually costs in Madrid
        </h1>
        <p className="text-base text-foreground/85 mt-4 leading-relaxed">
          We checked the published prices of 48 Madrid massage studios — 232 individual treatment
          prices in all, collected during August 2026. A 60-minute massage in Madrid averages{" "}
          <strong className="text-foreground">€68</strong>, with a median of{" "}
          <strong className="text-foreground">€65</strong>. The cheapest single treatment we found
          was €30. The most expensive was €150.
        </p>

        {/* Headline figures */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { k: "Average, 60 min", v: "€68" },
            { k: "Median, 60 min", v: "€65" },
            { k: "Cheapest treatment", v: "€30" },
            { k: "Most expensive", v: "€150" },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-border/60 bg-card shadow-soft px-4 py-3">
              <p className="font-display text-2xl text-foreground tabular-nums">{s.v}</p>
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground mt-1">
                {s.k}
              </p>
            </div>
          ))}
        </div>

        {/* Main table */}
        <h2 className="font-display text-2xl text-foreground mt-10">
          Average price of a 60-minute massage, by barrio
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-soft">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">
              Average price of a 60-minute massage in Madrid by barrio, August 2026
            </caption>
            <thead className="bg-secondary/60">
              <tr className="text-left">
                <th scope="col" className="px-4 py-3 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Barrio
                </th>
                <th scope="col" className="px-4 py-3 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                  Studios
                </th>
                <th scope="col" className="px-4 py-3 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                  Average
                </th>
                <th scope="col" className="px-4 py-3 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                  Range
                </th>
              </tr>
            </thead>
            <tbody>
              {BARRIOS.map((b) => (
                <tr
                  key={b.barrio}
                  className={`border-t border-border/60 ${
                    b.tone === "high"
                      ? "bg-primary/[0.07]"
                      : b.tone === "low"
                        ? "bg-secondary/40"
                        : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-3 text-left font-semibold text-foreground">
                    {b.barrio}
                    {b.tone === "high" && (
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                        Most expensive
                      </span>
                    )}
                    {b.tone === "low" && (
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Cheapest
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground/85">{b.studios}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-display text-lg ${
                      b.tone ? "text-primary" : "text-foreground"
                    }`}
                  >
                    €{b.avg}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                    {b.range}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Only barrios with four or more studios in our data are shown. Figures are averages of
          published list prices for 60-minute individual treatments, August 2026.
        </p>

        {/* Findings */}
        <h2 className="font-display text-2xl text-foreground mt-10">
          The same hour costs 55% more in Chueca than in Malasaña
        </h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          €90 against €58, for a 60-minute massage, in barrios twenty minutes apart on foot. Nothing
          about the treatment itself changes over that walk. The price does.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">
          Madrid's wealthiest district is cheaper than the city average
        </h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Salamanca averages €65 against a city average of €68 — and it contains the cheapest
          treatment we found anywhere in Madrid, at €30. Reputation and price are not the same
          thing.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">
          Chueca is the outlier, not the rule
        </h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Every other barrio we measured sits between €58 and €73. If a price looks far above that,
          you are paying for the room, not the hour.
        </p>

        {/* By type */}
        <h2 className="font-display text-2xl text-foreground mt-10">By type of massage</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Average price for a 60-minute treatment, across all barrios:
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-soft">
          <table className="w-full min-w-[360px] text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left">
                <th scope="col" className="px-4 py-3 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Treatment
                </th>
                <th scope="col" className="px-4 py-3 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                  Average, 60 min
                </th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map((t) => (
                <tr key={t.label} className="border-t border-border/60">
                  <th scope="row" className="px-4 py-3 text-left font-semibold text-foreground">
                    {t.label}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums font-display text-lg text-foreground">
                    €{t.avg}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Methodology */}
        <h2 className="font-display text-2xl text-foreground mt-10">Methodology</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          We collected the published prices of every Madrid massage studio in our directory during
          August 2026: 48 studios and 232 individual treatment prices. We counted only 60-minute
          individual treatments — couples massages, four-hands treatments and packages are excluded,
          because they distort the comparison. Prices are the studios' own published list prices,
          taken from their websites and booking pages; what you pay on the day may differ. Barrios
          with fewer than four studios in our data are excluded from the table, because the average
          would not mean much. We are not claiming this is every massage studio in Madrid — it is
          every one we have listed, which is the largest English-language set we know of.
        </p>

        <CalmaCard />

        {/* Neighbourhood pointers */}
        <h2 className="font-display text-2xl text-foreground mt-10">See the studios behind the numbers</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Every figure above comes from studios you can browse. Each barrio has its own page with the
          studios we list there, what they charge and how to book them in English:{" "}
          {NEIGHBOURHOODS.map((n, i) => (
            <span key={n.path}>
              <Link to={n.path} className="text-primary underline underline-offset-2">
                {n.label}
              </Link>
              {i < NEIGHBOURHOODS.length - 2 ? ", " : i === NEIGHBOURHOODS.length - 2 ? " and " : "."}
            </span>
          ))}
        </p>

        <p className="text-xs text-muted-foreground mt-8 border-t border-border/60 pt-6 leading-relaxed">
          Journalists and bloggers: the underlying figures are free to use with a link to
          book.massageclub.io. Questions to{" "}
          <a href="mailto:jordan@massageclub.io" className="text-primary underline underline-offset-2">
            jordan@massageclub.io
          </a>
          .
        </p>

        <GuideLinks exclude={path} />
      </article>
    </GuideLayout>
  );
}
