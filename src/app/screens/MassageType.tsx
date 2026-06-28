import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Gauge, Clock, Droplet, Shirt, Info, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MASSAGE_GUIDE, MASSAGE_TYPES, MASSAGES, type MassageGuide } from "../data";
import { fetchShops, type Shop } from "@/lib/supabase";
import { useBooking } from "../BookingContext";

type AnyStudio = Shop | (typeof MASSAGES)[number];

function matchesGuide(s: AnyStudio, g: MassageGuide): boolean {
  if (g.relatedType && (s as any).type === g.relatedType) return true;
  const hay = [
    (s as any).name,
    (s as any).studio,
    ...((s as any).tags ?? []),
    ...((s as any).services ?? []),
    (s as any).type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return g.studioMatch.some((kw) => hay.includes(kw.toLowerCase()));
}

export default function MassageTypePage() {
  const navigate = useNavigate();
  const { type } = useParams();
  const { set } = useBooking();
  const guide = MASSAGE_GUIDE.find((g) => g.id === type);
  const legacy = !guide ? MASSAGE_TYPES.find((t) => t.id === type) : null;

  const [realShops, setRealShops] = useState<Shop[]>([]);
  useEffect(() => {
    fetchShops().then(setRealShops).catch(() => {});
  }, []);

  if (!guide && !legacy) {
    return (
      <div className="p-8 text-center">
        <p>Not found.</p>
        <Button onClick={() => navigate("/app/discovery")} className="mt-4">Back to discovery</Button>
      </div>
    );
  }

  // Legacy fallback (shouldn't normally happen, all ids covered in guide)
  if (!guide && legacy) {
    const studios = MASSAGES.filter((m) => m.type === type);
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="relative h-56 flex-shrink-0">
          <img src={legacy.image} alt={legacy.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-foreground/30" />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 h-10 w-10 rounded-full bg-background/95 flex items-center justify-center shadow-soft"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-6 right-6">
            <h1 className="font-display text-3xl font-bold text-primary-foreground">{legacy.name}</h1>
            <p className="text-primary-foreground/90 text-sm">{legacy.short}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-foreground/85 leading-relaxed">{legacy.description}</p>
          <div className="rounded-2xl bg-secondary p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center">
              <Gauge className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Typical pressure</p>
              <p className="font-semibold">{legacy.pressure}</p>
            </div>
          </div>
          {studios.length > 0 && (
            <div className="space-y-2">
              {studios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/massages/${s.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-left"
                >
                  <img src={s.image} alt={s.studio} className="h-14 w-14 rounded-lg object-cover" />
                  <div>
                    <p className="font-semibold text-sm">{s.studio}</p>
                    <p className="text-xs text-muted-foreground">{s.district} · {s.duration} min</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const g = guide!;

  const allStudios: AnyStudio[] = [...realShops, ...MASSAGES];
  const seen = new Set<string>();
  const matched = allStudios.filter((s) => {
    if (!s || !(s as any).id || seen.has((s as any).id)) return false;
    if (!matchesGuide(s, g)) return false;
    seen.add((s as any).id);
    return true;
  }).slice(0, 6);

  const handleBook = (s: AnyStudio) => {
    if ((s as Shop).partner_id) {
      navigate(`/s/${(s as Shop).partner_id}`);
      return;
    }
    set({ massageId: (s as any).id, shop: s as any });
    navigate(`/massages/${(s as any).id}`);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background pb-28">
      {/* Hero */}
      <div className="relative h-64 flex-shrink-0">
        <img src={g.image} alt={g.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-foreground/20" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-card/95 flex items-center justify-center shadow-soft border border-border/60"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 -mt-8 relative">
        <div className="bg-card rounded-3xl border border-border/60 shadow-soft p-6 space-y-3">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary">{g.origin}</p>
          <h1 className="font-display text-3xl text-foreground leading-tight">{g.name}</h1>
          <p className="text-foreground/70 text-base italic">{g.tagline}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Chip icon={<Gauge className="h-3.5 w-3.5" />}>{g.pressure} pressure</Chip>
            <Chip icon={<Clock className="h-3.5 w-3.5" />}>{g.duration}</Chip>
            <Chip icon={<Droplet className="h-3.5 w-3.5" />}>{g.usesOil ? "Oil" : "No oil"}</Chip>
            <Chip icon={<Shirt className="h-3.5 w-3.5" />}>{g.clothed ? "Clothed" : "Undress to comfort"}</Chip>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        <Section title="What it is">
          <p className="text-foreground/80 leading-relaxed">{g.description}</p>
        </Section>

        <Section title="How it works">
          <p className="text-foreground/80 leading-relaxed">{g.howItWorks}</p>
        </Section>

        <Section title="What it feels like">
          <p className="text-foreground/80 leading-relaxed">{g.feels}</p>
        </Section>

        <Section title="Best for">
          <ul className="space-y-2">
            {g.bestFor.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-foreground/85">
                <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </Section>

        <div className="rounded-2xl bg-secondary border border-border/60 p-4 flex gap-3">
          <div className="h-8 w-8 rounded-full bg-card flex items-center justify-center flex-shrink-0">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1">Good to know</p>
            <p className="text-sm text-foreground/85 leading-relaxed">{g.goodToKnow}</p>
          </div>
        </div>

        <Section title="Where to try it in Madrid">
          {matched.length > 0 ? (
            <div className="space-y-2.5">
              {matched.map((s) => (
                <button
                  key={(s as any).id}
                  onClick={() => handleBook(s)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-card hover:border-primary/50 hover:shadow-soft transition text-left"
                >
                  {(s as any).image && (
                    <img src={(s as any).image} alt={(s as any).studio} className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base font-semibold text-foreground truncate">{(s as any).studio}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {(s as any).district || "Madrid"} · {(s as any).duration} min
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary">Book →</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-secondary border border-border/60 p-5 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No studios in our directory currently list this style. New partners are joining all the time.
              </p>
              <Button onClick={() => navigate("/app/massages")} className="rounded-full">
                Browse all studios
              </Button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-secondary border border-border/60 rounded-full px-3 py-1.5">
      {icon}
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-xl text-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}
