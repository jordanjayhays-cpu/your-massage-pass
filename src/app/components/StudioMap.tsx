/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Compass, Star, Clock, MapPin, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useLocationAsk,
  savedLocationResult,
  originSuffix,
  locationChoiceMade,
  locationSheetAutoShown,
  markLocationSheetAutoShown,
} from "@/lib/locationConsent";
import { MADRID_CENTER } from "../data";
import { loadGoogleMaps } from "../lib/googleMaps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { fetchShops } from "@/lib/supabase";
import { haversineKm, distanceLabel, walkingDirectionsUrl } from "@/lib/distance";
import type { Shop } from "@/lib/supabase";
import CompareToggle from "./CompareToggle";

export type GeoState = "pending" | "ready" | "fallback";

/** Stable key for a studio across list and map. */
export function studioKey(s: any): string {
  return String(s?.slug || s?.partner_id || s?.id || "");
}

export type MapBounds = { north: number; south: number; east: number; west: number };

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
  /** On phones, open the branded location sheet once per session shortly after load. */
  autoAskOnMobile?: boolean;
  /** Studio key highlighted from the list (desktop hover sync). */
  highlightedKey?: string | null;
  /** Fired when a pin is hovered or left, so the list can highlight its card. */
  onHoverStudio?: (key: string | null) => void;
  /** Enables the "Search this area" chip and reports the visible bounds. */
  onSearchArea?: (bounds: MapBounds) => void;
};

/** Branded clay pin: solid clay circle, white centre dot, white border. */
function brandPin(active: boolean, visited = false) {
  const size = active ? 34 : 28;
  const fill = active ? "#E0A458" : "#C4622D";
  return {
    url: `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" opacity="${visited && !active ? 0.45 : 1}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 7}" fill="#ffffff"/>
      </svg>`
    )}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

