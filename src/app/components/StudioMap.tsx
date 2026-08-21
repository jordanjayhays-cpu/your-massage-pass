/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Compass, Star, Clock, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MADRID_CENTER } from "../data";
import { loadGoogleMaps } from "../lib/googleMaps";
import { fetchShops } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";

export type GeoState = "pending" | "ready" | "fallback";

type Props = {
  /** Studios to plot. When omitted, the map loads every studio itself. */
  shops?: Shop[];
  /** Tailwind height class for the map canvas. */
  heightClass?: string;
  /** Optional heading rendered above the map. */
  heading?: string;
  /** Show the selected-studio card beneath the map. */
  showSelectedCard?: boolean;
  /** Called when a marker (or the card CTA) is used to open a studio. */
  onSelect?: (shop: Shop) => void;
  /** Reports real-location vs. Madrid-fallback state. */
  onGeoStateChange?: (state: GeoState) => void;
  /** Reports the resolved user location (for distance sorting in parents). */
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
};

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

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f6efe1" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b4636" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6efe1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd4d8" }] },
];

/**
 * The single studio map used by every tab (/studios and /discovery).
 * Owns geolocation (with a 3s central-Madrid fallback) and marker rendering.
 */
export default function StudioMap({
  shops,
  heightClass = "h-[230px]",
  heading,
  showSelectedCard = true,
  onSelect,
  onGeoStateChange,
  onUserLocation,
}: Props) {
  const { t } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);

  const [ownShops, setOwnShops] = useState<Shop[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<Shop | null>(null);

  const allShops = shops ?? ownShops;
  const mapShops = allShops.filter(
    (m: any) => m && typeof m.lat === "number" && typeof m.lng === "number"
  );

  // Load studios when the parent doesn't supply them.
  useEffect(() => {
    if (shops) return;
    let cancelled = false;
    fetchShops().then((list) => {
      if (!cancelled) setOwnShops(list);
    });
    return () => { cancelled = true; };
  }, [shops]);

  const requestUserLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onGeoStateChange?.("fallback");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        onUserLocation?.(loc);
        onGeoStateChange?.("ready");
      },
      () => onGeoStateChange?.("fallback"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Ask once on mount, fall back to central Madrid after ~3s.
  useEffect(() => {
    onGeoStateChange?.("pending");
    requestUserLocation();
    const timer = window.setTimeout(() => {
      setUserLoc((cur) => {
        if (!cur) onGeoStateChange?.("fallback");
        return cur;
      });
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render map + markers
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;

      const map =
        mapInstanceRef.current ??
        new google.maps.Map(mapRef.current, {
          center: userLoc ?? MADRID_CENTER,
          zoom: userLoc ? 14 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          styles: MAP_STYLES,
        });
      mapInstanceRef.current = map;
      if (userLoc) map.setCenter(userLoc);

      const iconSvg = (emoji: string, active: boolean) => {
        const size = active ? 52 : 42;
        return {
          url: `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${active ? "#E0A458" : "#C4622D"}" stroke="white" stroke-width="3"/>
              <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${active ? 26 : 20}">${emoji}</text>
            </svg>`
          )}`,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        };
      };

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      mapShops.forEach((m: any) => {
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          title: m.studio,
          icon: iconSvg(getStudioIcon(m.studio), false),
        });
        marker.addListener("click", () => {
          markersRef.current.forEach((mr) =>
            mr.setIcon(iconSvg(getStudioIcon(mr.getTitle() ?? ""), false))
          );
          marker.setIcon(iconSvg(getStudioIcon(m.studio), true));
          setSelected(m as Shop);
          map.panTo({ lat: m.lat, lng: m.lng });
          if (!showSelectedCard) onSelect?.(m as Shop);
        });
        markersRef.current.push(marker);
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (userLoc) {
        userMarkerRef.current = new google.maps.Marker({
          position: userLoc,
          map,
          title: t("app.massageList.youAreHere"),
          zIndex: 9999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShops, userLoc]);

  return (
    <div>
      {heading && (
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">{heading}</h3>
      )}
      <div className={`relative rounded-3xl overflow-hidden shadow-soft border border-border/60 ${heightClass}`}>
        <div ref={mapRef} className="absolute inset-0" />
        <button
          onClick={() => { if (!userLoc) requestUserLocation(); }}
          className="absolute top-3 left-3 flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full pl-3 pr-4 py-1.5 shadow-soft border border-border/60 hover:bg-card transition"
        >
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
            <Compass className="h-3 w-3 text-primary" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.14em] text-foreground uppercase">
            {userLoc ? t("app.massageList.yourLocation") : t("app.massageList.nearMadrid")}
          </span>
        </button>
      </div>

      {showSelectedCard && selected && (
        <div className="mt-3 bg-card border border-border rounded-3xl shadow-elegant p-4">
          <div className="flex gap-3">
            {selected.image && (
              <img src={selected.image} alt={selected.studio} className="h-20 w-20 rounded-2xl object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground leading-tight">{selected.studio}</p>
                  <p className="text-xs text-primary font-semibold mt-0.5">{selected.name}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                {selected.rating != null && (
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {selected.rating}</span>
                )}
                {selected.duration != null && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {selected.duration}{t("app.massageList.minutesShort")}</span>
                )}
                {selected.district && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selected.district}</span>
                )}
              </div>
              <button
                onClick={() => onSelect?.(selected)}
                className="mt-3 h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide uppercase shadow-soft hover:opacity-90 transition"
              >
                {t("app.massageList.bookNow")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
