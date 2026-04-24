import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, MapPin, Clock, List, Map as MapIcon, Compass, Sparkles, Play, Navigation, Loader2, LocateFixed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MASSAGES, MASSAGE_TYPES, MassageType, MADRID_CENTER, distanceKm } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";
import { loadGoogleMaps } from "../lib/googleMaps";

type Tab = "list" | "map";

const STUDIO_ICONS: Record<string, string> = {
  "Casa Cibeles": "🧖‍♀️",
  "El Retiro Wellness": "💆",
  "Salamanca Spa Real": "🔥",
  "Chamberí Manos": "🏃",
  "Malasaña Holístico": "🪷",
  "La Latina Termas": "🌊",
};

function getStudioIcon(studio: string): string {
  for (const [key, icon] of Object.entries(STUDIO_ICONS)) {
    if (studio.includes(key.split(" ")[0])) return icon;
  }
  return "💆";
}

export default function MassageList() {
  const navigate = useNavigate();
  const { set } = useBooking();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("map"); // default to map
  const [typeFilter, setTypeFilter] = useState<MassageType | "all">("all");
  const [selectedStudio, setSelectedStudio] = useState<typeof MASSAGES[0] | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  const filtered = MASSAGES
    .filter((m) => {
      const matchesQ =
        m.name.toLowerCase().includes(q.toLowerCase()) ||
        m.studio.toLowerCase().includes(q.toLowerCase()) ||
        m.district.toLowerCase().includes(q.toLowerCase());
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      return matchesQ && matchesType;
    })
    .map((m) => ({ ...m, km: distanceKm(MADRID_CENTER, m) }))
    .sort((a, b) => a.km - b.km);

  // Initialize map
  useEffect(() => {
    if (tab !== "map" || !mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then((g) => {
      if (cancelled || !g || !mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: MADRID_CENTER,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f6efe1" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#5b4636" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#f6efe1" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd4d8" }] },
        ],
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      // User location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setGeoReady(true);
            if (userMarkerRef.current) userMarkerRef.current.setPosition(loc);
            if (!userMarkerRef.current) {
              userMarkerRef.current = new google.maps.Marker({
                position: loc,
                map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#4285F4",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 3,
                },
                zIndex: 999,
              });
            }
            map.panTo(loc);
          },
          () => setGeoReady(true)
        );
      } else {
        setGeoReady(true);
      }

      // Studio markers
      const iconSvg = (emoji: string, active: boolean) => {
        const size = active ? 56 : 44;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${active ? "#E8B130" : "#A21228"}" stroke="white" stroke-width="3"/>
              <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${active ? 28 : 22}">${emoji}</text>
            </svg>`
          )}`,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        };
      };

      MASSAGES.forEach((m) => {
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          title: m.studio,
          icon: iconSvg(getStudioIcon(m.studio), false),
          animation: google.maps.Animation.DROP,
        });

        marker.addListener("click", () => {
          // Highlight selected
          markersRef.current.forEach((mr: any) => {
            mr.setIcon(iconSvg(getStudioIcon(mr.getTitle() ?? ""), false));
          });
          marker.setIcon(iconSvg(getStudioIcon(m.studio), true));
          setSelectedStudio(m);
          map.panTo({ lat: m.lat, lng: m.lng });

          infoWindowRef.current.setContent(buildInfoContent(m, navigate));
          infoWindowRef.current.open({ map, anchor: marker });
        });

        markersRef.current.push(marker);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const handleBook = (m: typeof MASSAGES[0]) => {
    set({ massageId: m.id });
    navigate(`/massages/${m.id}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 bg-card border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">Madrid</p>
            <h1 className="font-display text-2xl font-bold text-foreground mt-1">Find your escape</h1>
          </div>
          <button
            onClick={() => navigate("/discovery")}
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-gradient-gold text-foreground text-xs font-semibold shadow-gold hover:opacity-90 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Discover
          </button>
        </div>

        {/* Quiz CTA */}
        <button
          onClick={() => navigate("/discovery/quiz")}
          className="mt-4 w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-royal text-primary-foreground hover:opacity-90 transition group"
        >
          <div className="h-12 w-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold">Not sure which massage you need?</p>
            <p className="text-xs text-primary-foreground/80 mt-0.5">Take the 30-second quiz →</p>
          </div>
          <Play className="h-5 w-5 group-hover:translate-x-0.5 transition" />
        </button>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search studios, neighborhoods…"
            className="pl-9 h-11 bg-background"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-2 overflow-x-auto pt-3 -mx-6 px-6 pb-1">
          <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All</FilterChip>
          {MASSAGE_TYPES.map((t) => (
            <FilterChip key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>
              {t.name}
            </FilterChip>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-3 grid grid-cols-2 bg-secondary rounded-full p-1">
          <button
            onClick={() => setTab("list")}
            className={cn("flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold transition", tab === "list" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground")}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setTab("map")}
            className={cn("flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-semibold transition", tab === "map" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground")}
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
              onClick={() => handleBook(m)}
              className="w-full text-left rounded-2xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant transition-all"
            >
              <div className="relative h-40">
                <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/95 rounded-full px-2 py-1 text-xs font-semibold">
                  <Star className="h-3 w-3 fill-accent text-accent" /> {m.rating}
                </div>
                <div className="absolute bottom-3 left-3">
                  <h3 className="font-display text-xl font-bold text-primary-foreground">{m.name}</h3>
                  <p className="text-sm text-primary-foreground/90">{m.studio}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.district}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.duration} min</span>
                <span>{m.reviews} reviews</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No matches. Try another search.</p>}
        </div>
      ) : (
        <div className="flex-1 relative flex flex-col">
          {/* Map */}
          <div ref={mapRef} className="flex-1" />

          {/* Selected studio bottom sheet */}
          {selectedStudio && (
            <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl shadow-2xl p-5 animate-slide-up">
              <div className="flex gap-3">
                <img src={selectedStudio.image} alt={selectedStudio.studio} className="h-20 w-20 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-base font-bold text-foreground">{selectedStudio.studio}</p>
                      <p className="text-xs text-primary font-semibold">{selectedStudio.name}</p>
                    </div>
                    <button onClick={() => setSelectedStudio(null)} className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">×</button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {selectedStudio.rating} ({selectedStudio.reviews})</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {selectedStudio.duration}m</span>
                    <span className="flex items-center gap-1 font-semibold text-primary"><Navigation className="h-3 w-3" /> {selectedStudio.km?.toFixed(1)} km</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleBook(selectedStudio)}
                      className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                    >
                      Book now →
                    </button>
                    <button
                      onClick={() => navigate(`/massages/${selectedStudio.id}`)}
                      className="h-9 px-4 rounded-xl bg-secondary text-foreground text-xs font-semibold"
                    >
                      More info
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-3 right-3 bg-card/95 rounded-xl px-3 py-2 shadow-soft">
            <p className="text-xs text-muted-foreground font-semibold">
              {filtered.length} studio{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition", active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50")}
    >
      {children}
    </button>
  );
}

function buildInfoContent(m: (typeof MASSAGES)[0], navigate: any) {
  return `
    <div style="font-family: system-ui; max-width: 220px; padding: 4px;">
      <img src="${m.image}" alt="" style="width:100%; height:80px; object-fit:cover; border-radius:10px; margin-bottom:8px;" />
      <div style="font-weight:700; font-size:13px; color:#1a0709;">${m.studio}</div>
      <div style="font-size:11px; color:#A21228; font-weight:600; margin-bottom:4px;">${m.name}</div>
      <div style="font-size:11px; color:#666;">📍 ${m.district} · ${m.duration} min · ★ ${m.rating}</div>
    </div>
  `;
}
