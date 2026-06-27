import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase, fetchStudioProfile, type StudioProfile } from "@/lib/supabase";
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
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [error, setError] = useState("");
  const [profileAllergies, setProfileAllergies] = useState<string>("");
  const [profileHealthNotes, setProfileHealthNotes] = useState<string>("");


  useEffect(() => {
    if (!studioId) return;
    (async () => {
      const p = await fetchStudioProfile(studioId);
      setProfile(p);
      if (p) {
        // Count how many bookings already exist per slot, so a slot only
        // disappears once EVERY therapist is busy at that time (real capacity).
        const today = isoDate(new Date());
        const { data } = await supabase
          .from("bookings")
          .select("booking_date,booking_time")
          .eq("partner_id", studioId)
          .neq("status", "cancelled")
          .gte("booking_date", today);
        const counts = new Map<string, number>();
        for (const b of data || []) {
          const key = `${b.booking_date}__${b.booking_time}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        setSlotCounts(counts);
      }
      setLoading(false);
    })();
  }, [studioId]);

  // Pre-fill name + email + phone if the customer is signed in.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setEmail(prev => prev || user.email || "");
      setName(prev => prev || fullName);
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone, preferred_pressure, focus_areas, allergies, health_notes")
        .eq("id", user.id)
        .single();
      if (prof) {
        setName(prev => prev || prof.full_name || "");
        setPhone(prev => prev || prof.phone || "");
        if (prof.preferred_pressure) setPressure(prev => (prev === "Medium" ? prof.preferred_pressure : prev));
        if (Array.isArray(prof.focus_areas) && prof.focus_areas.length) {
          setFocusAreas(prev => (prev.length === 0 ? prof.focus_areas : prev));
        }
        setProfileAllergies(prof.allergies || "");
        setProfileHealthNotes(prof.health_notes || "");
      }

    })();
  }, []);


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
  const therapistCount = Math.max(1, profile?.therapists?.length || 0);

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
  const waDigits = (partner.phone || "").replace(/\D/g, "");

  // ─── Confirmation screen ───
  if (done) {
    const prettyDate = date ? `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}` : "";
    const waMsg = encodeURIComponent(
      `Hi ${partner.business_name}! I just booked ${service?.name} on ${prettyDate} at ${time}. Name: ${name}. (Ref ${done.ref})`
    );
    const waLink = waDigits ? `https://wa.me/${waDigits}?text=${waMsg}` : null;
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
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">You're booked! 🎉</h1>
        <p className="text-gray-500 mt-1">{service?.name} · {prettyDate} at {time}</p>
        <div className="mt-4 px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-mono">{done.ref}</div>
        <p className="text-gray-500 text-sm mt-4 max-w-sm">
          {partner.business_name} will confirm your appointment shortly.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs">
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-[#25D366] text-white font-semibold shadow-lg">
              <MessageCircle size={18} /> Confirm on WhatsApp
            </a>
          )}
          {gcal && (
            <a href={gcal} target="_blank" rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-white border border-gray-200 text-gray-700 font-semibold">
              <CalendarDays size={18} /> Add to my calendar
            </a>
          )}
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
      }).select("id").single();

      if (error) throw new Error(error.message);

      // Fire the notification emails directly (more reliable than the DB webhook).
      try {
        await supabase.functions.invoke("notify-studio", {
          body: {
            type: "INSERT",
            table: "bookings",
            record: {
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
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf6ee]">
      {/* Hero */}
      <div className="relative h-44 bg-gradient-to-br from-[#A21228] to-[#5b0a16]">
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

        {/* 1. Service */}
        <Section step="1" title="Choose a service">
          <div className="space-y-2">
            {profile.services.map(s => (
              <button key={s.id} onClick={() => setServiceId(s.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                  serviceId === s.id ? "border-[#A21228] bg-[#A21228]/5" : "border-gray-200 bg-white"
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={11} /> {s.duration} min</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#A21228] flex items-center gap-0.5"><Euro size={13} />{s.price}</p>
                  </div>
                </div>
              </button>
            ))}
            {profile.services.length === 0 && <p className="text-sm text-gray-400">No services listed yet.</p>}
          </div>
        </Section>

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
                        active ? "border-[#A21228] bg-[#A21228] text-white" : "border-gray-200 bg-white text-gray-700"
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
                        time === t ? "border-[#A21228] bg-[#A21228] text-white" : "border-gray-200 bg-white text-gray-700"
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
        {service && date && time && (
          <Section step="4" title="Customize your session">
            <p className="text-xs font-semibold text-gray-500 mb-2">Pressure</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESSURE_LEVELS.map(p => (
                <button key={p} onClick={() => setPressure(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    pressure === p ? "bg-[#A21228] text-white border-[#A21228]" : "bg-white text-gray-600 border-gray-200"
                  }`}>{p}</button>
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-500 mb-2">Focus areas</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {FOCUS_AREAS.map(f => (
                <button key={f} onClick={() => toggle(focusAreas, f, setFocusAreas)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    focusAreas.includes(f) ? "bg-[#A21228] text-white border-[#A21228]" : "bg-white text-gray-600 border-gray-200"
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
                          on ? "border-[#A21228] bg-[#A21228]/5" : "border-gray-200 bg-white"
                        }`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.name}</p>
                          <p className="text-xs text-gray-400">+€{a.price}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${on ? "border-[#A21228] bg-[#A21228]" : "border-gray-300"}`}>
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#A21228] resize-none h-24" />
          </Section>
        )}

        {/* 5. Your details */}
        {service && date && time && (
          <Section step="5" title="Your details">
            <div className="space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#A21228]" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#A21228]" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone / WhatsApp (optional)" type="tel"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#A21228]" />
              <p className="text-xs text-gray-400">Add at least one way to reach you — email or phone.</p>
            </div>
          </Section>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}

        {/* Sticky CTA — always reachable while scrolling */}
        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-4 bg-gradient-to-t from-[#faf6ee] via-[#faf6ee] to-transparent">
          <button onClick={handleBook} disabled={!canBook || submitting}
            className={`w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition ${
              canBook ? "bg-[#A21228] text-white shadow-lg" : "bg-gray-200 text-gray-400"
            }`}>
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Booking…</>
              : service && date && time
                ? <><CalendarDays size={18} /> Request booking · €{total}</>
                : <><CalendarDays size={18} /> Select a service & time</>}
          </button>
        </div>

        {/* Contact footer */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-8 text-gray-400">
          {waDigits && (
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm hover:text-[#25D366]">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
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
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-full bg-[#A21228] text-white flex items-center justify-center text-xs font-bold">{step}</div>
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
