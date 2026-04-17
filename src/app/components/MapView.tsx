import { Massage, MADRID_CENTER, distanceKm } from "../data";
import { MapPin, Star, Clock, Navigation } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  massages: (Massage & { km?: number })[];
  onSelect: (m: Massage) => void;
};

/**
 * Lightweight, dependency-free map view.
 * Uses an OpenStreetMap static tile background centered on Madrid and
 * positions custom pins by projecting lat/lng onto the visible bbox.
 */
export default function MapView({ massages, onSelect }: Props) {
  const [active, setActive] = useState<string | null>(massages[0]?.id ?? null);

  // Bounding box around Madrid center (~3km radius visible)
  const span = 0.04; // degrees
  const minLat = MADRID_CENTER.lat - span;
  const maxLat = MADRID_CENTER.lat + span;
  const minLng = MADRID_CENTER.lng - span;
  const maxLng = MADRID_CENTER.lng + span;

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  const activeMassage = massages.find((m) => m.id === active) ?? massages[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-secondary">
      <div className="relative flex-1 overflow-hidden">
        <iframe
          title="Madrid map"
          src={mapSrc}
          className="absolute inset-0 w-full h-full border-0 pointer-events-none"
          loading="lazy"
        />
        {/* Subtle overlay for legibility */}
        <div className="absolute inset-0 bg-foreground/5 pointer-events-none" />

        {/* User location pin */}
        <Pin x={50} y={50} variant="user" label="You" />

        {/* Studio pins */}
        {massages.map((m) => {
          const { x, y } = project(m.lat, m.lng);
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
          className="m-4 flex gap-3 p-3 rounded-2xl bg-card border border-border shadow-elegant text-left hover:border-primary transition"
        >
          <img
            src={activeMassage.image}
            alt={activeMassage.studio}
            className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-bold text-foreground truncate">{activeMassage.studio}</p>
            <p className="text-xs text-primary font-semibold">{activeMassage.name}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent text-accent" /> {activeMassage.rating}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {activeMassage.duration}m
              </span>
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {distanceKm(MADRID_CENTER, activeMassage).toFixed(1)} km
              </span>
            </div>
          </div>
        </button>
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
      className="absolute -translate-x-1/2 -translate-y-full group"
      aria-label={label}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full shadow-elegant transition-all",
          variant === "user" && "h-4 w-4 bg-blue-500 ring-4 ring-blue-500/30",
          variant === "studio" && "h-9 w-9 bg-primary text-primary-foreground hover:scale-110",
          variant === "active" && "h-11 w-11 bg-gradient-gold text-foreground scale-110 ring-4 ring-accent/40",
        )}
      >
        {variant !== "user" && <MapPin className="h-4 w-4 fill-current" />}
      </div>
      {variant === "user" && (
        <span className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-600 bg-background/90 rounded px-1.5 py-0.5">
          You
        </span>
      )}
    </button>
  );
}
