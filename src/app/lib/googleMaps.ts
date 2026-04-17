import { Loader } from "@googlemaps/js-api-loader";

const STORAGE_KEY = "mm-google-maps-key";
let loaderPromise: Promise<typeof google> | null = null;
let currentKey: string | null = null;

export function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key);
  // Reset the loader so a new key can be used
  loaderPromise = null;
  currentKey = null;
}

export function clearStoredKey() {
  localStorage.removeItem(STORAGE_KEY);
  loaderPromise = null;
  currentKey = null;
}

/**
 * Load the Google Maps JS SDK with the key stored in localStorage.
 * Returns null if no key is configured.
 */
export async function loadGoogleMaps(): Promise<typeof google | null> {
  const key = getStoredKey();
  if (!key) return null;

  if (loaderPromise && currentKey === key) return loaderPromise;

  currentKey = key;
  const loader = new Loader({
    apiKey: key,
    version: "weekly",
    libraries: ["places", "marker"],
  });

  loaderPromise = loader.load().then(() => google);
  return loaderPromise;
}

export function hasGoogleMapsKey(): boolean {
  return !!getStoredKey();
}
