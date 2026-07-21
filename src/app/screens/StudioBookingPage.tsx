import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { supabase, fetchStudioProfile, type StudioProfile } from "@/lib/supabase";
import { studioWhatsappUrl } from "@/app/lib/whatsapp";
import {
  MapPin, Clock, Euro, Check, Loader2, Star, Sparkles,
  Phone, Instagram, MessageCircle, CalendarDays
} from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRESSURE_LEVELS = ["Light", "Medium", "Firm", "Deep"];
const FOCUS_AREAS = ["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet", "Arms", "Hands"];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function StudioBookingPage() {
  const { studioId } = useParams();
  const [searchParams] = useSearchParams();
  const rebookId = searchParams.get("rebook");
  const [profile, setProfile] = useState<StudioProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // How many bookings already exist for each `date__time` slot.
  // A slot is full only when this count reaches the studio's therapist count.
  const [slotCounts, setSlotCounts] = useState<Map<string, number>>(new Map());

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Customize
  const [pressure, setPressure] = useState("Medium");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [addonNames, setAddonNames] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [conversationPref, setConversationPref] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [error, setError] = useState("");
  const [profileAllergies, setProfileAllergies] = useState<string>("");
  const [profileHealthNotes, setProfileHealthNotes] = useState<string>("");
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [prefsApplied, setPrefsApplied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Rebook fast-path: when true, hide expanded pickers and show a summary card.
  const [rebookMode, setRebookMode] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);




  useEffect(() => {
    if (!studioId) return;
    (async () => {
      // The param can be a partner UUID or a friendly slug (book.<domain>/<slug>).
      let resolvedId = studioId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studioId);
      if (!isUuid) {
        const { data: bySlug } = await supabase
          .from("partners")
          .select("id")
          .eq("slug", studioId)
          .maybeSingle();
        if (!bySlug?.id) { setLoading(false); return; }
        resolvedId = bySlug.id;
      }
      const p = await fetchStudioProfile(resolvedId);
      setProfile(p);
      if (p) {
        // Count how many bookings already exist per slot, so a slot only
        // disappears once EVERY therapist is busy at that time (real capacity).
        const { data } = await supabase.rpc("booked_slot_counts", { p_partner_id: resolvedId });
        const counts = new Map<string, number>();
        for (const b of (data as any[]) || []) {
          const key = `${b.booking_date}__${b.booking_time}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        setSlotCounts(counts);

        const { data: rs } = await supabase
          .from("partner_rating_summary")
          .select("rating_avg, rating_count")
          .eq("partner_id", resolvedId)
          .maybeSingle();
        if (rs && (rs as any).rating_count > 0) {
          setRating({ avg: Number((rs as any).rating_avg), count: Number((rs as any).rating_count) });
        }
      }

      setLoading(false);
    })();
  }, [studioId]);


  // Pre-fill name + email + phone if the customer is signed in.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setEmail(prev => prev || user.email || "");
      setName(prev => prev || fullName);
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone, preferred_pressure, focus_areas, allergies, health_notes, conversation_pref, music_pref, temperature_pref, scent_pref, lighting_pref, comfort_notes")
        .eq("id", user.id)
        .single();
      if (prof) {
        setCustomerProfile(prof);
        setName(prev => prev || prof.full_name || "");
        setPhone(prev => prev || prof.phone || "");
        setProfileAllergies(prof.allergies || "");
        setProfileHealthNotes(prof.health_notes || "");
        // Only auto-apply massage prefs when NOT rebooking (rebook effect wins).
        if (!rebookId) {
          let applied = false;
          if (prof.preferred_pressure) {
            setPressure(prev => (prev === "Medium" ? prof.preferred_pressure : prev));
            applied = true;
          }
          if (Array.isArray(prof.focus_areas) && prof.focus_areas.length) {
            setFocusAreas(prev => (prev.length === 0 ? prof.focus_areas : prev));
            applied = true;
          }
          if (prof.conversation_pref) {
            setConversationPref(prev => prev || prof.conversation_pref);
            applied = true;
          }
          if (applied) setPrefsApplied(true);
        }
      }

    })();
  }, []);

  // Rebook fast-path: prefill service + preferences + contact from a previous booking.
  useEffect(() => {
    if (!rebookId || !profile) return;
    (async () => {
      const { data: prev, error: err } = await supabase
        .from("bookings")
        .select("service_id, massage_type, pressure, focus_areas, add_ons, notes, client_name, client_phone, client_email")
        .eq("id", rebookId)
        .maybeSingle();
      if (err || !prev) return; // silently fall back to normal flow

      // Resolve the service: prefer id, then name, then type match.
      let match = profile.services.find(s => s.id === (prev as any).service_id) || null;
      if (!match && prev.massage_type) {
        match =
          profile.services.find(s => s.name === prev.massage_type) ||
          profile.services.find((s: any) => s.type === prev.massage_type) ||
          null;
      }
      if (!match) return; // service no longer offered — exit rebook mode

      setServiceId(match.id);
      if (prev.pressure) setPressure(prev.pressure);
      if (Array.isArray(prev.focus_areas)) setFocusAreas(prev.focus_areas);
      const availableAddons = new Set((profile.addons ?? []).map((a: any) => a.name));
      if (Array.isArray(prev.add_ons)) {
        setAddonNames(prev.add_ons.filter((n: string) => availableAddons.has(n)));
      }
      if (prev.notes) setNotes(prev.notes);
      if (prev.client_name) setName(prev.client_name);
      if (prev.client_phone) setPhone(prev.client_phone);
      if (prev.client_email) setEmail(prev.client_email);
      setRebookMode(true);
    })();
  }, [rebookId, profile]);




  // availability grouped by weekday (0=Sun..6=Sat)
  const slotsByDay = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (const a of profile?.availability ?? []) {
      const d = Number(a.day_of_week);
      (m[d] ||= []).push(a.time_slot);
    }
    for (const k of Object.keys(m)) m[Number(k)].sort();
    return m;
  }, [profile]);

  // next 21 days that the studio is open
  const openDates = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 21 && out.length < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if ((slotsByDay[d.getDay()] || []).length > 0) out.push(d);
    }
    return out;
  }, [slotsByDay]);

  const service = profile?.services.find(s => s.id === serviceId) || null;

  // Studio capacity = how many therapists work in parallel (min 1).
  const therapistCount = Math.max(1, Number(profile?.partner?.capacity) || 0, profile?.therapists?.length || 0);

  // Spots still open for a given slot on the selected date.
  const remainingFor = (t: string) =>
    date ? therapistCount - (slotCounts.get(`${isoDate(date)}__${t}`) || 0) : 0;

  // Only show a time while at least one therapist is still free for it.
  const times = date
    ? (slotsByDay[date.getDay()] || []).filter(t => remainingFor(t) > 0)
    : [];

  const addons = profile?.addons ?? [];
  const addonsTotal = addons
    .filter((a: any) => addonNames.includes(a.name))
    .reduce((sum: number, a: any) => sum + Number(a.price || 0), 0);
  const total = (Number(service?.price) || 0) + addonsTotal;
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a0709]">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a0709] text-white p-8 text-center">
        <p className="text-lg font-semibold">Studio not found</p>
        <p className="text-white/60 text-sm mt-1">This booking link may be inactive.</p>
      </div>
    );
  }

  const { partner } = profile;

  // ─── Confirmation screen ───
  if (done) {
    const prettyDate = date ? `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}` : "";
    const waMsg = `¡Hola ${partner.business_name}! Acabo de reservar ${service?.name} para el ${prettyDate} a las ${time} a través de Massage Club. Soy ${name}. ¡Nos vemos! 🙏`;
    const waLink = studioWhatsappUrl((partner as any).whatsapp || partner.phone, waMsg);
    // Let the customer drop the appointment into their own calendar.
    const gcal = (() => {
      if (!date || !time || !service) return null;
      const [h, m] = time.split(":").map(Number);
      const start = new Date(date); start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + (service.duration || 60) * 60000);
      const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const text = encodeURIComponent(`${service.name} — ${partner.business_name}`);
      const details = encodeURIComponent(`Massage Club booking · Ref ${done.ref}`);
      const loc = encodeURIComponent(partner.address || partner.business_name || "");
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${z(start)}/${z(end)}&details=${details}&location=${loc}`;
    })();
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FAF6F1" }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden text-center" style={{ background: "#ffffff", boxShadow: "0 6px 24px rgba(80,44,20,0.08)" }}>
          <div className="flex items-center justify-center gap-2 py-3 px-4" style={{ background: "#B85C38", borderRadius: "1rem 1rem 0 0" }}>
            <img src="/brand/mc-avatar-cream.png" alt="Massage Club" width={26} height={26} className="rounded-full" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "2px" }}>MASSAGE CLUB</span>
          </div>
          <div className="px-6 py-7">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: "#B85C38", letterSpacing: "2.5px" }}>TU CITA EN</div>
            <div className="text-xs mb-5" style={{ color: "#8a7460" }}>Your appointment at</div>
            <h1 className="font-display text-3xl font-bold leading-tight mb-3" style={{ color: "#2b2b2b" }}>{partner.business_name}</h1>
            <p className="text-base font-semibold mb-6" style={{ color: "#3d2b1f" }}>
              ¡Tu reserva está hecha! 🎉
              <span className="block text-sm font-normal mt-0.5" style={{ color: "#8a7460" }}>You're booked!</span>
            </p>
            <div className="rounded-xl p-4 mb-5 text-left" style={{ background: "#FAF6F1" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "#3d2b1f" }}>
                {service?.name} · {service?.duration} min · {total}€
              </div>
              <div className="text-base font-bold mb-1" style={{ color: "#B85C38" }}>
                {prettyDate} · {time}
              </div>
              {partner.address && (
                <div className="text-sm flex items-start gap-1.5" style={{ color: "#5a4736" }}>
                  <span>📍</span>
                  <span>{partner.address}</span>
                </div>
              )}
            </div>
            <div className="inline-flex items-center justify-center px-4 py-2 rounded-full font-mono text-xs mb-5" style={{ background: "#FAF6F1", color: "#5a4736" }}>
              {done.ref}
            </div>
            <p className="text-sm mb-6" style={{ color: "#8a7460" }}>
              El estudio confirmará tu cita en breve.
              <span className="block text-xs mt-0.5">The studio will confirm your appointment shortly.</span>
            </p>
            <div className="flex flex-col items-center gap-3 w-full">
              {gcal && (
                <a href={gcal} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-semibold" style={{ background: "#B85C38", color: "#fff" }}>
                  <CalendarDays size={18} /> Add to my calendar
                </a>
              )}
              {waLink && (
                <a href={waLink} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                  <MessageCircle size={18} /> Confirm on WhatsApp
                </a>
              )}
            </div>
            <div className="mt-6 text-xs" style={{ color: "#8a7460" }}>
              Massage Club · Madrid · book.massageclub.io
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Name + at least one way to reach them (phone OR email). Phone is no longer required.
  const canBook = service && date && time && name.trim() && (phone.trim() || email.trim());

  const handleBook = async () => {
    if (!canBook) return;
    setSubmitting(true);
    setError("");
    const comfortPrefs = {
      conversation: conversationPref || customerProfile?.conversation_pref || null,
      music: customerProfile?.music_pref || null,
      temperature: customerProfile?.temperature_pref || null,
      scent: customerProfile?.scent_pref || null,
      lighting: customerProfile?.lighting_pref || null,
      notes: customerProfile?.comfort_notes || null,
    };


    try {
      const { data, error } = await supabase.from("bookings").insert({
        client_name: name.trim(),
        client_phone: phone.trim(),
        client_email: email.trim() || null,
        spa_name: partner.business_name,
        massage_type: service.type || service.name,
        service_id: service.id,
        partner_id: partner.id,
        booking_date: isoDate(date!),
        booking_time: time,
        duration: service.duration ?? 60,
        price: total,
        pressure,
        focus_areas: focusAreas,
        add_ons: addonNames,
        notes: notes.trim() || null,
        allergies: profileAllergies || null,
        health_notes: profileHealthNotes || null,
        status: "pending",
        user_id: userId,
        lang: (localStorage.getItem("mm-lang") || navigator.language || "es").slice(0, 2),
        comfort_prefs: comfortPrefs,
      }).select("id").single();


      if (error) throw new Error(error.message);

      // Fire the notification emails directly (more reliable than the DB webhook).
      try {
        await supabase.functions.invoke("notify-studio", {
          body: {
            type: "INSERT",
            table: "bookings",
            record: {
              id: data.id,
              partner_id: partner.id,
              client_name: name.trim(),
              client_phone: phone.trim(),
              client_email: email.trim() || null,
              massage_type: service.type || service.name,
              booking_date: isoDate(date!),
              booking_time: time,
              duration: service.duration ?? 60,
              spa_name: partner.business_name,
              pressure,
              focus_areas: focusAreas,
              add_ons: addonNames,
              notes: notes.trim() || null,
              allergies: profileAllergies || null,
              health_notes: profileHealthNotes || null,
              lang: (localStorage.getItem("mm-lang") || navigator.language || "es").slice(0, 2),
              comfort_prefs: comfortPrefs,
            },
          },
        });
      } catch (notifyErr) {
        console.error("[booking] notify-studio invoke failed:", notifyErr);
      }

      setSlotCounts(prev => {
        const next = new Map(prev);
        const key = `${isoDate(date!)}__${time}`;
        next.set(key, (next.get(key) || 0) + 1);
        return next;
      });
      setDone({ ref: `MR-2026-${String(data.id).padStart(4, "0")}` });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (/fully booked/i.test(msg)) {
        // Refresh slot counts from the server so the UI reflects reality.
        try {
          const { data } = await supabase.rpc("booked_slot_counts", { p_partner_id: partner.id });
          const counts = new Map<string, number>();
          for (const b of (data as any[]) || []) {
            const key = `${b.booking_date}__${b.booking_time}`;
            counts.set(key, (counts.get(key) || 0) + 1);
          }
          setSlotCounts(counts);
        } catch {}
        setTime("");
        setError("Esa hora se acaba de llenar — elige otra / That time just filled up — pick another");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4F0]">
      {/* Hero */}
      <div className="relative h-44 bg-gradient-to-br from-[#C4622D] to-[#5b0a16]">
        {partner.cover_url && (
          <img src={partner.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-0 right-0 px-5 max-w-lg mx-auto">
          <div className="flex items-end gap-3">
            {partner.logo_url && (
              <img src={partner.logo_url} alt="" className="h-14 w-14 rounded-2xl object-cover border-2 border-white/80 shadow-lg flex-shrink-0" />
            )}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold mb-2">
                <Sparkles size={12} /> Book your massage
              </div>
              <h1 className="text-2xl font-bold text-white leading-tight">{partner.business_name}</h1>
              {rating && (
                <p className="text-white/95 text-sm font-semibold mt-0.5 flex items-center gap-1">
                  <span style={{ color: "#E0A458" }}>★</span>
                  {rating.avg.toFixed(1)} <span className="text-white/70 font-normal">({rating.count})</span>
                </p>
              )}
              {partner.address && (
                <p className="text-white/80 text-sm flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {partner.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-5 space-y-5">
        {/* About */}
        {partner.description && <p className="text-sm text-gray-600">{partner.description}</p>}

        {/* Quick facts */}
        <div className="flex flex-wrap gap-2">
          {(partner.languages || []).slice(0, 4).map((l: string) => (
            <span key={l} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600">{l}</span>
          ))}
          {(partner.amenities || []).slice(0, 4).map((a: string) => (
            <span key={a} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600">{a}</span>
          ))}
        </div>

        {/* Gallery */}
        {(partner.gallery || []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {partner.gallery.map((url: string, i: number) => (
              <img key={i} src={url} alt="" className="h-28 w-40 flex-shrink-0 rounded-xl object-cover border border-gray-200" />
            ))}
          </div>
        )}

        {/* Rebook summary card — Amazon-style "your usual" fast path */}
        {rebookMode && service && (
          <div className="rounded-2xl border-2 border-[#C4622D] bg-[#C4622D]/5 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 bg-[#C4622D] text-white px-2.5 py-1 rounded-full text-[11px] font-semibold">
                <Sparkles size={11} /> Tu reserva habitual
              </div>
              <button
                onClick={() => setRebookMode(false)}
                className="text-xs font-semibold text-[#C4622D] underline underline-offset-2"
              >
                Cambiar
              </button>
            </div>
            <p className="font-semibold text-gray-900">{service.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {service.duration} min</span>
              <span className="inline-flex items-center gap-0.5"><Euro size={11} />{service.price}</span>
            </p>
            {(pressure || focusAreas.length > 0 || addonNames.length > 0) && (
              <p className="text-xs text-gray-600 mt-2">
                {[
                  pressure && `Presión: ${pressure}`,
                  focusAreas.length > 0 && `Zonas: ${focusAreas.join(", ")}`,
                  addonNames.length > 0 && `Extras: ${addonNames.join(", ")}`,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* 1. Service (hidden in rebook mode — the summary card above replaces it) */}
        {!rebookMode && (
        <Section step="1" title="Choose a service">
          <div className="space-y-2">
            {profile.services.map(s => (
              <button key={s.id} onClick={() => setServiceId(s.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                  serviceId === s.id ? "border-[#C4622D] bg-[#C4622D]/5" : "border-gray-200 bg-white"
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={11} /> {s.duration} min</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#C4622D] flex items-center gap-0.5"><Euro size={13} />{s.price}</p>
                  </div>
                </div>
              </button>

            ))}
            {profile.services.length === 0 && <p className="text-sm text-gray-400">No services listed yet.</p>}
          </div>
        </Section>
        )}



        {/* 2. Date */}
        {service && (
          <Section step="2" title="Pick a day">
            {openDates.length === 0 ? (
              <p className="text-sm text-gray-400">No availability set yet — message the studio directly.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {openDates.map(d => {
                  const active = date && isoDate(d) === isoDate(date);
                  return (
                    <button key={isoDate(d)} onClick={() => { setDate(d); setTime(null); }}
                      className={`flex-shrink-0 w-16 py-2.5 rounded-2xl border-2 text-center transition ${
                        active ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                      }`}>
                      <div className="text-[10px] uppercase opacity-70">{DAY_LABELS[d.getDay()]}</div>
                      <div className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</div>
                      <div className="text-[10px] opacity-70">{MONTHS[d.getMonth()]}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* 3. Time */}
        {service && date && (
          <Section step="3" title="Pick a time">
            {times.length === 0 ? (
              <p className="text-sm text-gray-400">Fully booked that day — try another date.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {times.map(t => {
                  const left = remainingFor(t);
                  const lowStock = therapistCount > 1 && left < therapistCount;
                  return (
                    <button key={t} onClick={() => setTime(t)}
                      className={`px-3.5 py-2 rounded-xl border-2 text-sm font-medium transition ${
                        time === t ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                      }`}>
                      {t}
                      {lowStock && (
                        <span className={`block text-[10px] font-normal ${time === t ? "text-white/80" : "text-amber-600"}`}>
                          {left} left
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* 4. Customize */}
        {!rebookMode && service && date && time && (

          <Section step="4" title="Customize your session">
            {customerProfile && prefsApplied && (
              <div className="mb-4 rounded-xl border border-[#C4622D]/30 bg-[#C4622D]/5 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">✨ Prefilled from your profile</span>
                <button
                  type="button"
                  onClick={() => {
                    setPressure("Medium");
                    setFocusAreas([]);
                    setAddonNames([]);
                    setConversationPref("");
                    setPrefsApplied(false);
                  }}
                  className="text-xs font-semibold text-[#C4622D] underline"
                >
                  Start blank
                </button>
              </div>
            )}
            <p className="text-xs font-semibold text-gray-500 mb-2">Comfort</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { v: "silence", l: "🤫 Silence" },
                { v: "minimal", l: "A little chat" },
                { v: "chatty", l: "Happy to chat" },
              ].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setConversationPref(prev => prev === o.v ? "" : o.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    conversationPref === o.v
                      ? "bg-[#C4622D] text-white border-[#C4622D]"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-500 mb-2">Pressure</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESSURE_LEVELS.map(p => (
                <button key={p} onClick={() => setPressure(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    pressure === p ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                  }`}>{p}</button>
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-500 mb-2">Focus areas</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {FOCUS_AREAS.map(f => (
                <button key={f} onClick={() => toggle(focusAreas, f, setFocusAreas)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    focusAreas.includes(f) ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                  }`}>{f}</button>
              ))}
            </div>

            {addons.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 mb-2">Add-ons</p>
                <div className="space-y-2 mb-4">
                  {addons.map((a: any) => {
                    const on = addonNames.includes(a.name);
                    return (
                      <button key={a.id} onClick={() => toggle(addonNames, a.name, setAddonNames)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition ${
                          on ? "border-[#C4622D] bg-[#C4622D]/5" : "border-gray-200 bg-white"
                        }`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.name}</p>
                          <p className="text-xs text-gray-400">+€{a.price}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${on ? "border-[#C4622D] bg-[#C4622D]" : "border-gray-300"}`}>
                          {on && <Check size={12} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <p className="text-xs font-semibold text-gray-500 mb-2">Notes for your therapist</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Anything we should know? Injuries, allergies, preferences…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#C4622D] resize-none h-24" />
          </Section>
        )}

        {/* 5. Your details — collapsed one-liner in rebook mode when we have contact info */}
        {service && date && time && rebookMode && !contactExpanded && (name || email || phone) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-2">
            <p className="text-sm text-gray-700 truncate">
              {[name, phone, email].filter(Boolean).join(" · ")}
            </p>
            <button
              onClick={() => setContactExpanded(true)}
              className="text-xs font-semibold text-[#C4622D] underline underline-offset-2 flex-shrink-0"
            >
              editar
            </button>
          </div>
        )}
        {service && date && time && (!rebookMode || contactExpanded || !(name || email || phone)) && (
          <Section step="5" title="Your details">
            <div className="space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#C4622D]" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#C4622D]" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone / WhatsApp (optional)" type="tel"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#C4622D]" />
              <p className="text-xs text-gray-400">Add at least one way to reach you — email or phone.</p>
            </div>
          </Section>
        )}


        {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}

        {/* Sticky CTA — always reachable while scrolling */}
        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-4 bg-gradient-to-t from-[#F7F4F0] via-[#F7F4F0] to-transparent">
          <button onClick={handleBook} disabled={!canBook || submitting}
            className={`w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition ${
              canBook ? "bg-[#C4622D] text-white shadow-lg" : "bg-gray-200 text-gray-400"
            }`}>
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Booking…</>
              : service && date && time
                ? <><CalendarDays size={18} /> Request booking · €{total}</>
                : <><CalendarDays size={18} /> Select a service & time</>}
          </button>
        </div>

        {/* Contact footer */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-8 text-gray-400">
          {(() => {
            const contactWa = studioWhatsappUrl((partner as any).whatsapp || partner.phone);
            return contactWa && (
              <a href={contactWa} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm hover:text-[#25D366]">
                <MessageCircle size={14} /> WhatsApp
              </a>
            );
          })()}
          {partner.phone && (
            <a href={`tel:${partner.phone}`} className="flex items-center gap-1 text-sm hover:text-gray-600">
              <Phone size={14} /> Call
            </a>
          )}
          {partner.instagram && (
            <a href={`https://instagram.com/${partner.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm hover:text-pink-500">
              <Instagram size={14} /> {partner.instagram}
            </a>
          )}
        </div>

        {/* Massage Club credit */}
        <div className="flex items-center justify-center gap-1.5 pb-4 text-gray-400 text-[11px]">
          <img src="/brand/mc-avatar-terracotta.png" alt="" className="h-4 w-4 rounded-full object-cover" />
          <span>Powered by Massage Club</span>
        </div>

        {/* Legal footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-8 text-gray-400 text-[11px]">
          <span>Massage Club · Madrid</span>
          <span>·</span>
          <Link to="/privacy" className="hover:text-[#C4622D] transition">Política de Privacidad</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-[#C4622D] transition">Términos</Link>
          <span>·</span>
          <a href="mailto:support@massageclub.io" className="hover:text-[#C4622D] transition">support@massageclub.io</a>
        </div>
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-full bg-[#C4622D] text-white flex items-center justify-center text-xs font-bold">{step}</div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
