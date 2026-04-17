import { useEffect, useRef, useState } from "react";
import { Massage, MADRID_CENTER, distanceKm } from "../data";
import { loadGoogleMaps, hasGoogleMapsKey, setStoredKey } from "../lib/googleMaps";
import { Star, Clock, Navigation, LocateFixed, Loader2, Search, KeyRound, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  massages: Massage[];
  onSelect: (m: Massage) => void;
  compact?: boolean;
  /** Show Places autocomplete search bar */
  showSearch?: boolean;
};

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; lat: number; lng: number }
  | { status: "error"; message: string };

type StudioWithDistance = Massage & {
  km: number;
  walkingMin?: number;
  walkingText?: string;
};

export default function GoogleMap({ massages, onSelect, compact = false, showSearch = true }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const studioMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [keyConfigured, setKeyConfigured] = useState(hasGoogleMapsKey());
  const [keyInput, setKeyInput] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [active, setActive] = useState<string | null>(massages[0]?.id ?? null);
  const [studios, setStudios] = useState<StudioWithDistance[]>(
    massages.map((m) => ({ ...m, km: distanceKm(MADRID_CENTER, m) })).sort((a, b) => a.km - b.km),
  );

  const userLoc = geo.status === "ready" ? { lat: geo.lat, lng: geo.lng } : MADRID_CENTER;

  // Load Google Maps SDK
  useEffect(() => {
    if (!keyConfigured) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled) return;
        if (g) setMapsReady(true);
        else setMapsError("Failed to load Google Maps.");
      })
      .catch((err) => {
        if (cancelled) return;
        setMapsError(err?.message ?? "Failed to load Google Maps.");
      });
    return () => {
      cancelled = true;
    };
  }, [keyConfigured]);

  // Initialize map
  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return;
    const center = userLoc;
    mapInstance.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      styles: madridMapStyle,
    });
    infoWindowRef.current = new google.maps.InfoWindow();
  }, [mapsReady]);

  // Request geolocation
  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "error", message: "Geolocation isn't supported." });
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeo({ status: "error", message: err.message || "Couldn't get your location." }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  // Auto-prompt geolocation on mount if no key prompt is showing
  useEffect(() => {
    if (keyConfigured && geo.status === "idle") requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyConfigured]);

  // Update user marker + recenter + recompute distances when location changes
  useEffect(() => {
    if (!mapsReady || !mapInstance.current) return;
    const map = mapInstance.current;

    if (geo.status === "ready") {
      map.panTo(userLoc);
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition(userLoc);
      } else {
        userMarkerRef.current = new google.maps.Marker({
          position: userLoc,
          map,
          title: "You",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          },
          zIndex: 999,
        });
      }
    }

    // Recompute distances
    setStudios(
      massages
        .map((m) => ({ ...m, km: distanceKm(userLoc, m) }))
        .sort((a, b) => a.km - b.km),
    );

    // Fetch real walking times via Distance Matrix
    if (geo.status === "ready" && massages.length > 0) {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [userLoc],
          destinations: massages.map((m) => ({ lat: m.lat, lng: m.lng })),
          travelMode: google.maps.TravelMode.WALKING,
          unitSystem: google.maps.UnitSystem.METRIC,
        },
        (resp, status) => {
          if (status !== "OK" || !resp) return;
          const elements = resp.rows[0]?.elements ?? [];
          setStudios((prev) =>
            prev.map((s) => {
              const idx = massages.findIndex((m) => m.id === s.id);
              const el = elements[idx];
              if (el?.status === "OK") {
                return {
                  ...s,
                  walkingMin: Math.round(el.duration.value / 60),
                  walkingText: el.duration.text,
                };
              }
              return s;
            }),
          );
        },
      );
    }
  }, [mapsReady, geo.status, massages]);

  // Render studio markers
  useEffect(() => {
    if (!mapsReady || !mapInstance.current) return;
    const map = mapInstance.current;

    // Clear existing
    studioMarkersRef.current.forEach((m) => m.setMap(null));
    studioMarkersRef.current = [];

    massages.forEach((m) => {
      const isActive = active === m.id;
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        title: m.studio,
        icon: makeMarkerIcon(isActive),
      });
      marker.addListener("click", () => {
        setActive(m.id);
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(buildInfoContent(m));
          infoWindowRef.current.open({ map, anchor: marker });
        }
      });
      studioMarkersRef.current.push(marker);
    });
  }, [mapsReady, massages, active]);

  // Set up Places Autocomplete on the search input
  useEffect(() => {
    if (!mapsReady || !showSearch || !searchRef.current) return;
    const ac = new google.maps.places.Autocomplete(searchRef.current, {
      // Bias to Madrid
      bounds: new google.maps.LatLngBounds(
        { lat: 40.35, lng: -3.85 },
        { lat: 40.5, lng: -3.55 },
      ),
      strictBounds: false,
      fields: ["geometry", "name"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (loc) {
        setGeo({ status: "ready", lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [mapsReady, showSearch]);

  const activeMassage = studios.find((m) => m.id === active) ?? studios[0];

  // ---- Render ----

  // No API key configured yet
  if (!keyConfigured) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center space-y-4">
        <div className="h-12 w-12 mx-auto rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
          <KeyRound className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Connect Google Maps</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Paste your Google Maps API key once to enable the live map, search and walking times.
          </p>
        </div>
        <a
          href="https://console.cloud.google.com/google/maps-apis/start"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Get a key <ExternalLink className="h-3 w-3" />
        </a>
        <div className="flex gap-2">
          <Input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="AIza…"
            className="text-xs"
          />
          <Button
            onClick={() => {
              if (!keyInput.trim().startsWith("AIza")) {
                toast.error("That doesn't look like a Google Maps API key.");
                return;
              }
              setStoredKey(keyInput.trim());
              setKeyConfigured(true);
              toast.success("Key saved. Loading map…");
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Stored in this browser only. Restrict your key to your site's domain in Google Cloud.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", compact ? "" : "flex-1 overflow-hidden")}>
      {/* Search bar */}
      {showSearch && (
        <div className={cn("relative", compact ? "mb-3" : "mx-4 mt-4")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            ref={searchRef}
            placeholder="Where are you? e.g. Atocha, Sol, Gran Vía"
            className="pl-9 h-11 bg-card border-border"
            disabled={!mapsReady}
          />
        </div>
      )}

      {/* Permission / status banner */}
      {geo.status !== "ready" && (
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-2xl bg-card border border-border",
            compact ? "mb-3" : "mx-4 mt-3",
          )}
        >
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
                  : "Allow location for distance & walking times."}
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
          "relative overflow-hidden bg-secondary",
          compact ? "h-72 rounded-2xl border border-border" : "flex-1",
        )}
      >
        {mapsError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive p-4 text-center">
            {mapsError}
          </div>
        )}
        {!mapsReady && !mapsError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
          </div>
        )}
        <div ref={mapRef} className="absolute inset-0" />
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
                {activeMassage.km.toFixed(1)} km
                {activeMassage.walkingText ? ` · ${activeMassage.walkingText} walk` : ""}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Compact: top 3 nearby */}
      {compact && (
        <div className="mt-3 space-y-2">
          {studios.slice(0, 3).map((m, i) => (
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
              <span className="text-xs font-semibold text-primary flex items-center gap-1 whitespace-nowrap">
                <Navigation className="h-3 w-3" />
                {m.walkingText ?? `${m.km.toFixed(1)} km`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Helpers ----

function makeMarkerIcon(active: boolean): google.maps.Icon | google.maps.Symbol {
  // Crimson primary (354, 78%, 36%) → #A21228 ; Gold accent → #E8B130
  return {
    path: "M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z",
    fillColor: active ? "#E8B130" : "#A21228",
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2,
    scale: active ? 1.4 : 1.1,
    anchor: new google.maps.Point(12, 36),
  };
}

function buildInfoContent(m: Massage) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 220px;">
      <img src="${m.image}" alt="" style="width:100%; height:90px; object-fit:cover; border-radius:8px; margin-bottom:8px;" />
      <div style="font-weight:700; font-size:14px; color:#1a0709;">${m.studio}</div>
      <div style="font-size:12px; color:#A21228; font-weight:600;">${m.name}</div>
      <div style="font-size:11px; color:#666; margin-top:4px;">${m.district} · ${m.duration} min · ★ ${m.rating}</div>
    </div>
  `;
}

// Subtle warm map style to match the Madrid palette
const madridMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f6efe1" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b4636" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6efe1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "simplified" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fff7e6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f0d9a8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd4d8" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#e8e0c9" }] },
];
