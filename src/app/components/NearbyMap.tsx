import { useEffect, useState } from "react";
import { Massage, MADRID_CENTER, distanceKm } from "../data";
import { MapPin, Star, Clock, Navigation, LocateFixed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  massages: Massage[];
  onSelect: (m: Massage) => void;
  /** Compact = embedded inside another scroll container (no inner card) */
  compact?: boolean;
};

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "error"; message: string };

/**
 * Map view that requests real geolocation. Falls back to Madrid center
 * if denied/unsupported so studios are always visible.
 */
export default function NearbyMap({ massages, onSelect, compact = false }: Props) {
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [active, setActive] = useState<string | null>(massages[0]?.id ?? null);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "error", message: "Geolocation isn't supported in this browser." });
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeo({ status: "error", message: err.message || "Couldn't get your location." }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  // Prompt on mount in compact mode (Discovery embed)
  useEffect(() => {
    if (compact && geo.status === "idle") requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const userLoc =
    geo.status === "ready" ? { lat: geo.lat, lng: geo.lng } : MADRID_CENTER;

  // Compute bbox that includes user + nearest studios (~3km buffer)
  const span = 0.04;
  const minLat = userLoc.lat - span;
  const maxLat = userLoc.lat + span;
  const minLng = userLoc.lng - span;
  const maxLng = userLoc.lng + span;
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  const sorted = [...massages]
    .map((m) => ({ ...m, km: distanceKm(userLoc, m) }))
    .sort((a, b) => a.km - b.km);

  const activeMassage = sorted.find((m) => m.id === active) ?? sorted[0];

  return (
    <div className={cn("flex flex-col", compact ? "" : "flex-1 overflow-hidden bg-secondary")}>
      {/* Permission prompt banner */}
      {geo.status !== "ready" && (
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-2xl bg-card border border-border",
          compact ? "mb-3" : "m-4",
        )}>
          <div className="h-10 w-10 rounded-full bg-gradient-royal flex items-center justify-center flex-shrink-0">
            <LocateFixed className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {geo.status === "loading" ? "Finding you…" : "See studios near you"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {geo.status === "error"
                ? geo.message
                : geo.status === "loading"
                  ? "Allow location access in your browser."
                  : "Allow location to sort studios by distance."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={requestLocation}
            disabled={geo.status === "loading"}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {geo.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Allow"}
          </Button>
        </div>
      )}

      {/* Map */}
      <div
        className={cn(
          "relative overflow-hidden",
          compact ? "h-64 rounded-2xl border border-border" : "flex-1",
        )}
      >
        <iframe
          key={`${userLoc.lat}-${userLoc.lng}`}
          title="Nearby studios map"
          src={mapSrc}
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-foreground/5 pointer-events-none" />

        {/* User pin (only when real location available) */}
        {geo.status === "ready" && (() => {
          const { x, y } = project(geo.lat, geo.lng);
          return <Pin x={x} y={y} variant="user" label="You" />;
        })()}

        {/* Studio pins */}
        {sorted.map((m) => {
          const { x, y } = project(m.lat, m.lng);
          // Skip pins outside visible bbox
          if (x < -2 || x > 102 || y < -2 || y > 102) return null;
          return (
            <Pin
              key={m.id}
              x={x}
              y={y}
              variant={active === m.id ? "active" : "studio"}
              label={m.studio}
              onClick={() => setActive(m.id)}
            />
          );
        })}
      </div>

      {/* Selected studio card */}
      {activeMassage && (
        <button
          onClick={() => onSelect(activeMassage)}
          className={cn(
            "flex gap-3 p-3 rounded-2xl bg-card border border-border shadow-soft text-left hover:border-primary transition",
            compact ? "mt-3" : "m-4",
          )}
        >
          <img
            src={activeMassage.image}
            alt={activeMassage.studio}
            className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-bold text-foreground truncate">{activeMassage.studio}</p>
            <p className="text-xs text-primary font-semibold">{activeMassage.name}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent text-accent" /> {activeMassage.rating}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {activeMassage.duration}m
              </span>
              <span className="flex items-center gap-1 font-semibold text-primary">
                <Navigation className="h-3 w-3" />
                {distanceKm(userLoc, activeMassage).toFixed(1)} km
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Compact: show top 3 nearby list */}
      {compact && (
        <div className="mt-3 space-y-2">
          {sorted.slice(0, 3).map((m, i) => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card hover:border-primary transition text-left"
            >
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{m.studio}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.district} · {m.name}
                </p>
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {m.km.toFixed(1)} km
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pin({
  x,
  y,
  variant,
  label,
  onClick,
}: {
  x: number;
  y: number;
  variant: "user" | "studio" | "active";
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute -translate-x-1/2 -translate-y-full"
      aria-label={label}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full shadow-elegant transition-all",
          variant === "user" && "h-4 w-4 bg-accent ring-4 ring-accent/30",
          variant === "studio" && "h-9 w-9 bg-primary text-primary-foreground hover:scale-110",
          variant === "active" && "h-11 w-11 bg-gradient-gold text-foreground scale-110 ring-4 ring-accent/40",
        )}
      >
        {variant !== "user" && <MapPin className="h-4 w-4 fill-current" />}
      </div>
      {variant === "user" && (
        <span className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-accent-foreground bg-accent rounded px-1.5 py-0.5 whitespace-nowrap">
          You
        </span>
      )}
    </button>
  );
}
