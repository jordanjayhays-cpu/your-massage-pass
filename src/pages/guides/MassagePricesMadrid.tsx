import GuideLayout, { CalmaCard, GuideLinks } from "./GuideLayout";

const ROWS: { type: string; duration: string; range: string; note: string }[] = [
  { type: "Relaxing / Swedish", duration: "60 min", range: "€45 – €65", note: "Lighter pressure, full body, the most common menu item." },
  { type: "Deep tissue / descontracturante", duration: "60 min", range: "€60 – €90", note: "Firm, targeted work on knots and chronic tension." },
  { type: "Facial / Kobido", duration: "60 min", range: "€40 – €60", note: "Manual facial work, no machines, no products upsell in most studios." },
  { type: "Couples massage", duration: "60 min", range: "from €90", note: "Priced for two people, needs a studio with two tables." },
  { type: "Short session", duration: "30 min", range: "€25 – €45", note: "Back, neck and shoulders only." },
  { type: "Extended session", duration: "90 min", range: "€75 – €130", note: "Full body with time for detailed work." },
];

export default function MassagePricesMadrid() {
  const title = "Massage prices in Madrid (2026) — real ranges by type | Massage Club";
  const description =
    "What a massage actually costs in Madrid in 2026: typical price ranges by treatment and duration, plus real prices from a live studio menu. Book in English, pay at the studio.";

  return (
    <GuideLayout path="/guides/massage-prices-madrid" title={title} description={description}>
      <article>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">Guide · Prices</p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          Massage prices in Madrid (2026)
        </h1>
        <p className="text-base text-foreground/85 mt-4 leading-relaxed">
          Madrid massage prices are rarely published. Most studios list treatments on a printed menu
          at reception, or quote you over WhatsApp. This page collects the ranges you should expect
          in 2026, so you know when a quote is normal and when it isn't.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Typical price ranges</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Treatment</th>
                <th className="px-3 py-2.5 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Duration</th>
                <th className="px-3 py-2.5 font-bold text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Typical price</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.type + r.duration} className="border-t border-border/60 align-top">
                  <td className="px-3 py-3">
                    <span className="font-semibold text-foreground">{r.type}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{r.note}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-foreground/85">{r.duration}</td>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold text-primary">{r.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="font-display text-2xl text-foreground mt-8">Why the ranges are wide</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Two things move the price more than anything else: the neighbourhood and the format of the
          studio. Salamanca, Chueca and the centre carry higher rents, and their menus reflect it.
          Chamberí, Tetuán, Arganzuela and the outer barrios are usually €10–€20 cheaper for the same
          hour of work. Hotel spas and large wellness centres sit well above the ranges above,
          frequently €120+ for sixty minutes, because you're also paying for the circuit, the robe
          and the lounge.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          The second factor is who works on you. Studios where the owner is the therapist tend to
          price honestly and consistently. Places that heavily discount on deal sites usually recover
          the difference through upsells during the session. A €35 hour in central Madrid is not
          normally a bargain — it's a shorter session than advertised, or an aggressive add-on pitch.
        </p>
        <p className="text-sm text-foreground/85 mt-3 leading-relaxed">
          Note that in Spain tipping is not customary. The menu price is what you pay, and IVA is
          already included in the figures a studio quotes you.
        </p>

        <h2 className="font-display text-2xl text-foreground mt-8">Real prices from our live menu</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Rather than quote averages we can't verify, here are actual prices from Calma Madrid in
          Chamberí — currently the one studio you can book end-to-end through Massage Club:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
          <li>
            <strong className="text-foreground">Masaje Descontracturante</strong> (deep tissue) — 60 min ·{" "}
            <span className="font-semibold text-primary">€85</span>
          </li>
          <li>
            <strong className="text-foreground">Kobido facial</strong> — 60 min ·{" "}
            <span className="font-semibold text-primary">€45</span>
          </li>
        </ul>

        <CalmaCard note="Deep tissue at €85 for 60 minutes and a Kobido facial at €45 — booked online in English, paid at the studio." />

        <h2 className="font-display text-2xl text-foreground mt-8">Booking without prepaying</h2>
        <p className="text-sm text-foreground/85 mt-2 leading-relaxed">
          Every booking made through Massage Club is pay-at-the-studio. You reserve your slot, the
          studio confirms with one tap, and money changes hands only when you're there. If your plans
          change, the confirmation email cancels the booking in one click. For the full picture of
          booking a Madrid massage without Spanish, read{" "}
          <a className="text-primary underline underline-offset-2" href="/massage-in-english-madrid">
            Massage in Madrid, booked in English
          </a>
          .
        </p>

        <GuideLinks exclude="/guides/massage-prices-madrid" />
      </article>
    </GuideLayout>
  );
}
