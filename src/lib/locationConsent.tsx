/**
 * Location soft-ask.
 *
 * The native browser permission prompt is never triggered cold. Every entry
 * point first opens our own branded sheet; only the primary button inside it
 * calls navigator.geolocation, still inside the user gesture.
 *
 * The outcome (granted, denied, or a chosen area) is remembered for the
 * session so the sheet does not reappear on every page.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Loader2 } from "lucide-react";
import { saveLocation, type LatLng } from "@/lib/distance";

export type MadridArea = { id: string; name: string; lat: number; lng: number };

/** Approximate centres of the central Madrid areas we offer as a fallback. */
export const MADRID_AREAS: MadridArea[] = [
  { id: "centro", name: "Centro", lat: 40.4155, lng: -3.7074 },
  { id: "chamberi", name: "Chamberí", lat: 40.4353, lng: -3.7038 },
  { id: "salamanca", name: "Salamanca", lat: 40.4283, lng: -3.6790 },
  { id: "chueca", name: "Chueca", lat: 40.4224, lng: -3.6968 },
  { id: "malasana", name: "Malasaña", lat: 40.4257, lng: -3.7040 },
  { id: "chamartin", name: "Chamartín", lat: 40.4600, lng: -3.6800 },
  { id: "retiro", name: "Retiro", lat: 40.4130, lng: -3.6790 },
  { id: "arguelles", name: "Argüelles", lat: 40.4300, lng: -3.7160 },
  { id: "lavapies", name: "Lavapiés", lat: 40.4090, lng: -3.7010 },
  { id: "tetuan", name: "Tetuán", lat: 40.4600, lng: -3.6990 },
];

/** What the caller gets back. `areaName` is null when it is the real device location. */
export type LocationResult = { loc: LatLng; areaName: string | null };

type Choice =
  | { status: "granted"; loc: LatLng }
  | { status: "area"; areaId: string }
  | { status: "denied" };

const SS_KEY = "mc-location-choice";

function loadChoice(): Choice | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as Choice) : null;
  } catch {
    return null;
  }
}

function storeChoice(c: Choice) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

function choiceToResult(c: Choice | null): LocationResult | null {
  if (!c) return null;
  if (c.status === "granted") return { loc: c.loc, areaName: null };
  if (c.status === "area") {
    const area = MADRID_AREAS.find((a) => a.id === c.areaId);
    return area ? { loc: { lat: area.lat, lng: area.lng }, areaName: area.name } : null;
  }
  return null;
}

/** The remembered result, if the visitor already answered this session. */
export function savedLocationResult(): LocationResult | null {
  return choiceToResult(loadChoice());
}

/** True once any answer (granted, area, or denied) was recorded this session. */
export function locationChoiceMade(): boolean {
  return loadChoice() !== null;
}

const SS_AUTO_KEY = "mc-location-auto-shown";

