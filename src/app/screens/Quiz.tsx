import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, ChevronRight, RefreshCw, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUIZ, MASSAGE_TYPES, MassageType, MASSAGES } from "../data";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/siteVisit";
import { clarityEvent } from "@/lib/clarity";
import {
  findNearestStudios,
  findStudiosOfferingType,
  studioOffersType,
  distanceLabel,
  type NearbyStudio,
} from "@/lib/nearestStudios";
import { servicePrimaryName, serviceSecondaryName } from "@/lib/serviceName";
import StudioMap from "../components/StudioMap";
import type { Shop } from "@/lib/supabase";
import { studioPath } from "@/lib/studioHref";
import { useLocationAsk } from "@/lib/locationConsent";

const ORIGIN_KEY = "mc_quiz_origin";

type QuizOrigin = { slug: string; name: string };

/** Where the visitor opened the quiz from, kept across the quiz steps. */
function readOrigin(params: URLSearchParams): QuizOrigin | null {
  const slug = params.get("from");
  const name = params.get("fromName");
  if (slug) {
    const origin = { slug, name: name || slug };
    try { sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin)); } catch { /* ignore */ }
    return origin;
  }
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (raw) return JSON.parse(raw) as QuizOrigin;
  } catch { /* ignore */ }
  return null;
}