/** Airbnb-style price pill: white with clay text, inverted when active. */
function pricePin(price: number, active: boolean, visited = false) {
  const text = `€${Math.round(price)}`;
  const scale = active ? 1.12 : 1;
  const w = Math.round((26 + text.length * 9) * scale);
  const h = Math.round(28 * scale);
  const bg = active ? "#C4622D" : "#FFFFFF";
  const fg = active ? "#FFFFFF" : "#C4622D";
  return {
    url: `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" opacity="${visited && !active ? 0.5 : 1}">
        <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${(h - 2) / 2}" fill="${bg}" stroke="#C4622D" stroke-width="1.6"/>
        <text x="${w / 2}" y="${h / 2 + 4}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${Math.round(12 * scale)}" font-weight="700" fill="${fg}">${text}</text>
      </svg>`
    )}`,
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h / 2),
  };
}

/** Cheapest 60 minute massage the studio offers, or null. */
function lowest60Price(shop: any): number | null {
  const list: any[] = shop?.partner_services || [];
  const prices = list
    .filter((s) => Number(s?.duration) === 60 && Number.isFinite(Number(s?.price)) && Number(s.price) > 0)
    .map((s) => Number(s.price));
  return prices.length ? Math.min(...prices) : null;
}

/** Price pills only make sense once the map is zoomed into a neighbourhood. */
const PRICE_ZOOM = 14;



/**
 * Paper-like brand basemap: warm cream ground, very muted roads, soft
 * gray-brown labels. Google's own POI and transit pins are hidden so the
 * only markers on the map are our studios. Street and area names stay.
 */
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#EEEAE4" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A7C6D" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F6F2EC" }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#DED7CD" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#9A8B7A" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#E9E4DC" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#DFE3D4" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#F7F4EF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E3DCD1" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9C8E7E" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#F4F0E8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#EFE7DA" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#CFDCDD" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#A0AFB0" }] },
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
  autoAskOnMobile = false,
  highlightedKey = null,
  onHoverStudio,
  onSearchArea,
}: Props) {
  const { t, i18n } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markersByKeyRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const didFitRef = useRef(false);
  const hoverCbRef = useRef<Props["onHoverStudio"]>(onHoverStudio);
  hoverCbRef.current = onHoverStudio;

  const [ownShops, setOwnShops] = useState<Shop[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<Shop | null>(null);
  // Tap-to-locate feedback: the chip must never look dead.
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  // Set when the visitor picked a neighbourhood instead of sharing location.
  const [areaName, setAreaName] = useState<string | null>(null);
  // Price pills replace dots once the map is zoomed in.
  const [closeZoom, setCloseZoom] = useState(false);
  // "Search this area" appears once the visitor moves the map themselves.
  const [moved, setMoved] = useState(false);
  const [ownHoverKey, setOwnHoverKey] = useState<string | null>(null);
  const askLocation = useLocationAsk();
  const activeKey = highlightedKey || ownHoverKey || (selected ? studioKey(selected) : null);


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

  /**
   * All devices: open our branded sheet once per session, about a second in,
   * so the page has settled first.
   */
  useEffect(() => {
    if (!autoAskOnMobile) return;
    if (locationChoiceMade() || locationSheetAutoShown()) return;

    const timer = window.setTimeout(() => {
      if (locationChoiceMade() || locationSheetAutoShown()) return;
      markLocationSheetAutoShown();
      requestUserLocation();
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAskOnMobile]);

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

      // Zoom and pan listeners: price pills at close zoom, "Search this area"
      // once the visitor moves the map themselves.
      if (!(map as any).__mcListeners) {
        (map as any).__mcListeners = true;
        const syncZoom = () => setCloseZoom((map.getZoom() ?? 13) >= PRICE_ZOOM);
        syncZoom();
        map.addListener("zoom_changed", () => {
          syncZoom();
          setMoved(true);
        });
        map.addListener("dragend", () => setMoved(true));
      }

      clustererRef.current?.clearMarkers();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      markersByKeyRef.current = new Map();

      mapShops.forEach((m: any) => {
        const key = studioKey(m);
        const price = lowest60Price(m);
        const visited = isStudioVisited(m.slug, m.partner_id, m.id);
        const iconFor = (active: boolean) =>
          closeZoom && price != null ? pricePin(price, active, visited) : brandPin(active, visited);
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          title: m.studio,
          icon: iconFor(false),
        });
        (marker as any).__mcIconFor = iconFor;
        marker.addListener("click", () => {
          setSelected(m as Shop);
          setOwnHoverKey(key);
          map.panTo({ lat: m.lat, lng: m.lng });
          if (!showSelectedCard) onSelect?.(m as Shop);
        });
        marker.addListener("mouseover", () => {
          setOwnHoverKey(key);
          hoverCbRef.current?.(key);
        });
        marker.addListener("mouseout", () => {
          setOwnHoverKey(null);
          hoverCbRef.current?.(null);
        });
        markersRef.current.push(marker);
        markersByKeyRef.current.set(key, marker);
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

      // Default view: frame all studio pins so clusters read as a few tidy
      // bubbles. Once we know where the visitor is, we centre on them instead.
      if (userLoc) {
        map.setCenter(userLoc);
        map.setZoom(14);
      } else if (!didFitRef.current && mapShops.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        mapShops.forEach((m: any) => bounds.extend({ lat: m.lat, lng: m.lng }));
        map.fitBounds(bounds, 24);
        google.maps.event.addListenerOnce(map, "idle", () => {
          const z = map.getZoom() ?? 13;
          // Outlying studios must not pull the default view out to the region.
          if (z > 14) map.setZoom(14);
          if (z < 12) {
            map.setZoom(12);
            map.setCenter(MADRID_CENTER);
          }
        });
        didFitRef.current = true;
      }


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
  }, [allShops, userLoc, closeZoom]);

  // Keep pin styling in sync with whatever is highlighted (card hover, pin
  // hover, or the selected studio) without rebuilding every marker.
  useEffect(() => {
    markersByKeyRef.current.forEach((marker, key) => {
      const iconFor = (marker as any).__mcIconFor as ((active: boolean) => any) | undefined;
      if (!iconFor) return;
      const active = key === activeKey;
      marker.setIcon(iconFor(active));
      marker.setZIndex(active ? 5000 : 1);
    });
  }, [activeKey, closeZoom, allShops]);


  return (
    <div>
      {heading && (
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">{heading}</h3>
      )}
      <div className={`relative rounded-3xl overflow-hidden shadow-soft ring-1 ring-border/70 border border-border/60 bg-[#EEEAE4] ${heightClass}`}>
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
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onSelect?.(selected)}
                  className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide uppercase shadow-soft hover:opacity-90 transition"
                >
                  {t("app.massageList.bookNow")}
                </button>
                <CompareToggle studio={selected as any} size="sm" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
