import { useNavigate } from "react-router-dom";
import { Search, Star, MapPin, Clock, List, Map as MapIcon, Compass, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MASSAGES, MASSAGE_TYPES, MassageType, MADRID_CENTER, distanceKm } from "../data";
import { useBooking } from "../BookingContext";
import { useState } from "react";
import { cn } from "@/lib/utils";
import GoogleMap from "../components/GoogleMap";

type Tab = "list" | "map";

export default function MassageList() {
  const navigate = useNavigate();
  const { set } = useBooking();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("list");
  const [typeFilter, setTypeFilter] = useState<MassageType | "all">("all");

  const filtered = MASSAGES.filter((m) => {
    const matchesQ =
      m.name.toLowerCase().includes(q.toLowerCase()) ||
      m.studio.toLowerCase().includes(q.toLowerCase()) ||
      m.district.toLowerCase().includes(q.toLowerCase());
    const matchesType = typeFilter === "all" || m.type === typeFilter;
    return matchesQ && matchesType;
  }).map((m) => ({ ...m, km: distanceKm(MADRID_CENTER, m) }))
    .sort((a, b) => a.km - b.km);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 bg-card border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">Hola, Madrid</p>
            <h1 className="font-display text-2xl font-bold text-foreground mt-1">Pick today's escape</h1>
          </div>
          <button
            onClick={() => navigate("/discovery")}
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-gradient-gold text-foreground text-xs font-semibold shadow-gold hover:opacity-90 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Discover
          </button>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search massages, studios, neighborhoods"
            className="pl-9 h-11 bg-background"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-2 overflow-x-auto pt-3 -mx-6 px-6 pb-1">
          <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
            All types
          </FilterChip>
          {MASSAGE_TYPES.map((t) => (
            <FilterChip key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>
              {t.name}
            </FilterChip>
          ))}
        </div>

        {/* List / Map tabs */}
        <div className="mt-3 grid grid-cols-2 bg-secondary rounded-full p-1">
          <button
            onClick={() => setTab("list")}
            className={cn(
              "flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold transition",
              tab === "list" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setTab("map")}
            className={cn(
              "flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold transition",
              tab === "map" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" /> Map
          </button>
        </div>
      </div>

      {/* Body */}
      {tab === "list" ? (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                set({ massageId: m.id });
                navigate(`/massages/${m.id}`);
              }}
              className="w-full text-left rounded-2xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant transition-all"
            >
              <div className="relative h-40">
                <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/95 rounded-full px-2 py-1 text-xs font-semibold">
                  <Star className="h-3 w-3 fill-accent text-accent" /> {m.rating}
                </div>
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-background/95 rounded-full px-2 py-1 text-xs font-semibold">
                  <Compass className="h-3 w-3 text-primary" /> {m.km.toFixed(1)} km
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-display text-xl font-bold text-primary-foreground">{m.name}</h3>
                  <p className="text-sm text-primary-foreground/90">{m.studio}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {m.district}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {m.duration} min
                </span>
                <span>{m.reviews} reviews</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">No matches. Try another search.</p>
          )}
        </div>
      ) : (
        <GoogleMap
          massages={filtered}
          onSelect={(m) => {
            set({ massageId: m.id });
            navigate(`/massages/${m.id}`);
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}
