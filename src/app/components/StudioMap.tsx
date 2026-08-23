/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Compass, Star, Clock, MapPin, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocationAsk, savedLocationResult, originSuffix } from "@/lib/locationConsent";
import { MADRID_CENTER } from "../data";
import { loadGoogleMaps } from "../lib/googleMaps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { fetchShops } from "@/lib/supabase";
import { haversineKm, distanceLabel, walkingDirectionsUrl } from "@/lib/distance";
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

/** Branded clay pin: solid clay circle, white centre dot, white border. */
function brandPin(active: boolean) {
  const size = active ? 34 : 28;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${active ? "#E0A458" : "#C4622D"}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 7}" fill="#ffffff"/>
      </svg>`
    )}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
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
  const { t, i18n } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);

  const [ownShops, setOwnShops] = useState<Shop[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<Shop | null>(null);
  // Tap-to-locate feedback: the chip must never look dead.
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  // Set when the visitor picked a neighbourhood instead of sharing location.
  const [areaName, setAreaName] = useState<string | null>(null);
  const askLocation = useLocationAsk();

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

  /**
   * Soft-ask only. The native prompt is never fired from here without the
   * visitor first tapping through our own sheet.
   */
  const requestUserLocation = () => {
    setGeoError(false);
    setLocating(true);
    askLocation((res) => {
      setLocating(false);
      if (!res) {
        onGeoStateChange?.("fallback");
        return;
      }
      setUserLoc(res.loc);
      setAreaName(res.areaName);
      onUserLocation?.(res.loc);
      onGeoStateChange?.("ready");
    });
  };

  // Use a remembered choice on mount; never prompt cold.

  useEffect(() => {
    onGeoStateChange?.("pending");
    const saved = savedLocationResult();
    if (saved) {
      setUserLoc(saved.loc);
      setAreaName(saved.areaName);
      onUserLocation?.(saved.loc);
      onGeoStateChange?.("ready");
    } else {
      onGeoStateChange?.("fallback");
    }
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

      clustererRef.current?.clearMarkers();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      mapShops.forEach((m: any) => {
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          title: m.studio,
          icon: brandPin(false),
        });
        marker.addListener("click", () => {
          markersRef.current.forEach((mr) => mr.setIcon(brandPin(false)));
          marker.setIcon(brandPin(true));
          setSelected(m as Shop);
          map.panTo({ lat: m.lat, lng: m.lng });
          if (!showSelectedCard) onSelect?.(m as Shop);
        });
        markersRef.current.push(marker);
      });

      if (!clustererRef.current) {
        clustererRef.current = new MarkerClusterer({
          map,
          renderer: {
            render: ({ count, position }) =>
              new google.maps.Marker({
                position,
                zIndex: 1000 + count,
                label: {
                  text: String(count),
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "700",
                },
                icon: {
                  url: `data:image/svg+xml,${encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="20" fill="#C4622D" stroke="#ffffff" stroke-width="3"/>
                    </svg>`
                  )}`,
                  scaledSize: new google.maps.Size(44, 44),
                  anchor: new google.maps.Point(22, 22),
                  labelOrigin: new google.maps.Point(22, 22),
                },
              }),
          },
        });
      }
      clustererRef.current.addMarkers(markersRef.current);


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
          type="button"
          onClick={() => requestUserLocation()}
          aria-live="polite"
          className="absolute top-3 left-3 flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full pl-3 pr-4 py-1.5 shadow-soft border border-border/60 hover:bg-card transition"
        >
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
            {locating ? (
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
            ) : (
              <Compass className="h-3 w-3 text-primary" />
            )}
          </div>
          <span className="text-[10px] font-bold tracking-[0.14em] text-foreground uppercase">
            {locating
              ? t("app.massageList.locating", "Locating you…")
              : userLoc
              ? t("app.massageList.yourLocation")
              : t("app.massageList.nearMadrid")}
          </span>
        </button>
        {geoError && (
          <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-card/95 backdrop-blur-sm border border-border/60 px-3 py-2 shadow-soft">
            <p className="text-[11px] text-muted-foreground">
              {t("app.massageList.geoError", "We could not get your location. Showing studios around central Madrid.")}
            </p>
          </div>
        )}
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
              {userLoc && typeof selected.lat === "number" && typeof selected.lng === "number" && (() => {
                const lang: "en" | "es" = i18n.language?.startsWith("es") ? "es" : "en";
                const km = haversineKm(userLoc, selected as any);
                const dirUrl = walkingDirectionsUrl(selected as any, `${selected.studio} Madrid`, userLoc);
                return (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                    <span>{distanceLabel(km, lang)} {areaName ? originSuffix(areaName, lang) : ""}</span>
                    {dirUrl && (
                      <a
                        href={dirUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-semibold hover:underline"
                      >
                        Directions / Cómo llegar
                      </a>
                    )}
                  </p>
                );
              })()}
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
