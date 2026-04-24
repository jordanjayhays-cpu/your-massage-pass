/// <reference types="google.maps" />
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// Jordan's Google Maps API key — pre-configured for Massage Pass
const DEFAULT_KEY = "AIzaSyDx4a7iq1lt4LItVg44_kDmzvlpK7Ftldo";
const STORAGE_KEY = "mm-google-maps-key";
let loaderPromise: Promise<typeof google> | null = null;
let currentKey: string | null = null;

export function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  // Check localStorage first (allows user override)
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  // Fall back to default key (Jordan's key)
  return DEFAULT_KEY;
}

export function setStoredKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key);
  loaderPromise = null;
  currentKey = null;
}

export function clearStoredKey() {
  localStorage.removeItem(STORAGE_KEY);
  loaderPromise = null;
  currentKey = null;
}

/**
 * Load the Google Maps JS SDK.
 * Uses user's stored key if available, otherwise falls back to default key.
 */
export async function loadGoogleMaps(): Promise<typeof google | null> {
  const key = getStoredKey();
  if (!key) return null;

  if (loaderPromise && currentKey === key) return loaderPromise;

  currentKey = key;
  loaderPromise = (async () => {
    setOptions({
      key,
      v: "weekly",
      libraries: ["places", "marker", "geometry"],
    });
    await Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("marker"),
      importLibrary("geometry"),
    ]);
    return google;
  })();
  return loaderPromise;
}

export function hasGoogleMapsKey(): boolean {
  return !!getStoredKey();
}
