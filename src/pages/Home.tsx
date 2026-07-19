import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { fetchShops } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";

type ShopWithSlug = Shop & { slug?: string | null };

export default function Home() {
  const [shops, setShops] = useState<ShopWithSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

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
      setShops(list.map((s) => ({ ...s, slug: slugMap[s.partner_id] })));
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
            Los mejores masajes de Madrid,
            <br className="hidden md:block" /> en un solo lugar.
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-2xl">
            Estudios verificados, precios claros y reserva instantánea. Paga en el estudio.
          </p>

          {/* Search */}
          <div className="mt-4 max-w-2xl">
            <div className="flex items-center gap-2 bg-card rounded-full shadow-soft border border-border/60 pl-4 pr-2 h-12">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s) => (
                <StudioCard key={s.id} shop={s} href={bookHref(s)} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-secondary/40">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/brand/mc-avatar-terracotta.png"
              alt="Massage Club"
              className="h-6 w-6 rounded-full"
            />
            <span className="text-sm text-muted-foreground">
              Massage Club · Madrid
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs font-bold tracking-[0.14em] uppercase">
            <Link to="/partner" className="text-foreground/80 hover:text-primary transition">
              For studios
            </Link>
            <Link to="/app" className="text-foreground/80 hover:text-primary transition">
              Open app
            </Link>
          </div>
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
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-display text-xl font-semibold text-foreground leading-tight truncate">
          {shop.studio}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{shop.district || shop.address || "Madrid"}</span>
        </div>

        {shop.basePrice != null && (
          <p className="text-sm text-primary font-semibold mt-2">
            desde €{shop.basePrice}
          </p>
        )}

        {services.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs text-foreground/80">
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

        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
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
