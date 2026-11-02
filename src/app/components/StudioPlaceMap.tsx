/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMaps } from "../lib/googleMaps";

/**
 * The studio's real place, for studio pages without their own photos
 * (165 of 166 listed studios on 2 Nov 2026). One pin on a small map.
 *
 * - Loads Google Maps only after first paint, when the box is near the
 *   viewport and the browser is idle, so it never delays the page.
 * - Until the map is ready, and whenever Maps fails (no key, blocked,
 *   referrer refused, offline), the box shows a pin with the address. Never a
 *   stock or Google Places photo: those are not this studio.
 */

type Props = {
  lat?: number | null;
  lng?: number | null;
  name: string;
  /** First line in the fallback block (e.g. the neighbourhood). */
  title?: string | null;
  /** Second line in the fallback block (the street address). */
  address?: string | null;
  /** Google Maps link for the fallback block. */
  mapsHref?: string | null;
  mapsLabel?: string;
  height?: number;
  className?: string;
};

// Keep the studio's own pin readable: no other businesses' pins or labels.
const PLACE_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
];

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export function PlaceBlock({ title, address, mapsHref, mapsLabel, height = 180, className = "" }: Omit<Props, "lat" | "lng" | "name">) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl flex flex-col items-center justify-center text-center px-6 ${className}`}
      style={{
        minHeight: Math.min(height, 140),
        background:
          "linear-gradient(0deg, rgba(184,92,56,0.06) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, rgba(184,92,56,0.06) 1px, transparent 1px) 0 0 / 28px 28px, #F4EEE6",
      }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#B85C38" }}>
        <MapPin size={22} color="#fff" aria-hidden="true" />
      </span>
      {title && (
        <span className="mt-2 block text-base font-semibold leading-tight" style={{ color: "#2b2b2b" }}>
          {title}
        </span>
      )}
      {address && (
        <span className="mt-0.5 block text-sm leading-snug" style={{ color: "#5a4736" }}>
          {address}
        </span>
      )}
      {mapsHref && (
        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-2"
          style={{ color: "#B85C38" }}
        >
          {mapsLabel || "Google Maps"}
        </a>
      )}
    </div>
  );
}

export default function StudioPlaceMap({
  lat, lng, name, title, address, mapsHref, mapsLabel, height = 180, className = "",
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"waiting" | "ready" | "failed">("waiting");
  const hasPoint = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasPoint) return;
    const box = boxRef.current;
    if (!box) return;
    let cancelled = false;
    let started = false;
    let idleId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const prevAuthFailure = window.gm_authFailure;
    // Google calls this when the key or referrer is refused.
    window.gm_authFailure = () => {
      if (!cancelled) setState("failed");
      prevAuthFailure?.();
    };

    const draw = async () => {
      if (cancelled || started) return;
      started = true;
      timer = setTimeout(() => { if (!cancelled) setState((s) => (s === "ready" ? s : "failed")); }, 10000);
      try {
        const g = await loadGoogleMaps();
        if (cancelled) return;
        if (!g || !mapRef.current) { setState("failed"); return; }
        const center = { lat: lat as number, lng: lng as number };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
          keyboardShortcuts: false,
          styles: PLACE_STYLES,
        });
        new google.maps.Marker({ position: center, map, title: name });
        google.maps.event.addListenerOnce(map, "tilesloaded", () => {
          if (!cancelled) setState("ready");
        });
      } catch {
        if (!cancelled) setState("failed");
      }
    };

    const whenIdle = () => {
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
      if (ric) idleId = ric(() => void draw(), { timeout: 1500 });
      else timer = setTimeout(() => void draw(), 300);
    };

    let obs: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          obs?.disconnect();
          whenIdle();
        }
      }, { rootMargin: "200px" });
      obs.observe(box);
    } else {
      whenIdle();
    }

    return () => {
      cancelled = true;
      obs?.disconnect();
      if (idleId != null) (window as any).cancelIdleCallback?.(idleId);
      if (timer) clearTimeout(timer);
      window.gm_authFailure = prevAuthFailure;
    };
  }, [hasPoint, lat, lng, name]);

  if (!hasPoint || state === "failed") {
    return (
      <PlaceBlock title={title} address={address} mapsHref={mapsHref} mapsLabel={mapsLabel} height={height} className={className} />
    );
  }

  return (
    <div
      ref={boxRef}
      className={`relative w-full overflow-hidden rounded-2xl ${className}`}
      style={{ height, background: "#F4EEE6" }}
      data-map-state={state}
    >
      {state !== "ready" && (
        <div className="absolute inset-0">
          <PlaceBlock title={title} address={address} height={height} className="h-full rounded-none" />
        </div>
      )}
      <div
        ref={mapRef}
        className="absolute inset-0"
        role="img"
        aria-label={[name, address].filter(Boolean).join(", ")}
        style={{ opacity: state === "ready" ? 1 : 0, transition: "opacity 200ms" }}
      />
    </div>
  );
}