/** True once the sheet has been auto-opened this session. */
export function locationSheetAutoShown(): boolean {
  try {
    return sessionStorage.getItem(SS_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocationSheetAutoShown() {
  try {
    sessionStorage.setItem(SS_AUTO_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** True once the visitor refused the browser prompt this session. */
export function locationWasDenied(): boolean {
  return loadChoice()?.status === "denied";
}

// ─────────────────────────────────────────────────────────────
// Provider: one sheet for the whole app, opened from anywhere.
// ─────────────────────────────────────────────────────────────

type AskFn = (onResolved: (result: LocationResult | null) => void) => void;

const LocationAskCtx = createContext<AskFn | null>(null);

type Phase = "ask" | "locating" | "fallback";

export function LocationAskProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").slice(0, 2) === "es";
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask");
  const cbRef = useRef<((r: LocationResult | null) => void) | null>(null);

  const finish = useCallback((r: LocationResult | null) => {
    setOpen(false);
    const cb = cbRef.current;
    cbRef.current = null;
    cb?.(r);
  }, []);

  const ask = useCallback<AskFn>((onResolved) => {
    const saved = savedLocationResult();
    if (saved) {
      onResolved(saved);
      return;
    }
    cbRef.current = onResolved;
    // Someone who already refused goes straight to the area picker: we never
    // fire the native prompt at them a second time.
    setPhase(locationWasDenied() ? "fallback" : "ask");
    setOpen(true);
  }, []);

  const runBrowserPrompt = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      storeChoice({ status: "denied" });
      setPhase("fallback");
      return;
    }
    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveLocation(loc);
        storeChoice({ status: "granted", loc });
        finish({ loc, areaName: null });
      },
      () => {
        storeChoice({ status: "denied" });
        setPhase("fallback");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const pickArea = (area: MadridArea) => {
    storeChoice({ status: "area", areaId: area.id });
    finish({ loc: { lat: area.lat, lng: area.lng }, areaName: area.name });
  };

  const value = useMemo(() => ask, [ask]);

  return (
    <LocationAskCtx.Provider value={value}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
          <button
            type="button"
            aria-label={es ? "Cerrar" : "Close"}
            onClick={() => finish(null)}
            className="absolute inset-0 bg-[#2b2b2b]/40 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full sm:max-w-md bg-[#FAF6F1] rounded-t-3xl sm:rounded-3xl border border-[#EADFD2] shadow-[0_-8px_40px_rgba(80,44,20,0.18)] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6"
          >
            <div className="mx-auto mb-4 h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "#F2E3D5" }}>
              <MapPin size={26} style={{ color: "#C4622D" }} />
            </div>

            {phase !== "fallback" ? (
              <>
                <h2 className="font-display text-xl font-semibold text-center" style={{ color: "#2b2b2b" }}>
                  See studios near you
                </h2>
                <p className="text-sm text-center mb-3" style={{ color: "#8a7460" }}>Ver estudios cerca de ti</p>

                <p className="text-sm text-center leading-relaxed" style={{ color: "#5a4736" }}>
                  We use your location once, only to sort studios by distance. We never store it or share it.
                </p>
                <p className="text-xs text-center leading-relaxed mt-1" style={{ color: "#8a7460" }}>
                  Usamos tu ubicación una vez, solo para ordenar los estudios por distancia. No la guardamos ni la compartimos.
                </p>

                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={runBrowserPrompt}
                    disabled={phase === "locating"}
                    className="w-full min-h-[52px] rounded-2xl font-semibold text-white flex flex-col items-center justify-center leading-tight disabled:opacity-70"
                    style={{ background: "#C4622D" }}
                  >
                    {phase === "locating" ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Locating you
                      </span>
                    ) : (
                      <>
                        <span>Show distances</span>
                        <span className="text-xs font-normal opacity-90">Mostrar distancias</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => finish(null)}
                    className="w-full min-h-11 rounded-2xl text-sm font-medium"
                    style={{ color: "#8a7460" }}
                  >
                    Not now <span className="opacity-70">/ Ahora no</span>
                  </button>
                </div>

                <p className="text-[11px] text-center mt-3" style={{ color: "#9E8B78" }}>
                  Your browser will ask for permission next.
                  <br />
                  Tu navegador pedirá permiso ahora.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-semibold text-center" style={{ color: "#2b2b2b" }}>
                  No problem. Pick your area instead
                </h2>
                <p className="text-sm text-center mb-4" style={{ color: "#8a7460" }}>
                  No pasa nada. Elige tu zona
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  {MADRID_AREAS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => pickArea(a)}
                      className="min-h-11 px-4 rounded-full border-2 bg-white text-sm font-semibold transition hover:bg-[#F7EEE5]"
                      style={{ borderColor: "#EADFD2", color: "#5a4736" }}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => finish(null)}
                  className="w-full min-h-11 mt-4 rounded-2xl text-sm font-medium"
                  style={{ color: "#8a7460" }}
                >
                  Not now <span className="opacity-70">/ Ahora no</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </LocationAskCtx.Provider>
  );
}

/**
 * Opens the branded sheet and resolves with a location, or null when the
 * visitor closes it. Never fires the native prompt on its own.
 */
export function useLocationAsk(): AskFn {
  const ask = useContext(LocationAskCtx);
  if (!ask) throw new Error("useLocationAsk must be used inside LocationAskProvider");
  return ask;
}

/** "from you" / "from Chamberí", for distance labels. */
export function originSuffix(areaName: string | null | undefined, lang: "en" | "es"): string {
  if (areaName) return lang === "es" ? `desde ${areaName}` : `from ${areaName}`;
  return lang === "es" ? "desde tu ubicación" : "from you";
}
