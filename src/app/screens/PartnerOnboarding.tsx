import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Search, MapPin, Phone, Globe, Clock, Euro,
  ChevronRight, ChevronLeft, Check, Loader2,
  Plus, Trash2, Sparkles, Zap
} from "lucide-react";

// ─── Google Maps key (same one used in PartnerProfile) ───
const MAPS_KEY = "AIzaSyDx4a7iq1lt4LItVg44_kDmzvlpK7Ftldo";

// ─── Defaults ───
const MASSAGE_TYPES = ["Swedish", "Deep Tissue", "Hot Stone", "Sports", "Aromatherapy", "Thai", "Shiatsu", "Couples", "Facial", "Other"];
const DEFAULT_SERVICES = [
  { name: "Swedish Massage", type: "Swedish", duration: 60, price: 45, description: "Classic relaxation massage" },
  { name: "Deep Tissue Massage", type: "Deep Tissue", duration: 60, price: 55, description: "Targets muscle tension and knots" },
  { name: "Couples Massage", type: "Couples", duration: 60, price: 85, description: "Side-by-side massage for two" },
];
const DAYS = [
  { num: 1, label: "Mon" }, { num: 2, label: "Tue" }, { num: 3, label: "Wed" },
  { num: 4, label: "Thu" }, { num: 5, label: "Fri" }, { num: 6, label: "Sat" }, { num: 0, label: "Sun" },
];
const DEFAULT_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

type Service = { name: string; type: string; duration: number; price: number; description: string };

