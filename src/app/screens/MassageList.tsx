import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, MapPin, Heart, SlidersHorizontal, Compass, UserCircle, Clock, X, Navigation } from "lucide-react";
import { MASSAGES, MASSAGE_TYPES, MassageType, MADRID_CENTER, distanceKm } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";
import { loadGoogleMaps } from "../lib/googleMaps";
import { fetchShops, supabase } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";

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
  const [typeFilter, setTypeFilter] = useState<MassageType | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [realShops, setRealShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedStudio, setSelectedStudio] = useState<Shop | typeof MASSAGES[0] | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const fullMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const fullMarkersRef = useRef<any[]>([]);

  useEffect(() => {
    fetchShops().then((shops) => {
      setRealShops(shops);
      setShopsLoading(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data?.avatar_url) setAvatarUrl(data.avatar_url);
    })();
    return () => { cancelled = true; };
  }, []);

  const allShops: (Shop | typeof MASSAGES[0])[] = [...realShops, ...MASSAGES];

  const filtered = allShops
    .filter((m) => {
      if (!m || !m.name || !m.studio) return false;
      const query = q.toLowerCase();
      const matchesQ =
        m.name.toLowerCase().includes(query) ||
        m.studio.toLowerCase().includes(query) ||
        ("district" in m && m.district?.toLowerCase().includes(query));
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      return matchesQ && matchesType;
    })
    .map((m) => ({
      ...m,
      km: "km" in m ? m.km : distanceKm(MADRID_CENTER, m as typeof MASSAGES[0]),
    }))
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));

  const mapShops = [...realShops, ...MASSAGES].filter(
    (m: any) => m && typeof m.lat === "number" && typeof m.lng === "number"
  );

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
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

      const iconSvg = (emoji: string) => ({
        url: `data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="20" fill="#C4622D" stroke="white" stroke-width="3"/>
            <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="22">${emoji}</text>
          </svg>`
        )}`,
        scaledSize: new google.maps.Size(44, 44),
        anchor: new google.maps.Point(22, 22),
      });

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      mapShops.forEach((m) => {
        const marker = new google.maps.Marker({
          position: { lat: (m as any).lat, lng: (m as any).lng },
          map,
          title: m.studio,
          icon: iconSvg(getStudioIcon(m.studio)),
        });
        marker.addListener("click", () => {
          handleBook(m as Shop);
        });
        markersRef.current.push(marker);
      });
    });

    return () => { cancelled = true; };
  }, [realShops]);

  // Initialize the FULL Madrid map inside the modal when opened
  useEffect(() => {
    if (!mapOpen || !fullMapRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then((g) => {
      if (cancelled || !g || !fullMapRef.current) return;

      const map = new google.maps.Map(fullMapRef.current, {
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

      const iconSvg = (emoji: string, active: boolean) => {
        const size = active ? 56 : 44;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${active ? "#E0A458" : "#C4622D"}" stroke="white" stroke-width="3"/>
              <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${active ? 28 : 22}">${emoji}</text>
            </svg>`
          )}`,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        };
      };

      fullMarkersRef.current.forEach((m) => m.setMap(null));
      fullMarkersRef.current = [];

      mapShops.forEach((m) => {
        const marker = new google.maps.Marker({
          position: { lat: (m as any).lat, lng: (m as any).lng },
          map,
          title: m.studio,
          icon: iconSvg(getStudioIcon(m.studio), false),
          animation: google.maps.Animation.DROP,
        });
        marker.addListener("click", () => {
          fullMarkersRef.current.forEach((mr: any) => {
            mr.setIcon(iconSvg(getStudioIcon(mr.getTitle() ?? ""), false));
          });
          marker.setIcon(iconSvg(getStudioIcon(m.studio), true));
          setSelectedStudio(m);
          map.panTo({ lat: (m as any).lat, lng: (m as any).lng });
        });
        fullMarkersRef.current.push(marker);
      });
    });

    return () => { cancelled = true; };
  }, [mapOpen, realShops]);

  const handleBook = (m: Shop | typeof MASSAGES[0]) => {
    if ("partner_id" in m && (m as Shop).partner_id) {
      navigate(`/s/${(m as Shop).partner_id}`);
      return;
    }
    set({ massageId: m.id, shop: m });
    navigate(`/massages/${m.id}`);
  };

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Top utility bar */}
      <div className="px-5 pt-5 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/app/profile")}
          aria-label="Profile"
          className="h-10 w-10 rounded-full overflow-hidden bg-card border border-border flex items-center justify-center hover:border-primary/50 transition shadow-soft"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={() => navigate("/partner/dashboard")}
          className="h-10 px-4 rounded-full bg-card border border-border text-foreground text-xs font-semibold tracking-wide hover:border-primary/50 transition shadow-soft"
        >
          Switch to Partner Dashboard →
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 bg-card rounded-full shadow-soft border border-border/60 pl-5 pr-2 h-14">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search studios or area…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setShowFilters((s) => !s)}
            aria-label="Filters"
            className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-5 px-5">
            <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All</FilterChip>
            {MASSAGE_TYPES.map((t) => (
              <FilterChip key={t.id} active={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>
                {t.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* Map card */}
      <div className="px-5 pt-5">
        <div className="relative rounded-3xl overflow-hidden shadow-soft border border-border/60 h-[220px]">
          <div ref={mapRef} className="absolute inset-0" />
          <button
            onClick={() => setMapOpen(true)}
            className="absolute top-4 left-4 group"
            aria-label="Open full Madrid map"
          >
            <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full pl-3 pr-4 py-2 shadow-soft border border-border/60 group-hover:border-primary/60 transition">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Compass className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-bold tracking-[0.14em] text-foreground uppercase">Madrid map view</span>
            </div>
          </button>
          <button
            onClick={() => setMapOpen(true)}
            aria-label="Expand map"
            className="absolute inset-0"
          />
        </div>
      </div>

      {/* Studios list */}
      <div className="px-5 pt-7 pb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">Studios near you</h2>
          <span className="text-xs font-bold tracking-[0.12em] text-primary uppercase">{filtered.length} found</span>
        </div>

        <div className="space-y-4">
          {shopsLoading ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Loading studios…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No matches. Try another search.</p>
          ) : (
            filtered.map((m) => {
              const isFav = favorites.has(m.id);
              return (
                <div
                  key={m.id}
                  className="w-full bg-card border border-border/60 rounded-3xl p-3 shadow-soft hover:shadow-elegant transition-all cursor-pointer"
                  onClick={() => handleBook(m)}
                >
                  <div className="flex gap-3">
                    <div className="relative h-[110px] w-[110px] rounded-2xl overflow-hidden flex-shrink-0 bg-secondary">
                      {m.image && (
                        <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFav(m.id); }}
                        aria-label="Favorite"
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/95 flex items-center justify-center shadow-soft hover:scale-105 transition"
                      >
                        <Heart className={cn("h-3.5 w-3.5", isFav ? "fill-primary text-primary" : "text-foreground")} />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-lg font-semibold text-foreground leading-tight truncate">
                          {m.studio}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Star className="h-4 w-4 fill-accent text-accent" />
                          <span className="text-sm font-semibold text-foreground">{m.rating}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{"district" in m && m.district ? m.district : "Madrid"}</span>
                      </div>

                      <p className="text-xs text-foreground/80 mt-2 truncate">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground"> · {m.duration} min</span>
                        {"price" in m && (m as any).price != null && (
                          <span className="font-semibold text-primary"> · €{(m as any).price}</span>
                        )}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
                          Pay at studio
                        </span>
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                          Available today
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Full Madrid map modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 border-b border-border/60 bg-card">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Compass className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-display text-lg text-foreground leading-none">Madrid</p>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-0.5">Map view</p>
              </div>
            </div>
            <button
              onClick={() => { setMapOpen(false); setSelectedStudio(null); }}
              aria-label="Close map"
              className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 relative">
            <div ref={fullMapRef} className="absolute inset-0" />

            {selectedStudio && (
              <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl shadow-2xl p-5">
                <div className="flex gap-3">
                  {selectedStudio.image && (
                    <img src={selectedStudio.image} alt={selectedStudio.studio} className="h-20 w-20 rounded-2xl object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-semibold text-foreground leading-tight">{selectedStudio.studio}</p>
                        <p className="text-xs text-primary font-semibold mt-0.5">{selectedStudio.name}</p>
                      </div>
                      <button onClick={() => setSelectedStudio(null)} className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">×</button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {selectedStudio.rating}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {selectedStudio.duration}m</span>
                      {"district" in selectedStudio && selectedStudio.district && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedStudio.district}</span>
                      )}
                    </div>
                    <button
                      onClick={() => { setMapOpen(false); handleBook(selectedStudio); }}
                      className="mt-3 h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide uppercase shadow-soft hover:opacity-90 transition"
                    >
                      Book now →
                    </button>
                  </div>
                </div>
              </div>
            )}
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
      className={cn(
        "flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"
      )}
    >
      {children}
    </button>
  );
}
