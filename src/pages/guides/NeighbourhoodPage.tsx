import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import GuideLayout, { GuideLinks } from "./GuideLayout";

const SITE = "https://book.massageclub.io";

export interface NeighbourhoodStudio {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  status: string;
  fromPrice: number | null;
  serviceNames: string[];
  googleRating: number | null;
  googleReviews: number | null;
}

/** Same quality bar as the dynamic sitemap: >= 3 services, not suspended,
 *  not rejected / skipped. Query is data-driven so pages stay current. */
export async function fetchNeighbourhoodStudios(
  neighbourhood: string
): Promise<NeighbourhoodStudio[]> {
  const { data: partners, error } = await supabase
    .from("partners")
    .select(
      "id, slug, business_name, address, status, outreach_status, google_rating, google_reviews"
    )
    .eq("neighbourhood", neighbourhood)
    .neq("status", "suspended")
    .limit(200);

  if (error || !partners?.length) return [];

  const eligible = (partners as any[]).filter(
    (p) =>
      !["rejected", "skipped_not_massage"].includes(p.outreach_status ?? "")
  );
  if (!eligible.length) return [];

  const { data: services } = await supabase
    .from("partner_services")
    .select("partner_id, name, price")
    .in(
      "partner_id",
      eligible.map((p) => p.id)
    );

  const byPartner: Record<string, { name: string; price: number | null }[]> = {};
  for (const s of (services as any[]) ?? []) {
    (byPartner[s.partner_id] ||= []).push({
      name: s.name ?? "",
      price: s.price == null || isNaN(Number(s.price)) ? null : Number(s.price),
    });
  }

  const rows: NeighbourhoodStudio[] = [];
  for (const p of eligible) {
    const svcs = byPartner[p.id] ?? [];
    if (svcs.length < 3) continue;
    const prices = svcs.map((s) => s.price).filter((n): n is number => n != null && n > 0);
    rows.push({
      id: p.id,
      slug: p.slug ?? null,
      name: p.business_name || "Studio",
      address: p.address || "",
      status: p.status || "pending",
      fromPrice: prices.length ? Math.min(...prices) : null,
      serviceNames: svcs.map((s) => s.name).filter(Boolean).slice(0, 3),
      googleRating: p.google_rating ?? null,
      googleReviews: p.google_reviews ?? null,
    });
  }

  // Claimed studios first, then alphabetical within each group.
  rows.sort((a, b) => {
    const aActive = a.status === "active" ? 0 : 1;
    const bActive = b.status === "active" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name, "es");
  });

  return rows;
}

export const NEIGHBOURHOODS: { path: string; label: string }[] = [
  { path: "/madrid/salamanca", label: "Massage in Salamanca" },
  { path: "/madrid/chamartin", label: "Massage in Chamartín" },
  { path: "/madrid/chamberi", label: "Massage in Chamberí" },
  { path: "/madrid/chueca", label: "Massage in Chueca" },
  { path: "/madrid/centro", label: "Massage in Centro (Sol)" },
  { path: "/madrid/malasana", label: "Massage in Malasaña" },
];

function studioHref(s: NeighbourhoodStudio) {
  return s.slug ? `/${s.slug}` : `/s/${s.id}`;
}

export default function NeighbourhoodPage({
  path,
  neighbourhood,
  barrio,
  title,
  description,
  h1,
  intro,
  metro,
  children,
}: {
  path: string;
  /** exact partners.neighbourhood value, accents included */
  neighbourhood: string;
  /** display name for the barrio */
  barrio: string;
  title: string;
  description: string;
  h1: string;
  /** genuine, barrio-specific intro paragraphs */
  intro: React.ReactNode;
  /** short metro / getting-there paragraph */
  metro: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [studios, setStudios] = useState<NeighbourhoodStudio[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNeighbourhoodStudios(neighbourhood).then((rows) => {
      if (alive) setStudios(rows);
    });
    return () => {
      alive = false;
    };
  }, [neighbourhood]);

  const list = studios ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: h1,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: list.length,
        itemListElement: list.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "LocalBusiness",
            "@id": `${SITE}${studioHref(s)}`,
            name: s.name,
            url: `${SITE}${studioHref(s)}`,
            address: {
              "@type": "PostalAddress",
              streetAddress: s.address,
              addressLocality: "Madrid",
              addressRegion: barrio,
              addressCountry: "ES",
            },
            ...(s.fromPrice ? { priceRange: `From €${s.fromPrice}` } : {}),
            ...(s.googleRating
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: s.googleRating,
                    reviewCount: s.googleReviews ?? 1,
                  },
                }
              : {}),
          },
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `How much does a massage cost in ${barrio}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Most studios in ${barrio} charge around €45–€70 for a 60-minute relaxing massage and €60–€95 for deep tissue. Each studio below shows its cheapest listed treatment.`,
            },
          },
          {
            "@type": "Question",
            name: `Can I book a massage in ${barrio} in English?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Yes. Studios marked as bookable on Massage Club take requests online in English — you choose pressure and focus areas when you book and pay at the studio.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <GuideLayout path={path} title={title} description={description} jsonLd={jsonLd}>
      <article>
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">
          Guide · Neighbourhood
        </p>
        <h1 className="font-display text-3xl md:text-4xl leading-[1.08] text-foreground mt-2">
          {h1}
        </h1>
        <div className="text-base text-foreground/85 mt-4 leading-relaxed space-y-3">{intro}</div>

        <h2 className="font-display text-2xl text-foreground mt-8">Getting there</h2>
        <div className="text-sm text-foreground/85 mt-2 leading-relaxed space-y-3">{metro}</div>

        <h2 className="font-display text-2xl text-foreground mt-8">
          Massage studios in {barrio}
        </h2>

        {studios === null ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">
            We're still verifying studios in {barrio}. In the meantime, browse{" "}
            <Link to="/app" className="text-primary underline underline-offset-2">
              every studio in Madrid
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-border/60 bg-card shadow-soft p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={studioHref(s)}
                      className="font-display text-lg text-foreground hover:text-primary transition underline-offset-2 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.address && (
                      <p className="text-xs text-muted-foreground mt-0.5">{s.address}</p>
                    )}
                    {s.serviceNames.length > 0 && (
                      <p className="text-sm text-foreground/80 mt-2">
                        {s.serviceNames.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {s.fromPrice != null && (
                      <p className="text-sm font-bold text-foreground whitespace-nowrap">
                        from €{s.fromPrice}
                      </p>
                    )}
                    {s.googleRating != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ★ {s.googleRating}
                      </p>
                    )}
                    {s.status === "active" && (
                      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-primary mt-1">
                        Bookable
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {children}

        <nav className="mt-10 border-t border-border/60 pt-6">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-primary mb-2">
            Other Madrid neighbourhoods
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NEIGHBOURHOODS.filter((n) => n.path !== path).map((n) => (
              <li key={n.path}>
                <Link
                  to={n.path}
                  className="text-foreground hover:text-primary underline-offset-2 hover:underline transition"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <GuideLinks exclude={path} />
      </article>
    </GuideLayout>
  );
}
