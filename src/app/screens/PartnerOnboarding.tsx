import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Search, MapPin, Phone, Globe, Euro, Check, Loader2,
  Plus, Trash2, Sparkles, Zap, Users, Clock, Shield, Instagram
} from "lucide-react";

// ─── Google Maps key (same one used in PartnerProfile) ───
const MAPS_KEY = "AIzaSyDx4a7iq1lt4LItVg44_kDmzvlpK7Ftldo";

// ─── Defaults ───
const MASSAGE_TYPES = ["Swedish", "Deep Tissue", "Hot Stone", "Sports", "Aromatherapy", "Thai", "Shiatsu", "Couples", "Facial", "Other"];
const SERVICE_CATEGORIES = ["Massage", "Facial", "Body Treatment", "Wellness"];
const AMENITIES = ["Parking", "Wifi", "Showers", "Towels provided", "Wheelchair access", "Card payment", "Changing rooms", "Tea / water"];
const LANGUAGES = ["Spanish", "English", "French", "German", "Portuguese", "Italian", "Chinese"];
const GENDERS = ["Female", "Male", "Any"];

const DEFAULT_SERVICES = [
  { name: "Swedish Massage", category: "Massage", type: "Swedish", duration: 60, price: 45, buffer_after: 15, description: "Classic relaxation massage" },
  { name: "Deep Tissue Massage", category: "Massage", type: "Deep Tissue", duration: 60, price: 55, buffer_after: 15, description: "Targets muscle tension and knots" },
];

const DAYS = [
  { num: 1, label: "Mon" }, { num: 2, label: "Tue" }, { num: 3, label: "Wed" },
  { num: 4, label: "Thu" }, { num: 5, label: "Fri" }, { num: 6, label: "Sat" }, { num: 0, label: "Sun" },
];

type Service = { name: string; category: string; type: string; duration: number; price: number; buffer_after: number; description: string };
type DayHours = { closed: boolean; open: string; close: string; breakStart: string; breakEnd: string };
type Therapist = { name: string; gender: string; specialties: string[]; workingDays: number[] };

const defaultHours = (): Record<number, DayHours> => {
  const h: Record<number, DayHours> = {} as any;
  for (const d of DAYS) {
    const weekend = d.num === 0 || d.num === 6;
    h[d.num] = { closed: weekend, open: "10:00", close: "20:00", breakStart: "", breakEnd: "" };
  }
  return h;
};

