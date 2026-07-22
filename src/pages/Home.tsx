import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { fetchShops } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";

type ShopWithSlug = Shop & { slug?: string | null; rating_avg?: number; rating_count?: number };

export default function Home() {
  const { i18n } = useTranslation();
  const isSpanish = (i18n.resolvedLanguage || "en").startsWith("es");
  const [shops, setShops] = useState<ShopWithSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(9);

  useEffect(() => {
    const target = "Massage Club — Book massages in Madrid";
    if (document.title !== target) document.title = target;
  }, []);

  useEffect(() => {

    (async () => {
      const list = await fetchShops();
      // Pull slugs for the same partner ids (public column, anon-readable).
      const ids = list.map((s) => s.partner_id).filter(Boolean);
      let slugMap: Record<string, string> = {};
      if (ids.length) {
        const { data } = await supabase
          .from("partners")
          .select("id, slug")
          .in("id", ids);
        for (const p of data ?? []) if ((p as any).slug) slugMap[(p as any).id] = (p as any).slug;
      }
      const { data: ratings } = await supabase
        .from("partner_rating_summary")
        .select("partner_id, rating_avg, rating_count");
      const ratingMap: Record<string, { avg: number; count: number }> = {};
      for (const r of ratings ?? []) {
        const row = r as any;
        if (row.rating_count > 0) ratingMap[row.partner_id] = { avg: Number(row.rating_avg), count: Number(row.rating_count) };
      }
      setShops(list.map((s) => ({
        ...s,
        slug: slugMap[s.partner_id],
        rating_avg: ratingMap[s.partner_id]?.avg,
        rating_count: ratingMap[s.partner_id]?.count,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return shops;
    return shops.filter(
      (s) =>
        s.studio.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.district ?? "").toLowerCase().includes(query)
    );
  }, [shops, q]);

  const bookHref = (s: ShopWithSlug) => `/book/${s.slug || s.partner_id}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt="Massage Club"
              className="h-8 w-8 rounded-full"
            />
            <span className="font-display text-lg tracking-tight text-foreground">
              Massage Club
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageFlagToggle />
            <Link
              to="/partner"
              className="hidden sm:inline-flex h-9 px-4 rounded-full border border-border/80 text-foreground text-[11px] font-bold tracking-[0.12em] uppercase hover:bg-accent transition items-center"
            >
              For studios
            </Link>
            <Link
              to="/app"
              className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tracking-[0.12em] uppercase shadow-soft hover:opacity-90 transition inline-flex items-center gap-1.5"
            >
              Open app <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4">
        {/* Compact hero */}
        <section className="pt-6 md:pt-8 pb-5 md:pb-6">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">
            Massage Club · Madrid
          </p>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl leading-[1.05] text-foreground mt-2 text-balance">
            Massage Club
          </h1>
          <p className="text-base md:text-lg text-foreground mt-2 max-w-2xl leading-snug">
            {isSpanish
              ? "Descubre y reserva masajes en los mejores estudios de Madrid. Compara menús y precios reales, reserva online en un minuto y paga directamente en el estudio."
              : "Discover and book massages at Madrid's best studios — real menus and prices, online booking in a minute, pay at the studio."}
          </p>
          <p className="text-sm md:text-base text-muted-foreground mt-1.5 max-w-2xl">
            {isSpanish
              ? "Discover and book massages at Madrid's best studios — real menus and prices, online booking in a minute, pay at the studio."
              : "Descubre y reserva masajes en los mejores estudios de Madrid. Compara menús y precios reales, reserva online en un minuto y paga directamente en el estudio."}
          </p>

          {/* Search */}
          <div className="mt-4 max-w-2xl">
            <div className="flex items-center gap-2 bg-card rounded-full shadow-soft border border-border/60 pl-4 pr-2 h-12">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setVisibleCount(9); }}
                placeholder="Buscar por estudio, zona o tipo de masaje…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="pb-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl md:text-2xl text-foreground">
              Estudios en Madrid
            </h2>
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-primary">
              {loading ? "…" : `${filtered.length} estudios`}
            </span>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-16 text-sm">
              Cargando estudios…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-16 text-sm">
              No encontramos estudios que coincidan.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.slice(0, visibleCount).map((s) => (
                  <StudioCard key={s.id} shop={s} href={bookHref(s)} />
                ))}
              </div>
              {filtered.length > visibleCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount((c) => c + 9)}
                    className="h-11 px-8 rounded-full border border-primary text-primary text-xs font-bold tracking-[0.14em] uppercase hover:bg-primary/5 transition"
                  >
                    Ver más estudios / Show more
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            Massage Club · Madrid{" "}
            <span className="mx-1">·</span>{" "}
            <Link to="/privacy" className="hover:text-primary transition underline-offset-2 hover:underline">
              Política de Privacidad
            </Link>
            <span className="mx-1">·</span>{" "}
            <Link to="/terms" className="hover:text-primary transition underline-offset-2 hover:underline">
              Términos
            </Link>
            <span className="mx-1">·</span>{" "}
            <a href="mailto:support@massageclub.io" className="hover:text-primary transition underline-offset-2 hover:underline">
              support@massageclub.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function StudioCard({ shop, href }: { shop: ShopWithSlug; href: string }) {
  const services = (shop.partner_services ?? []).slice(0, 3);
  return (
    <Link
      to={href}
      className="group bg-card border border-border/60 rounded-2xl overflow-hidden shadow-soft hover:shadow-elegant hover:border-primary/50 transition-all flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
        {shop.image ? (
          <img
            src={shop.image}
            alt={shop.studio}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-warm flex items-center justify-center">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt=""
              className="h-14 w-14 rounded-full opacity-90"
            />
          </div>
        )}
      </div>
      <div className="p-3.5 flex-1 flex flex-col">
        <h3 className="font-display text-lg font-semibold text-foreground leading-tight truncate">
          {shop.studio}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{shop.district || shop.address || "Madrid"}</span>
        </div>

        {shop.rating_count != null && shop.rating_count > 0 && shop.rating_avg != null ? (
          <p className="text-xs font-semibold text-primary mt-1">
            ★ {shop.rating_avg.toFixed(1)} <span className="text-muted-foreground font-normal">({shop.rating_count})</span>
          </p>
        ) : shop.google_rating != null ? (
          <p className="text-xs font-semibold text-primary mt-1">
            ★ {Number(shop.google_rating).toFixed(1)}
            {shop.google_reviews != null && (
              <span className="text-muted-foreground font-normal"> ({shop.google_reviews} · Google)</span>
            )}
          </p>
        ) : null}


        {shop.basePrice != null && (
          <p className="text-sm text-primary font-semibold mt-1.5">
            desde €{shop.basePrice}
          </p>
        )}

        {services.length > 0 && (
          <ul className="mt-2.5 space-y-1 text-xs text-foreground/80">
            {services.map((sv, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="truncate">{sv.name}</span>
                <span className="text-muted-foreground flex-shrink-0">
                  {sv.duration ? `${sv.duration} min` : ""}
                  {sv.price != null ? ` · €${sv.price}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">
            Pay at studio
          </span>
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary inline-flex items-center gap-1">
            Book <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
