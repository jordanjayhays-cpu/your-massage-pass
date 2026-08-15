import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, MapPin, Phone, Globe, Clock, Star, Image, Search, Loader2, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import PartnerLangPills from "@/app/components/PartnerLangPills";
import { savePartnerLang, defaultPartnerLang, type PartnerLang } from "@/app/lib/partnerLanguage";
import i18n from "@/i18n";

// Google Places API key
const MAPS_KEY = "AIzaSyDx4a7iq1lt4LItVg44_kDmzvlpK7Ftldo";

// Booking link slug: lowercase, accent-free, hyphenated
const normalizeSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

type PlaceResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { periods: { open: { day: number; time: string }; close: { day: number; time: string } }[] };
  photos?: { photo_reference: string }[];
  geometry: { location: { lat: number; lng: number } };
  price_level?: number;
};

export default function PartnerProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<PartnerLang>(() => {
    const current = i18n.resolvedLanguage;
    if (current === "es" || current === "en") return current;
    return defaultPartnerLang();
  });

  // Form fields (editable after auto-fill)
  const [form, setForm] = useState({
    business_name: "",
    address: "",
    phone: "",
    whatsapp: "",
    website: "",
    description: "",
    access_instructions: "",
    city: "Madrid",
    country: "Spain",
  });
  const [slug, setSlug] = useState("");
  const [originalSlug, setOriginalSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);

  // Load existing partner profile on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("partners")
        .select("business_name, address, phone, whatsapp, website, description, access_instructions, city, country, preferred_language, slug")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setSlug((data as any).slug ?? "");
        setOriginalSlug((data as any).slug ?? "");
        setForm((f) => ({
          ...f,
          business_name: data.business_name ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          whatsapp: (data as any).whatsapp ?? "",
          website: data.website ?? "",
          description: data.description ?? "",
          access_instructions: data.access_instructions ?? "",
          city: data.city ?? "Madrid",
          country: data.country ?? "Spain",
        }));
        const preferred = (data as any).preferred_language as PartnerLang | undefined;
        if (preferred === "es" || preferred === "en") {
          setLang(preferred);
        } else {
          const current = i18n.resolvedLanguage;
          setLang(current === "es" || current === "en" ? current : defaultPartnerLang());
        }
      }
    })();
  }, []);

  const searchRef = useRef<HTMLDivElement>(null);

  // Close search on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) { setSearchResults([]); return; }

    setSearching(true);
    try {
      const res = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " massage spa madrid")}&key=${MAPS_KEY}`
        )}`
      );
      const data = await res.json();
      setSearchResults(data.results?.slice(0, 6) ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = async (place: PlaceResult) => {
    setSelectedPlace(place);
    setSearchResults([]);

    // Fetch full details (place_id needed for photos, phone etc)
    let fullPlace = place;
    try {
      const detailRes = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,photos,geometry,price_level&key=${MAPS_KEY}`
        )}`
      );
      const detailData = await detailRes.json();
      if (detailData.result) fullPlace = detailData.result;
    } catch { /* use basic result */ }

    const addressParts = fullPlace.formatted_address?.split(",") ?? [];
    setForm((f) => ({
      ...f,
      business_name: fullPlace.name ?? "",
      address: fullPlace.formatted_address ?? "",
      phone: fullPlace.formatted_phone_number ?? "",
      website: fullPlace.website ?? "",
      city: addressParts.find(p => /Madrid/i.test(p)) ? "Madrid" : addressParts[1]?.trim() ?? "Madrid",
      country: "Spain",
    }));
    toast.success(t("partner.profile.toastLoaded", { name: fullPlace.name }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSlugError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t("partner.profile.toastSignIn")); setLoading(false); return; }

    const lat = selectedPlace?.geometry?.location?.lat;
    const lng = selectedPlace?.geometry?.location?.lng;

    // Slug: normalize, validate length, check uniqueness before saving.
    const cleanSlug = normalizeSlug(slug);
    const slugChanged = cleanSlug !== (originalSlug ?? "");
    if (cleanSlug && (cleanSlug.length < 3 || cleanSlug.length > 40)) {
      setSlugError(t("partner.profile.slugInvalid"));
      setLoading(false);
      return;
    }
    if (cleanSlug && slugChanged) {
      const { data: taken } = await supabase
        .from("partners")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", user.id)
        .maybeSingle();
      if (taken) {
        setSlugError(t("partner.profile.slugTaken"));
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.from("partners").upsert({
      id: user.id,
      business_name: form.business_name,
      address: form.address,
      phone: form.phone,
      whatsapp: form.whatsapp,
      website: form.website,
      description: form.description,
      access_instructions: form.access_instructions,
      city: form.city,
      country: form.country,
      latitude: lat,
      longitude: lng,
      google_place_id: selectedPlace?.place_id,
      status: "active",
      preferred_language: lang,
      ...(cleanSlug ? { slug: cleanSlug } : {}),
    });

    setLoading(false);
    if (error) { toast.error(t("partner.profile.toastSaveError", { message: error.message })); return; }
    if (cleanSlug && slugChanged) {
      setSlug(cleanSlug);
      setOriginalSlug(cleanSlug);
      toast.warning(t("partner.profile.slugUpdatedWarning"));
    }
    setSaved(true);
    toast.success(t("partner.profile.toastSaved"));
    setTimeout(() => navigate("/partner/services"), 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/partner/dashboard")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
              ←
            </button>
            <div>
              <p className="text-xs text-muted-foreground">{t("partner.profile.stepLabel")}</p>
              <h1 className="font-display text-lg font-bold">{t("partner.profile.title")}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-6">
        {/* Google Places Search */}
        {!selectedPlace && (
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              {t("partner.profile.findLabel")}
            </label>
            <div ref={searchRef} className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t("partner.profile.searchPlaceholder")}
                className="h-12 pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
                {searchResults.map((place) => (
                  <button
                    key={place.place_id}
                    onClick={() => selectPlace(place)}
                    className="w-full text-left p-4 hover:bg-secondary transition flex items-start gap-3 border-b border-border last:border-b-0"
                  >
                    <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">{place.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{place.formatted_address}</p>
                      {place.rating && (
                        <p className="text-xs text-accent font-semibold mt-1">★ {t("partner.profile.ratingReviews", { rating: place.rating, count: place.user_ratings_total })}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length > 0 && searchResults.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground mt-3">{t("partner.profile.noResults")}</p>
            )}
          </div>
        )}

        {/* Selected / Manual Form */}
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            {selectedPlace && (
              <div className="flex items-center gap-2 text-sm text-accent font-semibold mb-2">
                <Check className="h-4 w-4" />
                {t("partner.profile.googleDataLoaded")}
              </div>
            )}

            {[
              { key: "business_name", label: t("partner.profile.businessName"), icon: Building2 },
              { key: "address", label: t("partner.profile.address"), icon: MapPin },
              { key: "phone", label: t("partner.profile.phone"), icon: Phone },
              { key: "website", label: t("partner.profile.website"), icon: Globe },
            ].map(({ key, label, icon: Icon }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("partner.profile.whatsappLabel")}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#25D366]" />
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder={t("partner.profile.whatsappPlaceholder")}
                  className="pl-10 h-11"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{t("partner.profile.whatsappHint")}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("partner.profile.descriptionLabel")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("partner.profile.descriptionPlaceholder")}
                rows={3}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                📍 {t("partner.profile.accessLabel")}
              </label>
              <textarea
                value={form.access_instructions}
                onChange={(e) => setForm({ ...form, access_instructions: e.target.value })}
                placeholder={t("partner.profile.accessPlaceholder")}
                rows={3}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {t("partner.profile.accessHint")}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("partner.profile.slugLabel")}</label>
              <div className="flex items-stretch rounded-xl border border-border overflow-hidden bg-background">
                <span className="px-3 flex items-center text-xs text-muted-foreground bg-secondary whitespace-nowrap">book.massageclub.io/</span>
                <input
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setSlugError(null); }}
                  onBlur={() => setSlug((s) => normalizeSlug(s))}
                  placeholder={t("partner.profile.slugPlaceholder")}
                  className="flex-1 min-w-0 h-11 px-3 bg-transparent text-sm outline-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 break-all">
                https://book.massageclub.io/{normalizeSlug(slug)}
              </p>
              {slugError && <p className="text-[11px] text-destructive mt-1">{slugError}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("partner.profile.languageLabel")}</label>
              <PartnerLangPills
                value={lang}
                onChange={(l) => { setLang(l); savePartnerLang(l); }}
              />
            </div>

            {selectedPlace?.rating && (
              <div className="flex items-center gap-3 text-sm bg-secondary rounded-xl p-3">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <span className="font-semibold">{t("partner.profile.ratingOutOf5", { rating: selectedPlace.rating })}</span>
                <span className="text-muted-foreground">{t("partner.profile.reviewsCount", { count: selectedPlace.user_ratings_total })}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={loading || !form.business_name || !form.address}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
        >
          {loading ? t("partner.profile.saving") : saved ? t("partner.profile.saved") : t("partner.profile.saveAndContinue")}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