/** Build hourly bookable slots between open and close, skipping the break. */
function slotsFromHours(h: DayHours): string[] {
  if (h.closed) return [];
  const toMin = (t: string) => { const [hh, mm] = t.split(":").map(Number); return hh * 60 + (mm || 0); };
  const out: string[] = [];
  const start = toMin(h.open), end = toMin(h.close);
  const bS = h.breakStart ? toMin(h.breakStart) : null;
  const bE = h.breakEnd ? toMin(h.breakEnd) : null;
  for (let m = start; m < end; m += 60) {
    if (bS !== null && bE !== null && m >= bS && m < bE) continue;
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export default function PartnerOnboarding() {
  const navigate = useNavigate();

  // ─── Studio ───
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [studio, setStudio] = useState({
    business_name: "", address: "", phone: "", website: "", instagram: "",
    description: "", city: "Madrid", country: "Spain",
    latitude: 0, longitude: 0, google_place_id: "",
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["Spanish", "English"]);

  // ─── Hours ───
  const [hours, setHours] = useState<Record<number, DayHours>>(defaultHours());

  // ─── Therapists ───
  const [therapists, setTherapists] = useState<Therapist[]>([
    { name: "", gender: "Any", specialties: [], workingDays: [1, 2, 3, 4, 5] },
  ]);

  // ─── Services ───
  const [services, setServices] = useState<Service[]>([...DEFAULT_SERVICES]);

  // ─── Policies ───
  const [cancellationHours, setCancellationHours] = useState(24);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositPct, setDepositPct] = useState(20);

  // ─── Account ───
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
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
    } catch { /* silent */ }
  };

  const selectPlace = async (place: any) => {
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
    try {
      const res = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${MAPS_KEY}`
        )}`
      );
      const data = await res.json();
      const d = data.result || {};
      setStudio(prev => ({ ...prev, phone: d.formatted_phone_number || "", website: d.website || "" }));
    } catch { /* silent */ }
  };

  // ─── Helpers ───
  const toggleArr = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const updateHours = (day: number, patch: Partial<DayHours>) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const addService = () => setServices([...services, { name: "", category: "Massage", type: "Swedish", duration: 60, price: 45, buffer_after: 15, description: "" }]);
  const removeService = (i: number) => setServices(services.filter((_, idx) => idx !== i));
  const updateService = (i: number, field: keyof Service, value: any) =>
    setServices(services.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const addTherapist = () => setTherapists([...therapists, { name: "", gender: "Any", specialties: [], workingDays: [1, 2, 3, 4, 5] }]);
  const removeTherapist = (i: number) => setTherapists(therapists.filter((_, idx) => idx !== i));
  const updateTherapist = (i: number, patch: Partial<Therapist>) =>
    setTherapists(therapists.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  const businessName = (studio.business_name || searchQuery).trim();
  const openDays = DAYS.filter(d => !hours[d.num].closed);

  // ─── Submit everything ───
  const handleGoLive = async () => {
    if (!businessName) { toast.error("Enter your studio name first"); return; }
    if (!services.some(s => s.name.trim())) { toast.error("Add at least one service"); return; }
    if (openDays.length === 0) { toast.error("Set your opening hours for at least one day"); return; }
    if (!therapists.some(t => t.name.trim())) { toast.error("Add at least one therapist"); return; }
    if (!email || !password) { toast.error("Enter your email and password to go live"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setLoading(true);
    setError("");

    try {
      // 1. Account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email, password, options: { data: { business_name: businessName } },
      });
      let session = authData?.session ?? null;
      if (signUpError) {
        const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) throw new Error(signUpError.message);
        session = si.session;
      }
      if (!session) {
        const { data: si } = await supabase.auth.signInWithPassword({ email, password });
        session = si?.session ?? null;
      }
      if (!session) {
        throw new Error("Account created — confirm your email then sign in. (Tip: disable “Confirm email” in Supabase → Authentication to go live instantly.)");
      }
      const userId = session.user.id;

      // 2. Studio profile
      const { error: pErr } = await supabase.from("partners").upsert({
        id: userId,
        business_name: businessName,
        email,
        address: studio.address,
        phone: studio.phone,
        website: studio.website,
        instagram: studio.instagram || null,
        description: studio.description,
        city: studio.city,
        country: studio.country,
        latitude: studio.latitude || null,
        longitude: studio.longitude || null,
        google_place_id: studio.google_place_id || null,
        amenities,
        languages,
        cancellation_hours: cancellationHours,
        deposit_required: depositRequired,
        deposit_pct: depositRequired ? depositPct : 0,
        status: "active",
      });
      if (pErr) throw new Error(`Could not save your studio: ${pErr.message}`);

      // 3. Opening hours
      await supabase.from("business_hours").delete().eq("partner_id", userId);
      const hourRows = openDays.map(d => ({
        partner_id: userId, day_of_week: d.num,
        open_time: hours[d.num].open, close_time: hours[d.num].close,
        break_start: hours[d.num].breakStart || null, break_end: hours[d.num].breakEnd || null,
      }));
      if (hourRows.length) {
        const { error } = await supabase.from("business_hours").insert(hourRows);
        if (error) throw new Error(`Could not save opening hours: ${error.message}`);
      }

      // 4. Services (return ids so we can link therapists)
      const validServices = services.filter(s => s.name.trim());
      const { data: savedServices, error: sErr } = await supabase.from("partner_services").upsert(
        validServices.map(s => ({
          partner_id: userId, name: s.name, type: s.type, category: s.category,
          duration: s.duration, price: s.price, buffer_after: s.buffer_after, description: s.description,
        })),
        { onConflict: "partner_id,name" }
      ).select("id");
      if (sErr) throw new Error(`Could not save your services: ${sErr.message}`);
      const serviceIds = (savedServices ?? []).map(s => s.id);

      // 5. Therapists (replace) — cascade clears their hours & service links
      await supabase.from("therapists").delete().eq("partner_id", userId);
      const validTherapists = therapists.filter(t => t.name.trim());
      const { data: savedTherapists, error: tErr } = await supabase.from("therapists").insert(
        validTherapists.map(t => ({
          partner_id: userId, name: t.name, gender: t.gender,
          specialties: t.specialties, languages, is_active: true,
        }))
      ).select("id");
      if (tErr) throw new Error(`Could not save therapists: ${tErr.message}`);
      const savedT = savedTherapists ?? [];

      // 6. Therapist working hours (use studio open/close for the days they work)
      const thoursRows = savedT.flatMap((row, idx) =>
        validTherapists[idx].workingDays
          .filter(day => !hours[day].closed)
          .map(day => ({
            therapist_id: row.id, day_of_week: day,
            start_time: hours[day].open, end_time: hours[day].close,
          }))
      );
      if (thoursRows.length) await supabase.from("therapist_hours").insert(thoursRows);

      // 7. Link every therapist to every service (MVP: everyone does everything)
      const linkRows = savedT.flatMap(row => serviceIds.map(sid => ({ therapist_id: row.id, service_id: sid })));
      if (linkRows.length) await supabase.from("therapist_services").insert(linkRows);

      // 8. Auto-generate bookable slots from opening hours (keeps customer app working)
      await supabase.from("partner_availability").delete().eq("partner_id", userId);
      const slotRows = openDays.flatMap(d =>
        slotsFromHours(hours[d.num]).map(slot => ({ partner_id: userId, day_of_week: d.num, time_slot: slot }))
      );
      if (slotRows.length) await supabase.from("partner_availability").insert(slotRows);

      toast.success("🎉 Your studio is live on Massage Club!");
      navigate("/partner/dashboard");
    } catch (err: any) {
      const msg = err?.message || "Something went wrong";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Progress ───
  const steps = [
    { label: "Studio", done: !!businessName },
    { label: "Hours", done: openDays.length > 0 },
    { label: "Team", done: therapists.some(t => t.name.trim()) },
    { label: "Services", done: services.some(s => s.name.trim()) },
    { label: "Go Live", done: false },
  ];

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Zap size={14} /> Partner Portal
          </div>
          <h1 className="text-2xl font-bold text-gray-900">List your studio</h1>
          <p className="text-gray-500 text-sm mt-1">Set up your profile, team and services in a few minutes</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full transition ${step.done ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-xs text-gray-400 hidden sm:block">{step.label}</span>
              {i < steps.length - 1 && <div className="w-3 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* ─── STEP 1: STUDIO ─── */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <SectionTitle n="1" done={!!businessName} title="Your studio" />
            <p className="text-sm text-gray-500 mb-3">Search to auto-fill, or enter details manually.</p>

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
                    <button key={r.place_id} onClick={() => selectPlace(r)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition">
                      <div className="font-medium text-sm text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.formatted_address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {studio.business_name && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Check size={16} className="text-green-600" />
                  <span className="font-semibold text-green-800">{studio.business_name}</span>
                </div>
                {studio.address && <div className="flex items-center gap-2 text-sm text-green-700"><MapPin size={13} />{studio.address}</div>}
                {studio.phone && <div className="flex items-center gap-2 text-sm text-green-700"><Phone size={13} />{studio.phone}</div>}
                {studio.website && <div className="flex items-center gap-2 text-sm text-green-700"><Globe size={13} />{studio.website}</div>}
              </div>
            )}

            {!studio.business_name && (
              <button onClick={() => setManualEntry(v => !v)} className="mt-3 text-xs text-blue-600 font-medium hover:underline">
                {manualEntry ? "← Back to search" : "Can't find your studio? Enter details manually"}
              </button>
            )}
            {manualEntry && !studio.business_name && (
              <div className="mt-3 space-y-2">
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Studio / business name" className="h-11" />
                <Input value={studio.address} onChange={e => setStudio(p => ({ ...p, address: e.target.value }))} placeholder="Address" className="h-11" />
                <Input value={studio.phone} onChange={e => setStudio(p => ({ ...p, phone: e.target.value }))} placeholder="Phone (optional)" className="h-11" />
              </div>
            )}

            {/* Description + Instagram */}
            <textarea
              value={studio.description}
              onChange={e => setStudio(p => ({ ...p, description: e.target.value }))}
              placeholder="Short description of your studio (shown to customers)"
              className="mt-3 w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none h-20"
            />
            <div className="relative mt-2">
              <Instagram size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={studio.instagram} onChange={e => setStudio(p => ({ ...p, instagram: e.target.value }))} placeholder="@instagram (optional)" className="pl-9 h-11" />
            </div>

            {/* Amenities */}
            <p className="text-xs font-semibold text-gray-500 mt-4 mb-2">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button key={a} onClick={() => toggleArr(amenities, a, setAmenities)} className={chip(amenities.includes(a))}>{a}</button>
              ))}
            </div>

            {/* Languages */}
            <p className="text-xs font-semibold text-gray-500 mt-4 mb-2">Languages spoken</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(l => (
                <button key={l} onClick={() => toggleArr(languages, l, setLanguages)} className={chip(languages.includes(l))}>{l}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── STEP 2: HOURS ─── */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <SectionTitle n="2" done={openDays.length > 0} title="Opening hours" icon={<Clock size={15} />} />
            <p className="text-sm text-gray-500 mb-3">Set when you're open. Add a lunch break if you close midday.</p>
            <div className="space-y-2">
              {DAYS.map(d => {
                const h = hours[d.num];
                return (
                  <div key={d.num} className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => updateHours(d.num, { closed: !h.closed })}
                      className={`w-16 py-1.5 rounded-lg text-sm font-medium transition ${h.closed ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white"}`}
                    >{d.label}</button>
                    {h.closed ? (
                      <span className="text-xs text-gray-400">Closed</span>
                    ) : (
                      <div className="flex items-center gap-1 text-sm">
                        <TimeInput value={h.open} onChange={v => updateHours(d.num, { open: v })} />
                        <span className="text-gray-400">–</span>
                        <TimeInput value={h.close} onChange={v => updateHours(d.num, { close: v })} />
                        <span className="text-gray-300 mx-1 text-xs">break</span>
                        <TimeInput value={h.breakStart} onChange={v => updateHours(d.num, { breakStart: v })} placeholder="--" />
                        <TimeInput value={h.breakEnd} onChange={v => updateHours(d.num, { breakEnd: v })} placeholder="--" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ─── STEP 3: TEAM ─── */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <SectionTitle n="3" done={therapists.some(t => t.name.trim())} title="Your team" icon={<Users size={15} />} />
            <p className="text-sm text-gray-500 mb-3">Add the therapists who give massages. Customers book with a specific person.</p>
            <div className="space-y-3">
              {therapists.map((t, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-xl bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-gray-500">Therapist {i + 1}</span>
                    {therapists.length > 1 && (
                      <button onClick={() => removeTherapist(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={t.name} onChange={e => updateTherapist(i, { name: e.target.value })} placeholder="Name"
                      className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
                    <select value={t.gender} onChange={e => updateTherapist(i, { gender: e.target.value })}
                      className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                      {GENDERS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 mb-1">Specialties</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MASSAGE_TYPES.map(m => (
                      <button key={m}
                        onClick={() => updateTherapist(i, { specialties: t.specialties.includes(m) ? t.specialties.filter(x => x !== m) : [...t.specialties, m] })}
                        className={chip(t.specialties.includes(m))}>{m}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 mb-1">Working days</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map(d => (
                      <button key={d.num}
                        onClick={() => updateTherapist(i, { workingDays: t.workingDays.includes(d.num) ? t.workingDays.filter(x => x !== d.num) : [...t.workingDays, d.num] })}
                        className={chip(t.workingDays.includes(d.num))}>{d.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addTherapist}
              className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-1">
              <Plus size={14} /> Add therapist
            </button>
          </CardContent>
        </Card>

        {/* ─── STEP 4: SERVICES ─── */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <SectionTitle n="4" done={services.some(s => s.name.trim())} title="Your services" />
            <div className="space-y-3">
              {services.map((svc, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-xl bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-gray-500">Service {i + 1}</span>
                    {services.length > 1 && (
                      <button onClick={() => removeService(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={svc.name} onChange={e => updateService(i, "name", e.target.value)} placeholder="Service name"
                      className="col-span-2 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
                    <select value={svc.category} onChange={e => updateService(i, "category", e.target.value)}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                      {SERVICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <select value={svc.type} onChange={e => updateService(i, "type", e.target.value)}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                      {MASSAGE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2">
                      <Euro size={13} className="text-gray-400" />
                      <input value={svc.price} onChange={e => updateService(i, "price", Number(e.target.value))} type="number" min={0}
                        className="w-full py-2 text-sm focus:outline-none" />
                    </div>
                    <select value={svc.duration} onChange={e => updateService(i, "duration", Number(e.target.value))}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                      {[30, 45, 60, 75, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                    <select value={svc.buffer_after} onChange={e => updateService(i, "buffer_after", Number(e.target.value))}
                      className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 col-span-2">
                      {[0, 10, 15, 20, 30].map(b => <option key={b} value={b}>{b} min cleanup after</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addService}
              className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-1">
              <Plus size={14} /> Add service
            </button>
          </CardContent>
        </Card>

        {/* ─── STEP 5: POLICIES ─── */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-5">
            <SectionTitle n="5" done title="Booking policy" icon={<Shield size={15} />} />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Free cancellation up to</span>
              <select value={cancellationHours} onChange={e => setCancellationHours(Number(e.target.value))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                {[0, 2, 4, 12, 24, 48].map(h => <option key={h} value={h}>{h === 0 ? "No free cancellation" : `${h}h before`}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-sm text-gray-700">Require a deposit</span>
              <button onClick={() => setDepositRequired(v => !v)}
                className={`w-12 h-6 rounded-full transition relative ${depositRequired ? "bg-blue-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full transition ${depositRequired ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            {depositRequired && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Deposit amount</span>
                <select value={depositPct} onChange={e => setDepositPct(Number(e.target.value))}
                  className="text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                  {[10, 20, 30, 50, 100].map(p => <option key={p} value={p}>{p}% of price</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── STEP 6: ACCOUNT ─── */}
        <Card className="mb-6 border-0 shadow-sm bg-gradient-to-br from-blue-600 to-blue-700">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm font-bold">6</div>
              <h2 className="font-semibold text-white">Create your account</h2>
            </div>
            <div className="space-y-3">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email"
                className="h-11 bg-white/90 border-0 text-gray-900 placeholder:text-gray-400" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password (6+ characters)"
                className="h-11 bg-white/90 border-0 text-gray-900 placeholder:text-gray-400" />
            </div>
            {error && <p className="text-red-200 text-sm mt-2">{error}</p>}
            <div className="mt-4 space-y-2">
              <Button onClick={handleGoLive} disabled={loading}
                className="w-full h-12 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-base rounded-xl flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Publishing…</> : <><Sparkles size={16} /> Publish my listing</>}
              </Button>
              <p className="text-center text-blue-200 text-xs">Commission-only · No upfront cost · Cancel anytime</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <button onClick={() => navigate("/partner/login")} className="text-blue-600 font-medium hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
}

// ─── Small UI helpers ───
function SectionTitle({ n, done, title, icon }: { n: string; done?: boolean; title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
        {done ? <Check size={16} /> : n}
      </div>
      <h2 className="font-semibold text-gray-900 flex items-center gap-1.5">{icon}{title}</h2>
    </div>
  );
}

function TimeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-[84px] text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
    />
  );
}
