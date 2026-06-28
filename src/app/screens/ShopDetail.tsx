import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Loader2,
  Share2,
  Heart,
  Flower2,
  Phone,
  MessageSquare,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MASSAGES, MADRID_CENTER } from "../data";
import { fetchShopById } from "@/lib/supabase";
import type { Shop } from "@/lib/supabase";
import { loadGoogleMaps } from "../lib/googleMaps";


export default function ShopDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [massage, setMassage] = useState<Shop | typeof MASSAGES[0] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitedFor = useRef<string | null>(null);


  useEffect(() => {
    if (!id) return;
    fetchShopById(id).then((real) => {
      if (real) {
        setMassage(real);
        setLoading(false);
        return;
      }
      const fallback = MASSAGES.find((m) => m.id === id) ?? null;
      setMassage(fallback);
      setLoading(false);
    });
  }, [id]);

  // Initialize Google Map in the Location card once studio data is loaded
  useEffect(() => {
    if (!massage || !mapRef.current) return;
    const studioId = (massage as any).id as string;
    if (mapInitedFor.current === studioId) return;
    let cancelled = false;

    const m: any = massage;
    const addr: string | undefined = m.address ?? m.location;
    const hasCoords = typeof m.lat === "number" && typeof m.lng === "number";

    const mapStyles: google.maps.MapTypeStyle[] = [
      { elementType: "geometry", stylers: [{ color: "#f6efe1" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#5b4636" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#f6efe1" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd4d8" }] },
    ];

    const pinIcon = {
      url: `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="#C4622D" stroke="white" stroke-width="3"/></svg>`
      )}`,
      scaledSize: undefined as any,
      anchor: undefined as any,
    };

    loadGoogleMaps().then((g) => {
      if (cancelled || !g || !mapRef.current) return;
      pinIcon.scaledSize = new google.maps.Size(36, 36);
      pinIcon.anchor = new google.maps.Point(18, 18);

      const createMap = (center: google.maps.LatLngLiteral, zoom: number) =>
        new google.maps.Map(mapRef.current!, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          styles: mapStyles,
        });

      if (hasCoords) {
        const center = { lat: m.lat, lng: m.lng };
        const map = createMap(center, 15);
        new google.maps.Marker({ position: center, map, icon: pinIcon, title: m.studio });
        mapInitedFor.current = studioId;
      } else if (addr) {
        new google.maps.Geocoder().geocode({ address: addr }, (results, status) => {
          if (cancelled || !mapRef.current) return;
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            const center = { lat: loc.lat(), lng: loc.lng() };
            const map = createMap(center, 14);
            new google.maps.Marker({ position: center, map, icon: pinIcon, title: m.studio });
          } else {
            createMap(MADRID_CENTER, 12);
          }
          mapInitedFor.current = studioId;
        });
      } else {
        createMap(MADRID_CENTER, 12);
        mapInitedFor.current = studioId;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [massage]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!massage) {
    return (
      <div className="p-8 text-center bg-background h-full">
        <p className="text-foreground">Not found.</p>
        <Button onClick={() => navigate("/app/massages")} className="mt-4">Back</Button>
      </div>
    );
  }

  const m: any = massage;
  const district = m.district ?? "";
  const address = m.address ?? m.location ?? "Madrid, Spain";
  const phone = m.phone as string | undefined;
  const firstSentence =
    (m.description as string | undefined)?.split(/[.!?](\s|$)/)[0]?.trim() ||
    "Intensive pressure to relieve chronic tension.";
  const services: Array<{ id: string; name: string; duration: number; price?: number; description?: string }> =
    Array.isArray(m.services) && m.services.length
      ? m.services
      : [{ id: m.id, name: m.name, duration: m.duration, price: m.price, description: m.description }];

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: m.studio, url: window.location.href });
      } else {
        await navigator.clipboard?.writeText(window.location.href);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Hero */}
      <div className="relative h-72 flex-shrink-0">
        <img src={m.image} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-background/40" />
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute top-4 left-4 h-11 w-11 rounded-full bg-card/95 backdrop-blur flex items-center justify-center shadow-soft border border-border/60 hover:bg-card transition"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={handleShare}
            aria-label="Share"
            className="h-11 w-11 rounded-full bg-card/95 backdrop-blur flex items-center justify-center shadow-soft border border-border/60 hover:bg-card transition"
          >
            <Share2 className="h-4 w-4 text-foreground" />
          </button>
          <button
            onClick={() => setFav((v) => !v)}
            aria-label="Favorite"
            className="h-11 w-11 rounded-full bg-card/95 backdrop-blur flex items-center justify-center shadow-soft border border-border/60 hover:bg-card transition"
          >
            <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : "text-foreground"}`} />
          </button>
        </div>
      </div>

      {/* Content card */}
      <div className="flex-1 -mt-8 rounded-t-[2rem] bg-background relative pb-12">
        <div className="px-6 pt-7">
          {/* District + rating row */}
          <div className="flex items-start justify-between gap-4">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary mt-1">
              {district ? `${district} District` : "Madrid"}
            </span>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <span className="font-display text-base font-semibold text-foreground">{m.rating}</span>
              </div>
              {m.reviews != null && (
                <p className="text-[11px] text-muted-foreground mt-0.5">({m.reviews} reviews)</p>
              )}
            </div>
          </div>

          {/* Studio name */}
          <h1 className="font-display text-[2rem] leading-tight font-semibold text-foreground mt-2">
            {m.studio}
          </h1>

          {/* Tag chips */}
          {Array.isArray(m.tags) && m.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {m.tags.map((t: string) => (
                <span
                  key={t}
                  className="text-xs font-medium bg-secondary text-foreground rounded-full px-3 py-1.5"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {m.description && (
            <p className="text-[15px] text-muted-foreground leading-relaxed mt-5">{m.description}</p>
          )}

          {/* Treatments */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Flower2 className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl text-foreground">Treatments</h2>
            </div>

            <div className="space-y-3">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="bg-card border border-border/60 rounded-2xl p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg font-semibold text-foreground leading-snug">
                        {s.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {s.description?.split(/[.!?](\s|$)/)[0]?.trim() || firstSentence}.
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {s.price != null && (
                        <p className="font-display text-2xl font-semibold text-foreground">
                          €{s.price}
                        </p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                        Pay at studio
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {s.duration} min
                    </span>
                    <button
                      onClick={() => navigate(`/app/booking/${m.id}/calendar`)}
                      className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide uppercase shadow-soft hover:opacity-90 transition"
                    >
                      Book →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl text-foreground">Location</h2>
            </div>

            <div className="rounded-2xl bg-secondary/70 border border-border/60 p-5 shadow-soft">
              <div ref={mapRef} className="relative h-40 rounded-xl overflow-hidden bg-secondary" />


              <div className="flex items-center justify-between gap-3 mt-4">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-foreground truncate">
                    {m.studio}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{address}</p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${m.studio} ${address}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Directions"
                  className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center shadow-soft hover:border-primary/50 transition flex-shrink-0"
                >
                  <Compass className="h-4 w-4 text-primary" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <a
                href={phone ? `tel:${phone}` : undefined}
                onClick={(e) => { if (!phone) e.preventDefault(); }}
                className="h-12 rounded-full border border-border bg-card text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:border-primary/50 transition shadow-soft"
              >
                <Phone className="h-4 w-4 text-primary" /> Call
              </a>
              <button
                onClick={() => navigate(`/app/booking/${m.id}/calendar`)}
                className="h-12 rounded-full border border-border bg-card text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:border-primary/50 transition shadow-soft"
              >
                <MessageSquare className="h-4 w-4 text-primary" /> Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
