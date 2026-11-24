/**
 * Distance and walking-time helpers.
 *
 * We only ever show a distance when the visitor has actually granted
 * geolocation. Walking time uses a plain 80 m per minute pace.
 */

const WALK_METRES_PER_MIN = 80;

export type LatLng = { lat: number; lng: number };

const LS_KEY = "mc-user-location";

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km * 1000) / WALK_METRES_PER_MIN));
}

/** "1.2 km · about 15 min walk" (English) / Spanish variant. */
export function distanceLabel(km: number, lang: "en" | "es" = "en"): string {
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const mins = walkMinutes(km);
  return lang === "es"
    ? `${dist} · unos ${mins} min andando`
    : `${dist} · about ${mins} min walk`;
}

/** Short form for tight spots: "1.2 km · 15 min". */
export function distanceLabelShort(km: number): string {
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return `${dist} · ${walkMinutes(km)} min`;
}

/** Google Maps walking directions to a studio. */
export function walkingDirectionsUrl(
  dest: LatLng | null | undefined,
  fallbackQuery?: string | null,
  origin?: LatLng | null,
): string | null {
  const params = new URLSearchParams({ api: "1", travelmode: "walking" });
  if (dest && Number.isFinite(dest.lat) && Number.isFinite(dest.lng)) {
    params.set("destination", `${dest.lat},${dest.lng}`);
  } else if (fallbackQuery?.trim()) {
    params.set("destination", fallbackQuery.trim());
  } else {
    return null;
  }
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function loadSavedLocation(): LatLng | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat === "number" && typeof v?.lng === "number") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveLocation(loc: LatLng) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

/** Ask the browser for the visitor's position. Resolves null when refused. */
export function requestLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveLocation(loc);
        resolve(loc);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}