export default function Quiz() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<MassageType, number>>({
    swedish: 0,
    deep: 0,
    stone: 0,
    sports: 0,
    thai: 0,
    lomi: 0,
  });
  const [done, setDone] = useState(false);
  // Nearest-studio recommendation (only after the visitor allows location).
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [nearby, setNearby] = useState<NearbyStudio[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const askLocation = useLocationAsk();
  const [fallbackList, setFallbackList] = useState<
    Omit<NearbyStudio, "km" | "meters" | "walkMinutes" | "lat" | "lng">[]
  >([]);
  const [origin] = useState<QuizOrigin | null>(() => readOrigin(params));
  const [originOffers, setOriginOffers] = useState(false);


  useEffect(() => {
    clarityEvent("quiz_start");
    trackEvent("quiz_start");
  }, []);

  const total = QUIZ.length;
  const current = QUIZ[step];

  const pickOption = (opt: (typeof current.options)[number]) => {
    const next = { ...scores };
    Object.entries(opt.scores).forEach(([k, v]) => {
      next[k as MassageType] = (next[k as MassageType] ?? 0) + (v ?? 0);
    });
    setScores(next);
    if (step + 1 < total) setStep(step + 1);
    else setDone(true);
  };

  const reset = () => {
    setScores({ swedish: 0, deep: 0, stone: 0, sports: 0, thai: 0, lomi: 0 });
    setStep(0);
    setDone(false);
    setGeoState("idle");
    setNearby([]);
    setUserLoc(null);
    setFallbackList([]);
  };

  const winnerType = (Object.entries(scores) as [MassageType, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const winner = MASSAGE_TYPES.find((t) => t.id === winnerType);
  const matchingStudios = MASSAGES.filter((m) => m.type === winnerType);

  // Does the studio they came from also offer the recommended type?
  useEffect(() => {
    if (!done || !winnerType || !origin?.slug) return;
    let cancelled = false;
    studioOffersType(origin.slug, winnerType).then((ok) => {
      if (!cancelled) setOriginOffers(ok);
    });
    return () => { cancelled = true; };
  }, [done, winnerType, origin?.slug]);

  // Never blocks the result. The branded sheet comes first, so the native
  // permission prompt is never fired cold.
  const askForLocation = () => {
    if (!winnerType) return;
    setGeoState("loading");
    askLocation(async (res) => {
      if (!res) {
        setGeoState("idle");
        return;
      }
      const list = await findNearestStudios(winnerType, res.loc.lat, res.loc.lng, 3);
      if (list.length === 0) {
        setGeoState("unavailable");
        findStudiosOfferingType(winnerType, 3).then(setFallbackList).catch(() => {});
        return;
      }
      setUserLoc(res.loc);
      setNearby(list);
      setGeoState("ready");
    });
  };

  const studioHref = (s: { slug: string | null; id: string }) => studioPath(s);

  // Pins for the mini discovery map, built only from real coordinates.
  const mapShops = nearby.map((s) => ({
    id: s.id,
    partner_id: s.id,
    studio: s.name,
    name: servicePrimaryName(s.service),
    district: "",
    address: s.address ?? "",
    duration: s.service.duration ?? 0,
    rating: null,
    reviews: null,
    image: "",
    description: "",
    tags: [],
    type: winnerType ?? "",
    lat: s.lat,
    lng: s.lng,
    services: [],
    partner_services: [],
  })) as unknown as Shop[];


  if (done && winner) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
          <button
            onClick={() => navigate("/discovery")}
            aria-label="Back"
            className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs text-muted-foreground">Your result</p>
            <h1 className="font-display text-lg font-bold">Your perfect match</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative h-56">
            <img src={winner.image} alt={winner.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <div className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Best match
              </div>
              <h2 className="font-display text-3xl font-bold text-primary-foreground mt-2">{winner.name}</h2>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            <p className="text-foreground/85 leading-relaxed">{winner.description}</p>

            {/* Nearest studio recommendation (opt-in location) */}
            {geoState !== "ready" && (
              <div className="rounded-2xl border border-[#E6DCCF] bg-[#FBEFE8] p-4">
                <p className="text-sm font-semibold text-foreground">Want us to find the closest studio to you?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {geoState === "unavailable"
                    ? "No problem, here are studios offering this massage in Madrid."
                    : "We only use your location to sort studios by distance."}
                </p>
                {geoState !== "unavailable" && (
                  <Button
                    onClick={askForLocation}
                    disabled={geoState === "loading"}
                    className="mt-3 h-10"
                  >
                    {geoState === "loading" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Finding studios…</>
                    ) : (
                      <><MapPin className="h-4 w-4" /> Find the closest studio</>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Mini discovery: real map with the visitor and the matching studios */}
            {geoState === "ready" && nearby.length > 0 && (
              <div className="space-y-3">
                {userLoc && (
                  <StudioMap
                    shops={mapShops}
                    heightClass="h-[200px]"
                    showSelectedCard={false}
                    onSelect={(shop) => navigate(studioPath(shop as any))}
                  />
                )}

                <a
                  href={studioHref(nearby[0])}
                  className="block rounded-2xl border-2 border-[#C4622D] bg-[#C4622D]/5 p-4 hover:opacity-95 transition"
                >
                  <span className="inline-flex items-center gap-1.5 bg-[#C4622D] text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    <MapPin className="h-3 w-3" /> Closest to you
                  </span>
                  <p className="font-display text-xl font-semibold mt-2">{nearby[0].name}</p>
                  <p className="text-xs text-muted-foreground">
                    {distanceLabel(nearby[0].meters, nearby[0].walkMinutes)}
                  </p>
                  {nearby[0].address && <p className="text-xs text-muted-foreground">{nearby[0].address}</p>}
                  <p className="text-sm mt-2 font-medium">
                    {servicePrimaryName(nearby[0].service)}
                    {nearby[0].service.duration ? ` · ${nearby[0].service.duration} min` : ""}
                    {nearby[0].service.price != null ? ` · €${nearby[0].service.price}` : ""}
                  </p>
                  {serviceSecondaryName(nearby[0].service) && (
                    <p className="text-xs text-muted-foreground">{serviceSecondaryName(nearby[0].service)}</p>
                  )}
                  <span className="mt-3 inline-flex items-center justify-center h-11 w-full rounded-full bg-[#C4622D] text-white font-semibold text-sm">
                    View studio <ChevronRight className="h-4 w-4" />
                  </span>
                </a>

                {nearby.length > 1 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Also nearby</h3>
                    {nearby.slice(1).map((s) => (
                      <a
                        key={s.id}
                        href={studioHref(s)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {distanceLabel(s.meters, s.walkMinutes)}
                            {s.service.price != null ? ` · €${s.service.price}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Location denied or unavailable: real studios, no distances invented */}
            {geoState === "unavailable" && fallbackList.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold">Studios offering {winner.name}</h3>
                {fallbackList.map((s) => (
                  <a
                    key={s.id}
                    href={studioHref(s)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {servicePrimaryName(s.service)}
                        {s.service.duration ? ` · ${s.service.duration} min` : ""}
                        {s.service.price != null ? ` · €${s.service.price}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}

            {/* Always offer the way back to the studio they came from */}
            {origin && (
              <Button
                variant="outline"
                onClick={() => navigate(studioPath(origin as any))}
                className="w-full h-auto min-h-11 py-2 whitespace-normal"
              >
                {originOffers
                  ? `Back to ${origin.name}, they offer ${winner.name} too`
                  : `Back to ${origin.name}`}
              </Button>
            )}

            {geoState === "idle" && matchingStudios.length > 0 && (
              <div>
                <h3 className="font-display text-lg font-semibold mb-3">Try it in Madrid</h3>
                <div className="space-y-2">
                  {matchingStudios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/massages/${s.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary transition text-left"
                    >
                      <img src={s.image} alt={s.studio} className="h-14 w-14 rounded-lg object-cover" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{s.studio}</p>
                        <p className="text-xs text-muted-foreground">{s.district} · {s.duration} min</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => { window.location.href = `/?q=${encodeURIComponent(winner.name)}`; }}
              className="w-full h-11"
            >
              Find a {winner.name} studio <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              onClick={reset}
              className="w-full h-11"
            >
              <RefreshCw className="h-4 w-4" /> Retake quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button
          onClick={() => navigate("/discovery")}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Question {step + 1} of {total}</p>
          <div className="mt-1.5 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-royal transition-all duration-500"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <h2 className="font-display text-2xl font-bold text-foreground mb-6">{current.question}</h2>
        <div className="space-y-3">
          {current.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => pickOption(opt)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all",
              )}
            >
              <span className="font-medium text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