export default function PartnerOnboarding() {
  const navigate = useNavigate();

  // ─── Section 1: Studio ───
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [studio, setStudio] = useState({
    business_name: "", address: "", phone: "", website: "",
    description: "", city: "Madrid", country: "Spain",
    latitude: 0, longitude: 0, google_place_id: "",
  });

  // ─── Section 2: Services ───
  const [services, setServices] = useState<Service[]>([...DEFAULT_SERVICES]);

  // ─── Section 3: Availability ───
  const [availability, setAvailability] = useState<Record<number, string[]>>({
    1: [...DEFAULT_SLOTS], 2: [...DEFAULT_SLOTS], 3: [...DEFAULT_SLOTS],
    4: [...DEFAULT_SLOTS], 5: [...DEFAULT_SLOTS], 6: [], 0: [],
  });

  // ─── Step 4: Account ───
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Google Places search ───
  const searchPlaces = async (query: string) => {
    if (query.length < 3) { setSearchResults([]); return; }
    try {
      const res = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " massage spa madrid")}&key=${MAPS_KEY}`
        )}`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
      setShowResults(true);
    } catch { /* silent fail */ }
  };

  // ─── Select a place from dropdown ───
  const selectPlace = async (place: any) => {
    setSelectedPlace(place);
    setShowResults(false);
    setSearchQuery(place.name);
    setStudio(prev => ({
      ...prev,
      business_name: place.name,
      address: place.formatted_address || "",
      latitude: place.geometry?.location?.lat || 0,
      longitude: place.geometry?.location?.lng || 0,
      google_place_id: place.place_id,
    }));
    // Fetch details for phone + website
    try {
      const res = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${MAPS_KEY}`
        )}`
      );
      const data = await res.json();
      const d = data.result || {};
      setStudio(prev => ({
        ...prev,
        phone: d.formatted_phone_number || "",
        website: d.website || "",
        description: d.business_status === "OPERATIONAL" ? (d.formatted_address || "") : "",
      }));
    } catch { /* silent fail */ }
  };

  // ─── Service helpers ───
  const addService = () => setServices([...services, { name: "", type: "Swedish", duration: 60, price: 45, description: "" }]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof Service, value: any) => {
    const updated = [...services];
    updated[i] = { ...updated[i], [field]: value };
    setServices(updated);
  };

  // ─── Availability helpers ───
  const toggleDay = (day: number) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].length > 0 ? [] : [...DEFAULT_SLOTS],
    }));
  };
  const toggleSlot = (day: number, slot: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].includes(slot)
        ? prev[day].filter(s => s !== slot)
        : [...prev[day], slot].sort(),
    }));
  };

  // ─── Count progress ───
  const steps = [
    { label: "Your Studio", done: !!studio.business_name },
    { label: "Services", done: services.filter(s => s.name.trim()).length > 0 },
    { label: "Availability", done: Object.values(availability).some(a => a.length > 0) },
    { label: "Go Live", done: false },
  ];
  const completedSteps = steps.filter(s => s.done).length;

  // ─── Submit everything ───
  const handleGoLive = async () => {
    if (!studio.business_name.trim()) { toast.error("Search and select your studio first"); return; }
    if (!services.some(s => s.name.trim())) { toast.error("Add at least one service"); return; }
    if (Object.values(availability).every(a => a.length === 0)) { toast.error("Set your availability"); return; }
    if (!email || !password) { toast.error("Enter your email and password to go live"); return; }

    setLoading(true);
    setError("");

    try {
      // 1. Sign up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: { data: { business_name: studio.business_name } }
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("No user returned");

      const userId = authData.user.id;

      // 2. Save partner record
      await supabase.from("partners").upsert({
        id: userId,
        business_name: studio.business_name,
        email,
        address: studio.address,
        phone: studio.phone,
        website: studio.website,
        description: studio.description,
        city: studio.city,
        country: studio.country,
        latitude: studio.latitude,
        longitude: studio.longitude,
        google_place_id: studio.google_place_id,
        status: "active",
      });

      // 3. Save services
      const validServices = services.filter(s => s.name.trim());
      if (validServices.length > 0) {
        await supabase.from("partner_services").upsert(
          validServices.map(s => ({ partner_id: userId, name: s.name, type: s.type, duration: s.duration, price: s.price, description: s.description })),
          { onConflict: "partner_id,name" }
        );
      }

      // 4. Save availability
      await supabase.from("partner_availability").delete().eq("partner_id", userId);
      const availRows = DAYS.flatMap(day =>
        (availability[day.num] || []).map(slot => ({
          partner_id: userId, day_of_week: day.num, time_slot: slot,
        }))
      );
      if (availRows.length > 0) {
        await supabase.from("partner_availability").insert(availRows);
      }

      toast.success("🎉 Your studio is live on Massage Club!");
      navigate("/partner/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* ─── Header ─── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Zap size={14} />
            Partner Portal
          </div>
          <h1 className="text-2xl font-bold text-gray-900">List your studio</h1>
          <p className="text-gray-500 text-sm mt-1">Join 50+ spas already on Massage Club</p>
        </div>

        {/* ─── Progress dots ─── */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full transition ${step.done ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-xs text-gray-400 hidden sm:block">{step.label}</span>
              {i < steps.length - 1 && <div className="w-4 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════
            STEP 1 — FIND YOUR STUDIO
        ═══════════════════════════════════ */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                {studio.business_name ? <Check size={16} /> : "1"}
              </div>
              <h2 className="font-semibold text-gray-900">Find your studio</h2>
            </div>

            <p className="text-sm text-gray-500 mb-3">Search and we'll auto-fill your address, phone and hours.</p>

            {/* Search box */}
            <div className="relative" ref={searchRef}>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); searchPlaces(e.target.value); }}
                onFocus={() => searchQuery.length >= 3 && setShowResults(true)}
                placeholder="e.g. Casa Delfines Spa, Madrid"
                className="pl-9 h-11"
              />
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((r: any) => (
                    <button
                      key={r.place_id}
                      onClick={() => selectPlace(r)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition"
                    >
                      <div className="font-medium text-sm text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.formatted_address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-filled preview */}
            {studio.business_name && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Check size={16} className="text-green-600" />
                  <span className="font-semibold text-green-800">{studio.business_name}</span>
                </div>
                <div className="space-y-1">
                  {studio.address && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <MapPin size={13} />{studio.address}
                    </div>
                  )}
                  {studio.phone && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Phone size={13} />{studio.phone}
                    </div>
                  )}
                  {studio.website && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Globe size={13} />{studio.website}
                    </div>
                  )}
                </div>
                <p className="text-xs text-green-600 mt-2">✓ Auto-filled from Google — edit anything you need</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════
            STEP 2 — YOUR SERVICES
        ═══════════════════════════════════ */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                {services.some(s => s.name.trim()) ? <Check size={16} /> : "2"}
              </div>
              <h2 className="font-semibold text-gray-900">Your services</h2>
            </div>

            <div className="space-y-3">
              {services.map((svc, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-xl bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-gray-500">Service {i + 1}</span>
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-gray-400 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={svc.name}
                      onChange={e => updateService(i, "name", e.target.value)}
                      placeholder="Service name"
                      className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                    />
                    <select
                      value={svc.type}
                      onChange={e => updateService(i, "type", e.target.value)}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                    >
                      {MASSAGE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2">
                      <Euro size={13} className="text-gray-400" />
                      <input
                        value={svc.price}
                        onChange={e => updateService(i, "price", Number(e.target.value))}
                        type="number"
                        min={0}
                        className="w-full py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <select
                      value={svc.duration}
                      onChange={e => updateService(i, "duration", Number(e.target.value))}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 col-span-2"
                    >
                      {[30,45,60,75,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addService}
              className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-1"
            >
              <Plus size={14} /> Add service
            </button>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════
            STEP 3 — AVAILABILITY
        ═══════════════════════════════════ */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                {Object.values(availability).some(a => a.length > 0) ? <Check size={16} /> : "3"}
              </div>
              <h2 className="font-semibold text-gray-900">Availability</h2>
            </div>

            <p className="text-sm text-gray-500 mb-3">Tap a day to toggle it on/off. Tap times to adjust.</p>

            <div className="space-y-3">
              {DAYS.map(day => (
                <div key={day.num}>
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      onClick={() => toggleDay(day.num)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                        availability[day.num].length > 0
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {day.label}
                    </button>
                    <span className="text-xs text-gray-400">
                      {availability[day.num].length > 0
                        ? `${availability[day.num].length} slots`
                        : "Closed"}
                    </span>
                  </div>
                  {availability[day.num].length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {DEFAULT_SLOTS.map(slot => (
                        <button
                          key={slot}
                          onClick={() => toggleSlot(day.num, slot)}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition ${
                            availability[day.num].includes(slot)
                              ? "bg-blue-100 text-blue-700 border border-blue-300"
                              : "bg-gray-50 text-gray-400 border border-gray-200"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════
            STEP 4 — ACCOUNT (at the end)
        ═══════════════════════════════════ */}
        <Card className="mb-6 border-0 shadow-sm bg-gradient-to-br from-blue-600 to-blue-700">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm font-bold">
                4
              </div>
              <h2 className="font-semibold text-white">Create your account</h2>
            </div>

            <p className="text-blue-100 text-sm mb-4">You're almost done! Create an account to publish your listing.</p>

            <div className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email"
                className="h-11 bg-white/90 border-0 text-gray-900 placeholder:text-gray-400"
              />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create a password"
                className="h-11 bg-white/90 border-0 text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {error && (
              <p className="text-red-200 text-sm mt-2">{error}</p>
            )}

            <div className="mt-4 space-y-2">
              <Button
                onClick={handleGoLive}
                disabled={loading}
                className="w-full h-12 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-base rounded-xl flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Publishing…</>
                ) : (
                  <><Sparkles size={16} /> Publish my listing</>
                )}
              </Button>
              <p className="text-center text-blue-200 text-xs">
                Commission-only · No upfront cost · Cancel anytime
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Already have account? */}
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <button onClick={() => navigate("/partner/login")} className="text-blue-600 font-medium hover:underline">
            Sign in
          </button>
        </p>

      </div>
    </div>
  );
}
