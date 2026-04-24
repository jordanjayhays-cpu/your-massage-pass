import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, Phone, Globe, Clock, Star, Image, Search, Loader2, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// Google Places API key
const MAPS_KEY = "AIzaSyDx4a7iq1lt4LItVg44_kDmzvlpK7Ftldo";

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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields (editable after auto-fill)
  const [form, setForm] = useState({
    business_name: "",
    address: "",
    phone: "",
    website: "",
    description: "",
    city: "Madrid",
    country: "Spain",
  });

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
    setForm({
      business_name: fullPlace.name ?? "",
      address: fullPlace.formatted_address ?? "",
      phone: fullPlace.formatted_phone_number ?? "",
      website: fullPlace.website ?? "",
      description: "",
      city: addressParts.find(p => /Madrid/i.test(p)) ? "Madrid" : addressParts[1]?.trim() ?? "Madrid",
      country: "Spain",
    });
    toast.success(`${fullPlace.name} loaded! Fill in the rest and save.`);
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in first"); setLoading(false); return; }

    const lat = selectedPlace?.geometry?.location?.lat;
    const lng = selectedPlace?.geometry?.location?.lng;

    const { error } = await supabase.from("partners").upsert({
      id: user.id,
      business_name: form.business_name,
      address: form.address,
      phone: form.phone,
      website: form.website,
      description: form.description,
      city: form.city,
      country: form.country,
      latitude: lat,
      longitude: lng,
      google_place_id: selectedPlace?.place_id,
      status: "active",
    });

    setLoading(false);
    if (error) { toast.error("Error saving: " + error.message); return; }
    setSaved(true);
    toast.success("Profile saved! Now add your services.");
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
              <p className="text-xs text-muted-foreground">Step 1 of 3</p>
              <h1 className="font-display text-lg font-bold">Business Profile</h1>
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
              Find your business on Google
            </label>
            <div ref={searchRef} className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for your spa on Google…"
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
                        <p className="text-xs text-accent font-semibold mt-1">★ {place.rating} ({place.user_ratings_total} reviews)</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length > 0 && searchResults.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground mt-3">No results found. Try a different name or enter manually below.</p>
            )}
          </div>
        )}

        {/* Selected / Manual Form */}
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            {selectedPlace && (
              <div className="flex items-center gap-2 text-sm text-accent font-semibold mb-2">
                <Check className="h-4 w-4" />
                Google data loaded — verify and edit below
              </div>
            )}

            {[
              { key: "business_name", label: "Business Name", icon: Building2 },
              { key: "address", label: "Address", icon: MapPin },
              { key: "phone", label: "Phone", icon: Phone },
              { key: "website", label: "Website", icon: Globe },
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
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description (for customers)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell customers what makes your spa special…"
                rows={3}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm resize-none"
              />
            </div>

            {selectedPlace?.rating && (
              <div className="flex items-center gap-3 text-sm bg-secondary rounded-xl p-3">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <span className="font-semibold">{selectedPlace.rating}/5</span>
                <span className="text-muted-foreground">({selectedPlace.user_ratings_total} reviews)</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={loading || !form.business_name || !form.address}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
        >
          {loading ? "Saving…" : saved ? "✓ Saved!" : "Save & Continue"}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
