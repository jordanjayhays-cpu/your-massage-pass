import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { supabase, fetchStudioProfile, type StudioProfile } from "@/lib/supabase";
import { studioImage, studioImageFallback } from "@/lib/studioImages";
import { studioWhatsappUrl, resolveWhatsappNumber, whatsappPrefill } from "@/app/lib/whatsapp";
import { sendTrack } from "@/lib/siteVisit";
import { logWhatsappRequest } from "@/lib/whatsappLog";
import { clarityEvent } from "@/lib/clarity";
import { requestAccountSignup } from "@/lib/accountSignup";

import { captureSource, getSource } from "@/lib/attribution";
import { LanguageFlagToggle } from "@/components/LanguageFlagToggle";
import { BookAgainBanner } from "@/app/components/BookAgain";
import { tagLabel } from "@/lib/tagLabel";
import { servicePrimaryName, serviceSecondaryName, serviceNameForStudio, serviceInlineLabel } from "@/lib/serviceName";
import {
  SPOKEN_LANGS, SPOKEN_LANG_NATIVE, SPOKEN_LANG_FLAG,
  loadSpokenLangs, saveSpokenLangs, normalizeSpokenLangs,
  spanishLanguageOffer, speaksSpanish, isSpokenLang,
  type SpokenLang,
} from "@/lib/spokenLanguages";
import {
  MapPin, Clock, Euro, Check, Loader2, Star, Sparkles,
  Phone, Instagram, MessageCircle, CalendarDays
} from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PRESSURE_LEVELS = ["Light", "Medium", "Firm", "Deep"];
const FOCUS_AREAS = ["Neck", "Shoulders", "Upper Back", "Lower Back", "Legs", "Feet", "Arms", "Hands"];
// Fixed options for the unclaimed-studio handoff, where real availability is unknown.
const HANDOFF_TIMES = Array.from({ length: 11 }, (_, i) => `${String(10 + i).padStart(2, "0")}:00`);

// Wizard steps, shown in the header on every screen.
const BOOKING_STEPS = [
  { label: "Service", labelEs: "Servicio" },
  { label: "Day and time", labelEs: "Día y hora" },
  { label: "Customize", labelEs: "Personaliza" },
  { label: "Your details", labelEs: "Tus datos" },
  { label: "Confirm", labelEs: "Confirmar" },
];
const HANDOFF_STEPS = [
  { label: "Service", labelEs: "Servicio" },
  { label: "Day and time", labelEs: "Día y hora" },
  { label: "Your info", labelEs: "Tus datos" },
  { label: "Review", labelEs: "Revisar" },
];
const CONVERSATION_LABELS: Record<string, string> = {
  silence: "Silence",
  minimal: "A little chat",
  chatty: "Happy to chat",
};

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function StudioBookingPage() {
  const { t, i18n } = useTranslation();
  const { studioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rebookId = searchParams.get("rebook");
  // "Book again" deep links ask for the wizard to open on Day and time.
  const stepParam = searchParams.get("step");
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
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  // "Almost there" details dialog, opened at the moment of booking.
  // Step-by-step wizard state (claimed studios).
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [stepError, setStepError] = useState<{ en: string; es: string } | null>(null);
  // Wizard state for the unclaimed-studio WhatsApp handoff.
  const [hoStep, setHoStep] = useState(1);
  const [hoMaxStep, setHoMaxStep] = useState(1);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  // Unclaimed-studio WhatsApp handoff preferences (lightweight, no account)
  const [hoServiceId, setHoServiceId] = useState<string>("");
  const [hoName, setHoName] = useState("");
  // Optional email on the handoff, so we can follow up after the WhatsApp booking.
  const [hoEmail, setHoEmail] = useState("");
  // Passwordless account creation, offered to visitors who are not signed in.
  const [createAccount, setCreateAccount] = useState(true);

  const [hoDate, setHoDate] = useState("");
  const [hoTime, setHoTime] = useState("");
  const [hoAltDate, setHoAltDate] = useState("");
  const [hoAltTime, setHoAltTime] = useState("");
  const [waTapped, setWaTapped] = useState(false);
  const [askWaTapped, setAskWaTapped] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const serviceRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  // Guard so a single WhatsApp tap logs exactly one row.
  const waLoggedRef = useRef(false);
  // Languages the visitor speaks — defaults to the site language, never a required field.
  const siteLang = (i18n.language || "en").slice(0, 2);
  const defaultSpoken: SpokenLang[] = isSpokenLang(siteLang) ? [siteLang] : ["en"];
  const [spokenLangs, setSpokenLangs] = useState<SpokenLang[]>(() => {
    const saved = loadSpokenLangs();
    return saved.length ? saved : defaultSpoken;
  });
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  // Persist locally whenever it changes.
  useEffect(() => { saveSpokenLangs(spokenLangs); }, [spokenLangs]);
  useEffect(() => { clarityEvent("studio_view"); }, [studioId]);

  const toggleSpokenLang = (code: SpokenLang) => {
    setSpokenLangs(prev => {
      const next = prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code];
      if (userId) {
        supabase.from("profiles").update({ spoken_languages: next }).eq("id", userId).then(
          () => {}, () => {},
        );
      }
      return next;
    });
  };





  useEffect(() => {
    captureSource();
  }, []);

  useEffect(() => {
    if (!profile?.partner) return;
    const p = profile.partner as any;
    const prevTitle = document.title;
    document.title = `${p.business_name} · Massage Club`;
    const desc = `${p.business_name}${p.address ? `, ${p.address}` : ", Madrid"}. Book a massage in English or Spanish${p.price_from ? `, from ${p.price_from}€` : ""}. Massage Club Madrid.`;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const prevDesc = meta.content;
    meta.content = desc;
    return () => {
      document.title = prevTitle;
      if (meta) meta.content = prevDesc;
    };
  }, [profile]);

  // LocalBusiness / HealthAndBeautyBusiness structured data for the studio profile.
  useEffect(() => {
    if (!profile?.partner) return;
    const p = profile.partner as any;
    const rating = p.google_rating != null ? Number(p.google_rating) : null;
    const reviews = p.google_reviews != null ? Number(p.google_reviews) : null;
    const data: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "HealthAndBeautyBusiness",
      name: p.business_name,
      url: `https://book.massageclub.io/${p.slug || p.id}`,
      ...(p.phone ? { telephone: p.phone } : {}),
      ...(p.image_url ? { image: p.image_url } : {}),
      address: {
        "@type": "PostalAddress",
        ...(p.address ? { streetAddress: p.address } : {}),
        addressLocality: "Madrid",
        addressCountry: "ES",
      },
      ...(p.latitude != null && p.longitude != null
        ? { geo: { "@type": "GeoCoordinates", latitude: Number(p.latitude), longitude: Number(p.longitude) } }
        : {}),
      ...(rating != null
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: rating,
              ...(reviews != null ? { reviewCount: reviews } : {}),
            },
          }
        : {}),
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify(data);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [profile]);




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
    let cancelled = false;

    const prefill = async (user: any) => {
      if (!user || cancelled) return;
      setUserId(user.id);

      // Spoken languages live in their own query so a missing column can never
      // break the rest of the pre-fill.
      supabase.from("profiles").select("spoken_languages").eq("id", user.id).maybeSingle().then(
        ({ data }) => {
          const saved = normalizeSpokenLangs((data as any)?.spoken_languages);
          if (saved.length) setSpokenLangs(saved);
        },
        () => {},
      );

      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setEmail(prev => prev || user.email || "");
      setHoEmail(prev => prev || user.email || "");
      setName(prev => prev || fullName);

      setPhone(prev => prev || user.phone || user.user_metadata?.phone || "");

      // select("*") so one renamed column can never wipe out the whole pre-fill.
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof || cancelled) return;
      const p = prof as any;
      setCustomerProfile(p);
      setName(prev => prev || p.full_name || "");
      setEmail(prev => prev || p.email || "");
      setHoEmail(prev => prev || p.email || "");
      setPhone(prev => prev || p.phone || "");
      setProfileAllergies(p.allergies || "");
      setProfileHealthNotes(p.health_notes || "");
      // Only auto-apply massage prefs when NOT rebooking (rebook effect wins).
      if (!rebookId) {
        let applied = false;
        if (p.preferred_pressure) {
          setPressure(prev => (prev === "Medium" ? p.preferred_pressure : prev));
          applied = true;
        }
        if (Array.isArray(p.focus_areas) && p.focus_areas.length) {
          setFocusAreas(prev => (prev.length === 0 ? p.focus_areas : prev));
          applied = true;
        }
        if (p.conversation_pref) {
          setConversationPref(prev => prev || p.conversation_pref);
          applied = true;
        }
        if (applied) setPrefsApplied(true);
      }
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        prefill(session.user);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) prefill(user);
      }
    })();

    // The session can land after first paint (magic link, OAuth return).
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) prefill(session.user);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
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
      if (stepParam === "2") {
        // "Book again": everything stays editable, we just skip ahead one step.
        setRebookMode(false);
        setStep(2);
        setMaxStep(m => Math.max(m, 2));
        window.scrollTo({ top: 0, behavior: "auto" });
      } else {
        setRebookMode(true);
      }
    })();
  }, [rebookId, stepParam, profile]);




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

  // The quiz remembers which studio sent the visitor there.
  const quizHref = (() => {
    const p: any = profile?.partner;
    if (!p) return "/discovery/quiz";
    const params = new URLSearchParams({ from: p.slug || p.id, fromName: p.business_name || "" });
    return `/discovery/quiz?${params.toString()}`;
  })();

  const service = profile?.services.find(s => s.id === serviceId) || null;

  // Studio capacity = how many massages can run in parallel (min 1).
  const therapistCount = Math.max(1, Number(profile?.partner?.capacity) || 0, profile?.therapists?.length || 0);

  // Per-slot capacity overrides (partner_availability.capacity, NULL = inherit global)
  const slotCapacity = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of (profile?.availability ?? []) as any[]) {
      if (a.capacity != null) m.set(`${Number(a.day_of_week)}__${a.time_slot}`, Math.max(1, Number(a.capacity)));
    }
    return m;
  }, [profile]);

  const capacityFor = (day: number, slot: string) =>
    slotCapacity.get(`${day}__${slot}`) ?? therapistCount;

  // Spots still open for a given slot on the selected date.
  const remainingFor = (t: string) =>
    date ? capacityFor(date.getDay(), t) - (slotCounts.get(`${isoDate(date)}__${t}`) || 0) : 0;

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
    const isClaimed = partner.status === "active";
    const studioNumber = (partner as any).whatsapp || partner.phone;
    const waNumber = resolveWhatsappNumber(partner as any);

    // Claimed: friendly "you're booked" message.
    // NOTE: messages sent TO the studio always use the SPANISH service name.
    const waMsg = `¡Hola ${partner.business_name}! Acabo de reservar ${serviceNameForStudio(service)} para el ${prettyDate} a las ${time} a través de Massage Club. Soy ${name}. ¡Nos vemos! 🙏`;
    const waLink = waNumber ? studioWhatsappUrl(waNumber, waMsg) : null;
    // Unclaimed: ask the customer to send the booking request to the studio themselves.
    const unclaimedWaMsg = `¡Hola ${partner.business_name}! Quiero reservar ${serviceNameForStudio(service)} para el ${prettyDate} a las ${time}. Soy ${name}${phone ? ` (${phone})` : ""}. Os encontré en Massage Club. ¿Me lo podéis confirmar? ¡Gracias! 🙏`;
    const unclaimedWaLink = studioWhatsappUrl(resolveWhatsappNumber(partner as any), unclaimedWaMsg);
    const websiteUrl = (() => {
      if (!partner.website) return null;
      const w = String(partner.website).trim();
      return /^https?:\/\//i.test(w) ? w : `https://${w}`;
    })();
    // Let the customer drop the appointment into their own calendar.
    const gcal = (() => {
      if (!date || !time || !service) return null;
      const [h, m] = time.split(":").map(Number);
      const start = new Date(date); start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + (service.duration || 60) * 60000);
      const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const text = encodeURIComponent(`${serviceInlineLabel(service)} · ${partner.business_name}`);
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
            <h1 className="font-display text-3xl font-semibold leading-tight mb-3" style={{ color: "#2b2b2b" }}>{partner.business_name}</h1>
            <p className="text-base font-semibold mb-6" style={{ color: "#3d2b1f" }}>
              ¡Tu reserva está hecha! 🎉
              <span className="block text-sm font-normal mt-0.5" style={{ color: "#8a7460" }}>You're booked!</span>
            </p>
            <div className="rounded-xl p-4 mb-5 text-left" style={{ background: "#FAF6F1" }}>
              <div className="text-sm font-semibold mb-1" style={{ color: "#3d2b1f" }}>
                {servicePrimaryName(service)} · {service?.duration} min · {total}€
              </div>
              {serviceSecondaryName(service) && (
                <div className="text-xs mb-1" style={{ color: "#8a7460" }}>{serviceSecondaryName(service)}</div>
              )}
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
            {isClaimed ? (
              <>
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
                  {waLink ? (
                    <a href={waLink} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <MessageCircle size={18} /> Confirm on WhatsApp
                    </a>
                  ) : studioNumber ? (
                    <a href={`tel:${studioNumber}`} className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <Phone size={18} /> Llamar al estudio
                      <span className="block text-xs font-normal opacity-80">Call the studio</span>
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: "#8a7460" }}>
                  Casi listo. Envía tu reserva al estudio para confirmarla.
                  <span className="block text-xs mt-0.5">Almost done. Send your booking to the studio to confirm it.</span>
                </p>
                <div className="flex flex-col items-center gap-3 w-full">
                  {unclaimedWaLink ? (
                    <a href={unclaimedWaLink} target="_blank" rel="noreferrer" className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full font-semibold" style={{ background: "#B85C38", color: "#fff" }}>
                      <span className="inline-flex items-center gap-2"><MessageCircle size={18} /> Enviar reserva por WhatsApp</span>
                      <span className="text-xs font-normal opacity-90">Send booking via WhatsApp</span>
                    </a>
                  ) : studioNumber ? (
                    <a href={`tel:${studioNumber}`} className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full font-semibold" style={{ background: "#B85C38", color: "#fff" }}>
                      <span className="inline-flex items-center gap-2"><Phone size={18} /> Llamar al estudio</span>
                      <span className="text-xs font-normal opacity-90">Call the studio</span>
                    </a>
                  ) : null}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noreferrer" className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <span>Reservar en su web</span>
                      <span className="text-xs font-normal opacity-80">Book on their website</span>
                    </a>
                  )}
                  {gcal && (
                    <a href={gcal} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                      <CalendarDays size={18} /> Add to my calendar
                    </a>
                  )}
                </div>
              </>
            )}
            <div className="mt-6 text-xs" style={{ color: "#8a7460" }}>
              Massage Club · Madrid · book.massageclub.io
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Unclaimed studio handoff ───
  if (partner.status !== "active") {
    const studioNumber = (partner as any).whatsapp || partner.phone;
    const waNumber = resolveWhatsappNumber(partner as any);
    const hoService = profile.services.find(s => s.id === hoServiceId) || null;
    const esDate = (v: string) => {
      if (!v) return "";
      const [y, mo, d] = v.split("-").map(Number);
      if (!y || !mo || !d) return "";
      try {
        return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" })
          .format(new Date(y, mo - 1, d));
      } catch {
        return v;
      }
    };
    // If the visitor speaks Spanish, the apology makes no sense — drop it,
    // along with the "reply to me in X" offer line.
    const visitorSpeaksSpanish = speaksSpanish(spokenLangs);
    const noSpanish = visitorSpeaksSpanish ? "" : "Disculpa, todavía no hablo español. ";
    const hoPrice = Number((hoService as any)?.price);
    const hasPrice = Number.isFinite(hoPrice) && hoPrice > 0;
    // SPANISH ONLY — this line goes into the WhatsApp message read by the studio.
    const hoServiceEs = hoService ? serviceNameForStudio(hoService) : "";
    const serviceLine = hoService
      ? (() => {
          const dur = Number((hoService as any).duration) > 0 ? `${Number((hoService as any).duration)} min` : "";
          const parts = [hoServiceEs, dur, hasPrice ? `${hoPrice} €` : ""].filter(Boolean);
          return `· ${parts.join(" · ")}`;
        })()
      : "";
    // Always Spanish — this text is sent to the studio, never translated.
    const studioUrl = `book.massageclub.io/${partner.slug || partner.id}`;
    const langOffer = spanishLanguageOffer(spokenLangs);
    const found = `Os encontré en Massage Club: ${studioUrl}${langOffer ? `\n${langOffer} 🙏` : ""}`;
    const waMsg = (() => {
      const greeting = `¡Hola ${partner.business_name}!`;

      // Fully specified: service + date/time.
      if (hoService && hoDate && hoTime) {
        const lines: string[] = [`${greeting} Me gustaría reservar:`];
        lines.push(serviceLine);
        const alt = hoAltDate && hoAltTime ? `, o ${esDate(hoAltDate)} a las ${hoAltTime}` : "";
        lines.push(`· ${esDate(hoDate)} a las ${hoTime}${alt}`);
        if (hoName.trim()) lines.push(`· A nombre de ${hoName.trim()}`);
        lines.push("");
        lines.push(`${noSpanish}¿Me puedes confirmar con un "sí", o proponerme otra hora? ${found}`);
        return lines.join("\n");
      }

      // Service chosen but no date/time yet.
      if (hoService) {
        const lines: string[] = [`${greeting} Me gustaría reservar:`];
        lines.push(serviceLine);
        if (hoName.trim()) lines.push(`· A nombre de ${hoName.trim()}`);
        lines.push("");
        lines.push(`${noSpanish}¿Me puedes decir qué horas tenéis libres esta semana para este servicio? Puedo responder con una hora y ya está. ${found}`);
        return lines.join("\n");
      }

      // Date + time chosen but no service.
      if (hoDate && hoTime) {
        const lines: string[] = [`${greeting} Me gustaría reservar un masaje para el ${esDate(hoDate)} a las ${hoTime}.`];
        if (hoAltDate && hoAltTime) lines.push(`También valdría el ${esDate(hoAltDate)} a las ${hoAltTime}.`);
        if (hoName.trim()) lines.push(`· A nombre de ${hoName.trim()}`);
        lines.push("");
        lines.push(`${noSpanish}¿Me puedes decir qué servicios tenéis libres a esa hora? Puedo responder con un "sí". ${found}`);
        return lines.join("\n");
      }

      // Date only.
      if (hoDate) {
        const lines: string[] = [`${greeting} Me gustaría reservar un masaje para el ${esDate(hoDate)}.`];
        if (hoName.trim()) lines.push(`· A nombre de ${hoName.trim()}`);
        lines.push("");
        lines.push(`${noSpanish}¿Me puedes decir qué horas tenéis libres ese día? Puedo responder con una hora y ya está. ${found}`);
        return lines.join("\n");
      }

      // Time only.
      if (hoTime) {
        const lines: string[] = [`${greeting} Me gustaría reservar un masaje a las ${hoTime}.`];
        if (hoName.trim()) lines.push(`· A nombre de ${hoName.trim()}`);
        lines.push("");
        lines.push(`${noSpanish}¿Me puedes decir qué días tenéis libres a esa hora? Puedo responder con un día y ya está. ${found}`);
        return lines.join("\n");
      }

      // Nothing selected: generic fallback that asks for a list of times.
      return `${greeting} Me gustaría reservar un masaje con vosotros.\n\n${noSpanish}¿Me puedes decir qué horas tenéis libres esta semana? Puedo responder con una hora y ya está. ${found}`;
    })();
    const trackWhatsappIntent = () => {
      if (waLoggedRef.current) return;
      waLoggedRef.current = true;
      setWaTapped(true);
      clarityEvent("whatsapp_click");
      const hasService = !!hoService;
      const hasDate = !!hoDate;
      sendTrack({
        event: "whatsapp_click",
        path: window.location.pathname,
        slug: partner.slug || partner.id,
        meta: {
          filled: hasService || hasDate || !!hoTime || !!hoName.trim(),
          service: hasService,
          date: hasDate,
          price_shown: hasPrice,
          languages: spokenLangs,
        },
      });
      // Fire and forget: never blocks the WhatsApp link.
      logWhatsappRequest({
        partner_id: partner.id,
        slug: partner.slug || null,
        studio_name: partner.business_name,
        service_name: hoService ? servicePrimaryName(hoService) : null,
        price: hasPrice ? hoPrice : null,
        day1: hoDate || null,
        time1: hoTime || null,
        day2: hoAltDate || null,
        time2: hoAltTime || null,
        first_name: hoName.trim() || null,
        contact_email: hoEmail.trim() || null,
        languages: spokenLangs.join(", "),
        user_id: userId,
        wa_number: waNumber,
        message_text: waMsg,
      });
      // Fire and forget: passwordless account, never blocks the WhatsApp handoff.
      if (!userId && createAccount && hoEmail.trim()) {
        requestAccountSignup({ email: hoEmail.trim(), name: hoName.trim(), lang: siteLang });
      }
    };

    const waLink = waNumber ? studioWhatsappUrl(waNumber, waMsg) : null;
    const websiteUrl = (() => {
      if (!partner.website) return null;
      const w = String(partner.website).trim();
      return /^https?:\/\//i.test(w) ? w : `https://${w}`;
    })();
    const googleRating = (partner as any).google_rating != null ? Number((partner as any).google_rating) : null;
    // Handoff wizard navigation.
    const hoGo = (n: number) => {
      setHoStep(n);
      setHoMaxStep(m => Math.max(m, n));
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const googleReviews = (partner as any).google_reviews != null ? Number((partner as any).google_reviews) : null;
    return (
      <div className="min-h-screen p-4 relative" style={{ background: "#FAF6F1" }}>
        <div className="absolute top-3 right-3 z-10"><LanguageFlagToggle /></div>
        <div className="w-full max-w-md min-[900px]:max-w-[1100px] mx-auto rounded-2xl overflow-hidden text-center min-[900px]:text-left" style={{ background: "#ffffff", boxShadow: "0 6px 24px rgba(80,44,20,0.08)" }}>
          <div className="flex items-center justify-center gap-2 py-3 px-4" style={{ background: "#B85C38", borderRadius: "1rem 1rem 0 0" }}>
            <img src="/brand/mc-avatar-cream.png" alt="Massage Club" width={26} height={26} className="rounded-full" />
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: "2px" }}>MASSAGE CLUB</span>
          </div>
          <div className="px-6 py-7 min-[900px]:grid min-[900px]:grid-cols-[1fr_400px] min-[900px]:gap-10 min-[900px]:items-start">
            {/* LEFT: studio identity + menu */}
            <div>
            <h1 className="font-display text-3xl min-[900px]:text-4xl font-semibold leading-tight mb-3" style={{ color: "#2b2b2b" }}>{partner.business_name}</h1>
            {partner.address && (
              <p className="text-sm min-[900px]:text-base flex items-center justify-center min-[900px]:justify-start gap-1 mb-2" style={{ color: "#5a4736" }}>
                <span>📍</span>
                <span>{partner.address}</span>
              </p>
            )}
            {rating ? (
              <p className="text-sm min-[900px]:text-base font-semibold mb-5 flex items-center justify-center min-[900px]:justify-start gap-1" style={{ color: "#5a4736" }}>
                <span style={{ color: "#E0A458" }}>★</span>
                {rating.avg.toFixed(1)} <span className="font-normal" style={{ color: "#7A7068" }}>({rating.count})</span>
              </p>
            ) : googleRating != null ? (
              <p className="text-sm min-[900px]:text-base font-semibold mb-5 flex items-center justify-center min-[900px]:justify-start gap-1" style={{ color: "#5a4736" }}>
                <span style={{ color: "#E0A458" }}>★</span>
                {googleRating.toFixed(1)}
                {googleReviews != null && (
                  <span className="font-normal" style={{ color: "#7A7068" }}>({googleReviews} · Google)</span>
                )}
              </p>
            ) : null}
            <p className="text-sm min-[900px]:text-base mb-1" style={{ color: "#7A7068" }}>
              {t("app.handoff.notRegistered")}
            </p>
            <p className="text-xs min-[900px]:text-sm mb-5" style={{ color: "#9E9387" }}>
              {t("app.handoff.notRegisteredSub")}
            </p>
            <p className="text-sm min-[900px]:text-base mb-5" style={{ color: "#5a4736" }}>
              {t("app.handoff.bookDirectly")}
              <span className="block text-xs min-[900px]:text-sm mt-0.5" style={{ color: "#7A7068" }}>{t("app.handoff.bookDirectlySub")}</span>
            </p>
            {profile.services.length > 0 && (
              <div className="mt-6 text-left">
                <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-2" style={{ color: "#B85C38", letterSpacing: "2px" }}>SERVICIOS / SERVICES</p>
                <div className="rounded-xl p-3 min-[900px]:p-4 space-y-2 min-[900px]:space-y-3" style={{ background: "#FAF6F1" }}>
                  {profile.services.map(s => (
                    <div key={s.id} className="flex items-start justify-between gap-3 text-sm min-[900px]:text-base" style={{ color: "#5a4736" }}>
                      <span className="min-w-0">
                        <span className="block">
                          {servicePrimaryName(s)}
                          {Number(s.duration) > 0 && ` · ${Number(s.duration)} min`}
                        </span>
                        {serviceSecondaryName(s) && (
                          <span className="block text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>{serviceSecondaryName(s)}</span>
                        )}
                      </span>
                      {s.price != null && Number(s.price) > 0 && (
                        <span className="font-semibold flex-shrink-0" style={{ color: "#2b2b2b" }}>€{Number(s.price)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>

            {/* RIGHT: the booking request form + CTA (sticky on desktop) */}
            <div className="min-[900px]:sticky min-[900px]:top-4 text-left">
            {waLink && (
              <>
                <Stepper steps={HANDOFF_STEPS} current={hoStep} maxReached={hoMaxStep} onGo={hoGo} />
                <div className="rounded-2xl p-4 min-[900px]:p-5 mt-3 mb-4" style={{ background: "#FAF6F1" }}>
                  <p className="text-xs min-[900px]:text-sm font-bold uppercase mb-3" style={{ color: "#B85C38", letterSpacing: "2px" }}>
                    {t("app.handoff.prefTitle")}
                  </p>

                  {/* STEP 1: service */}
                  {hoStep === 1 && (
                    <div>
                      <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefService")}</span>
                      <div className="mt-1.5 space-y-2 min-[900px]:space-y-3 max-h-72 overflow-y-auto pr-0.5">
                        <Link
                          to={quizHref}
                          className="w-full text-left rounded-xl border border-dashed px-3 min-[900px]:px-4 py-2.5 min-[900px]:py-3.5 min-h-[56px] min-[900px]:min-h-[68px] flex items-center gap-2 motion-safe:transition hover:bg-[#F6EFE6]"
                          style={{ borderColor: "#B85C38", background: "#FAF6F1" }}
                        >
                          <Sparkles size={16} className="min-[900px]:size-5" style={{ color: "#B85C38", flexShrink: 0 }} />
                          <span className="min-w-0">
                            <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#B85C38" }}>Not sure which massage? Take the 60 second quiz</span>
                            <span className="block text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>¿No sabes cuál elegir? Haz el test</span>
                          </span>
                        </Link>
                        <div role="radiogroup" aria-label={t("app.handoff.prefService")} className="space-y-2 min-[900px]:space-y-3">
                          {profile.services.map((s: any) => {
                            const selected = hoServiceId === s.id;
                            const dur = Number(s.duration) > 0 ? Number(s.duration) : null;
                            const price = Number(s.price);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => setHoServiceId(selected ? "" : s.id)}
                                className="w-full text-left rounded-xl border px-3 min-[900px]:px-4 py-2.5 min-[900px]:py-3.5 min-h-[56px] min-[900px]:min-h-[68px] flex items-start justify-between gap-3 motion-safe:transition"
                                style={{ borderColor: selected ? "#B85C38" : "#E6DCCF", background: selected ? "#FBEFE8" : "#ffffff" }}
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#2b2b2b" }}>{servicePrimaryName(s)}</span>
                                  {serviceSecondaryName(s) && (
                                    <span className="block text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>{serviceSecondaryName(s)}</span>
                                  )}
                                </span>
                                <span className="text-right flex-shrink-0">
                                  {Number.isFinite(price) && price > 0 && (
                                    <span className="block text-sm min-[900px]:text-base font-semibold" style={{ color: "#2b2b2b" }}>€{price}</span>
                                  )}
                                  {dur && <span className="block text-xs min-[900px]:text-sm" style={{ color: "#8a7460" }}>{dur} min</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <WizardNav
                        onNext={() => hoGo(2)}
                        disabled={!hoServiceId}
                        hint="Choose a service to continue"
                        hintEs="Elige un servicio para continuar"
                      />
                    </div>
                  )}

                  {/* STEP 2: day and time */}
                  {hoStep === 2 && (
                    <div className="space-y-3 min-[900px]:space-y-4">
                      <div>
                        <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefDate")}</span>
                        <div className="mt-1.5">
                          <DayStrip value={hoDate} onChange={setHoDate} label={t("app.handoff.prefDate")} />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefTime")}</span>
                        <div className="mt-1.5">
                          <TimePills value={hoTime} onChange={setHoTime} label={t("app.handoff.prefTime")} />
                        </div>
                      </div>
                      {!altOpen ? (
                        <button
                          type="button"
                          onClick={() => setAltOpen(true)}
                          className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2"
                          style={{ color: "#B85C38" }}
                        >
                          + Add a second choice
                          <span className="block text-xs min-[900px]:text-sm font-normal no-underline" style={{ color: "#8a7460" }}>Añadir una segunda opción</span>
                        </button>
                      ) : (
                        <div>
                          <span className="text-xs min-[900px]:text-base" style={{ color: "#7A7068" }}>{t("app.handoff.prefAlt")}</span>
                          <div className="mt-1.5 space-y-2 min-[900px]:space-y-3">
                            <DayStrip value={hoAltDate} onChange={setHoAltDate} label={t("app.handoff.prefAlt")} />
                            <TimePills value={hoAltTime} onChange={setHoAltTime} label={t("app.handoff.prefAlt")} />
                          </div>
                        </div>
                      )}
                      <WizardNav
                        onBack={() => hoGo(1)}
                        onNext={() => hoGo(3)}
                        disabled={!hoDate || !hoTime}
                        hint="Pick a day and a time to continue"
                        hintEs="Elige un día y una hora para continuar"
                      />
                    </div>
                  )}

                  {/* STEP 3: your info */}
                  {hoStep === 3 && (
                    <div className="space-y-4 min-[900px]:space-y-5">
                      <label className="block">
                        <span className="text-xs min-[900px]:text-sm" style={{ color: "#7A7068" }}>{t("app.handoff.prefName")}</span>
                        <input type="text" value={hoName} onChange={(e) => setHoName(e.target.value)}
                          className="mt-1 w-full h-11 min-[900px]:h-14 px-3 min-[900px]:px-4 rounded-xl border bg-white text-sm min-[900px]:text-base" style={{ borderColor: "#E6DCCF", color: "#2b2b2b" }} />
                      </label>
                      <label className="block">
                        <span className="text-xs min-[900px]:text-sm" style={{ color: "#7A7068" }}>Email (optional)</span>
                        <input type="email" inputMode="email" autoComplete="email" value={hoEmail}
                          onChange={(e) => setHoEmail(e.target.value)}
                          className="mt-1 w-full h-11 min-[900px]:h-14 px-3 min-[900px]:px-4 rounded-xl border bg-white text-sm min-[900px]:text-base" style={{ borderColor: "#E6DCCF", color: "#2b2b2b" }} />
                        <span className="block text-[11px] min-[900px]:text-xs mt-1" style={{ color: "#9E9387" }}>
                          So we can check everything went well with your booking.
                          <span className="block">Para comprobar que todo ha ido bien con tu reserva.</span>
                        </span>
                      </label>
                      {!userId && !!hoEmail.trim() && (
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={createAccount}
                            onChange={(e) => setCreateAccount(e.target.checked)}
                            className="mt-0.5 h-4 w-4 min-[900px]:h-5 min-[900px]:w-5 accent-[#C4622D]" />
                          <span className="text-xs min-[900px]:text-sm leading-snug" style={{ color: "#5a4736" }}>
                            Create my free Massage Club account
                            <span className="block text-[11px] min-[900px]:text-xs" style={{ color: "#9E9387" }}>
                              Track your booking and rebook faster. We'll email you a one-tap sign-in link, no password.
                            </span>
                            <span className="block text-[11px] min-[900px]:text-xs" style={{ color: "#9E9387" }}>
                              Sigue tu reserva y repite más rápido. Te enviamos un enlace de acceso de un toque, sin contraseña.
                            </span>
                          </span>
                        </label>
                      )}

                      <div>
                        <span className="text-xs min-[900px]:text-sm" style={{ color: "#7A7068" }}>{t("app.handoff.prefLanguages")}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 min-[900px]:gap-2">
                          {spokenLangs.map((code) => (
                            <button key={code} type="button" onClick={() => toggleSpokenLang(code)}
                              className="inline-flex items-center gap-1.5 h-7 min-[900px]:h-8 pl-2 min-[900px]:pl-2.5 pr-1.5 min-[900px]:pr-2 rounded-full border text-[12px] min-[900px]:text-sm"
                              style={{ borderColor: "#E6DCCF", background: "#FAF6F1", color: "#5a4736" }}>
                              <img src={`https://flagcdn.com/w40/${SPOKEN_LANG_FLAG[code]}.png`} alt="" aria-hidden
                                className="w-4 h-3 min-[900px]:w-5 min-[900px]:h-4 rounded-[2px] object-cover" loading="lazy" />
                              {SPOKEN_LANG_NATIVE[code]}
                              <span aria-hidden style={{ color: "#9E9387" }}>×</span>
                            </button>
                          ))}
                          <button type="button" onClick={() => setLangPickerOpen(o => !o)}
                            className="inline-flex items-center h-7 min-[900px]:h-8 px-2.5 min-[900px]:px-3 rounded-full border text-[12px] min-[900px]:text-sm"
                            style={{ borderColor: "#E6DCCF", color: "#7A7068" }}>
                            + {t("app.handoff.prefLanguagesAdd")}
                          </button>
                        </div>
                        {langPickerOpen && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 min-[900px]:gap-2">
                            {SPOKEN_LANGS.filter(c => !spokenLangs.includes(c)).map((code) => (
                              <button key={code} type="button" onClick={() => toggleSpokenLang(code)}
                                className="inline-flex items-center gap-1.5 h-7 min-[900px]:h-8 px-2.5 min-[900px]:px-3 rounded-full border text-[12px] min-[900px]:text-sm bg-white"
                                style={{ borderColor: "#E6DCCF", color: "#5a4736" }}>
                                <img src={`https://flagcdn.com/w40/${SPOKEN_LANG_FLAG[code]}.png`} alt="" aria-hidden
                                  className="w-4 h-3 min-[900px]:w-5 min-[900px]:h-4 rounded-[2px] object-cover" loading="lazy" />
                                {SPOKEN_LANG_NATIVE[code]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] min-[900px]:text-xs" style={{ color: "#9E9387" }}>{t("app.handoff.prefOptional")}</p>
                      <WizardNav onBack={() => hoGo(2)} onNext={() => hoGo(4)} />
                    </div>
                  )}

                  {/* STEP 4: review and send */}
                  {hoStep === 4 && (
                    <div className="space-y-3 min-[900px]:space-y-4">
                      <div className="rounded-xl bg-white p-3 min-[900px]:p-4 space-y-2 min-[900px]:space-y-3 border" style={{ borderColor: "#E6DCCF" }}>
                        <SummaryRow label="Service" labelEs="Servicio" value={hoService ? servicePrimaryName(hoService) : null} placeholder="Pick a service" />
                        <SummaryRow label="Day" labelEs="Día" value={hoDate ? esDate(hoDate) : null} placeholder="Pick a day" />
                        <SummaryRow label="Time" labelEs="Hora" value={hoTime || null} placeholder="Pick a time" />
                        <SummaryRow label="Second choice" labelEs="Segunda opción" value={hoAltDate && hoAltTime ? `${esDate(hoAltDate)} ${hoAltTime}` : null} placeholder="None" />
                        <SummaryRow label="Name" labelEs="Nombre" value={hoName.trim() || null} placeholder="Not given" />
                        <SummaryRow label="Languages" labelEs="Idiomas" value={spokenLangs.map(c => SPOKEN_LANG_NATIVE[c]).join(", ") || null} placeholder="Not set" />
                        <SummaryRow label="Price" labelEs="Precio" value={hasPrice ? `€${hoPrice}` : null} placeholder="Ask the studio" />
                      </div>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={trackWhatsappIntent}
                        className={`w-full inline-flex flex-col items-center justify-center h-14 min-[900px]:h-16 px-6 rounded-2xl font-semibold ${waTapped ? "pointer-events-none opacity-80" : ""}`}
                        style={{ background: "#B85C38", color: "#fff" }}
                      >
                        <span className="inline-flex items-center gap-2 min-[900px]:text-lg"><MessageCircle size={18} /> {t("app.handoff.bookWhatsapp")}</span>
                        <span className="text-xs min-[900px]:text-sm font-normal opacity-90">{t("app.handoff.bookWhatsappSub")}</span>
                      </a>
                      <p className="text-xs min-[900px]:text-sm text-center" style={{ color: "#7A7068" }}>{t("app.handoff.waReassurance")}</p>
                      {waTapped && (
                        <p className="text-xs min-[900px]:text-sm rounded-xl px-3 py-2" style={{ background: "#ffffff", color: "#5a4736" }}>
                          {t("app.handoff.afterNote")}
                        </p>
                      )}
                      <button type="button" onClick={() => hoGo(3)} className="text-sm min-[900px]:text-base font-semibold underline underline-offset-2" style={{ color: "#8a7460" }}>
                        Back <span className="font-normal">/ Atrás</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex flex-col items-center gap-3 w-full">
              {!waLink && studioNumber && (
                <a href={`tel:${studioNumber}`} className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full font-semibold" style={{ background: "#B85C38", color: "#fff" }}>
                  <span className="inline-flex items-center gap-2"><Phone size={18} /> {t("app.handoff.callStudio")}</span>
                  <span className="text-xs font-normal opacity-90">{t("app.handoff.callStudioSub")}</span>
                </a>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noreferrer" className="w-full inline-flex flex-col items-center justify-center h-12 px-6 rounded-full border font-semibold" style={{ borderColor: "#B85C38", color: "#B85C38" }}>
                  <span>{t("app.handoff.visitWebsite")}</span>
                  <span className="text-xs font-normal opacity-80">{t("app.handoff.visitWebsiteSub")}</span>
                </a>
              )}
            </div>
            </div>


            <div className="mt-6 text-xs min-[900px]:col-span-2 text-center" style={{ color: "#8a7460" }}>
              Massage Club · Madrid · book.massageclub.io
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Name plus at least one way to reach them (phone OR email). Phone alone is fine.
  const hasContact = !!(phone.trim() || email.trim());
  const canBook = !!(service && date && time && name.trim() && hasContact);
  const prettyDay = date ? `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}` : null;

  // Wizard navigation. Every step is shown, nothing is skipped automatically.
  const goStep = (n: number) => {
    setStep(n);
    setMaxStep(m => Math.max(m, n));
    setStepError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitDetailsStep = () => {
    if (!name.trim()) {
      setStepError({ en: "Add your name so the studio knows who is coming", es: "Añade tu nombre para que el estudio sepa quién viene" });
      nameRef.current?.focus();
      return;
    }
    if (!hasContact) {
      setStepError({ en: "Add an email or phone so the studio can reach you", es: "Añade un email o teléfono para que el estudio pueda contactarte" });
      emailRef.current?.focus();
      return;
    }
    goStep(5);
  };


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
    const clientPreferences = {
      pressure,
      focus_areas: focusAreas,
      conversation: conversationPref || customerProfile?.conversation_pref || null,
      preferred_therapist_gender: customerProfile?.preferred_therapist_gender || null,
      massage_goals: customerProfile?.massage_goals || null,
    };


    try {
      const { data, error } = await supabase.from("bookings").insert({
        ...getSource(),
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
        contraindications: Array.isArray(customerProfile?.medical_conditions)
          ? customerProfile.medical_conditions.join(", ")
          : (customerProfile?.medical_conditions || null),
        medications: customerProfile?.medications || null,
        avoid_areas: customerProfile?.avoid_areas || null,
        reason_for_visit: customerProfile?.reason_for_visit || null,
        is_first_visit: customerProfile?.is_first_massage ?? null,
        client_preferences: clientPreferences,
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
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
              contraindications: Array.isArray(customerProfile?.medical_conditions)
                ? customerProfile.medical_conditions.join(', ')
                : (customerProfile?.medical_conditions || null),
              medications: customerProfile?.medications || null,
              avoid_areas: customerProfile?.avoid_areas || null,
              reason_for_visit: customerProfile?.reason_for_visit || null,
              is_first_visit: customerProfile?.is_first_massage ?? null,
              client_preferences: clientPreferences,
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
      
      // Fire and forget: passwordless account for guests who opted in.
      if (!userId && createAccount && email.trim()) {
        requestAccountSignup({ email: email.trim(), name: name.trim().split(" ")[0], lang: siteLang });
      }

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
        setError("Esa hora se acaba de llenar, elige otra / That time just filled up, pick another");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const bookingWaNumber = resolveWhatsappNumber(partner as any);
  const esLongDate = (d: Date | null) => {
    if (!d) return null;
    try {
      return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(d);
    } catch {
      return null;
    }
  };
  const bookingWaMsg = whatsappPrefill({
    studio: partner.business_name,
    // SPANISH name — the studio reads its own menu.
    service: service ? serviceNameForStudio(service) : null,
    duration: (service as any)?.duration ?? null,
    price: (service as any)?.price ?? null,
    date: esLongDate(date),
    time: time || null,
    name: name || null,
  });
  const bookingWaHref = bookingWaNumber ? studioWhatsappUrl(bookingWaNumber, bookingWaMsg) : null;

  return (
    <div className="min-h-screen bg-[#FAF6F1] relative">
      <div className="absolute top-3 right-3 z-30"><LanguageFlagToggle /></div>
      {/* Hero */}
      <div className="relative h-44 bg-gradient-to-br from-[#C4622D] to-[#5b0a16]">
        <img
          src={studioImage({
            id: partner.id,
            name: partner.business_name,
            imageUrl: partner.cover_url || null,
            services: (profile.services || []).map((s: any) => `${s.name ?? ""} ${s.type ?? ""}`),
            description: partner.description,
          }, 1200)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          onError={(e) => studioImageFallback(e, 1200)}
        />
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
              <h1 className="font-display text-3xl font-semibold text-white leading-tight">{partner.business_name}</h1>
              {rating ? (
                <p className="text-white/95 text-sm font-semibold mt-0.5 flex items-center gap-1">
                  <span style={{ color: "#E0A458" }}>★</span>
                  {rating.avg.toFixed(1)} <span className="text-white/70 font-normal">({rating.count})</span>
                </p>
              ) : (partner as any).google_rating != null ? (
                <p className="text-white/95 text-sm font-semibold mt-0.5 flex items-center gap-1">
                  <span style={{ color: "#E0A458" }}>★</span>
                  {Number((partner as any).google_rating).toFixed(1)}
                  {(partner as any).google_reviews != null && (
                    <span className="text-white/70 font-normal">({(partner as any).google_reviews} · Google)</span>
                  )}
                </p>
              ) : null}
              {partner.address && (
                <p className="text-white/80 text-sm flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {partner.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg min-[900px]:max-w-[1100px] mx-auto px-5 py-5 pb-28">
        {/* Stepper: always visible so nobody misses a step */}
        <Stepper steps={BOOKING_STEPS} current={step} maxReached={maxStep} onGo={goStep} />

        {/* Always reachable Continue, so the primary action never hides below the fold */}
        {step === 1 && <StickyContinue ready={!!service} onNext={() => goStep(2)} />}
        {step === 2 && <StickyContinue ready={!!date && !!time} onNext={() => goStep(3)} />}
        {step === 3 && <StickyContinue ready onNext={() => goStep(4)} />}
        {step === 4 && (
          <StickyContinue ready={!!name.trim() && hasContact} onNext={submitDetailsStep} />
        )}
        {step === 5 && (
          <StickyContinue
            ready={canBook && !submitting}
            onNext={handleBook}
            label={`Request booking · €${total}`}
            labelEs="Solicitar reserva"
          />
        )}

        {/* Mobile: slim running summary under the stepper */}
        <div className="min-[900px]:hidden sticky top-0 z-20 -mx-5 mt-2 px-5 py-2 bg-[#FAF6F1]/95 backdrop-blur border-y border-[#EADFD2]">
          <p className="text-xs truncate">
            <span className={service ? "font-semibold text-gray-800" : "text-gray-400"}>{service ? servicePrimaryName(service) : "Pick a service"}</span>
            <span className="text-gray-300"> · </span>
            <span className={prettyDay ? "font-semibold text-gray-800" : "text-gray-400"}>{prettyDay || "Pick a day"}</span>
            <span className="text-gray-300"> · </span>
            <span className={time ? "font-semibold text-gray-800" : "text-gray-400"}>{time || "Pick a time"}</span>
            <span className="text-gray-300"> · </span>
            <span className={service && total > 0 ? "font-semibold text-[#C4622D]" : "text-gray-400"}>{service && total > 0 ? `€${total}` : "Price"}</span>
          </p>
        </div>

        <div className="mt-5 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_360px] min-[900px]:gap-8 min-[900px]:items-start">
          {/* LEFT: one step at a time */}
          <div className="space-y-5 min-w-0">

            {/* STEP 1: service */}
            {step === 1 && (
              <div ref={serviceRef}>
                <Section step="1" title="Choose a service" titleEs="Elige un servicio">
                  {partner.description && <p className="text-sm min-[900px]:text-base text-gray-600 mb-4 min-[900px]:mb-5">{partner.description}</p>}
                  {(partner.gallery || []).length > 0 && (
                    <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-3">
                      {partner.gallery.map((url: string, i: number) => (
                        <img key={i} src={url} alt="" className="h-24 w-36 flex-shrink-0 rounded-xl object-cover border border-gray-200" />
                      ))}
                    </div>
                  )}
                  {!rebookId && (
                    <BookAgainBanner
                      partnerId={partner.id}
                      onRebook={(bookingId) => setSearchParams({ rebook: bookingId, step: "2" })}
                    />
                  )}
                  {rebookMode && service && (
                    <div className="rounded-2xl border-2 border-[#C4622D] bg-[#C4622D]/5 p-4 min-[900px]:p-5 mb-3 min-[900px]:mb-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="inline-flex items-center gap-1.5 bg-[#C4622D] text-white px-2.5 py-1 rounded-full text-[11px] min-[900px]:text-xs font-semibold">
                          <Sparkles size={11} /> Your usual booking
                        </div>
                        <button onClick={() => setRebookMode(false)} className="text-xs min-[900px]:text-sm font-semibold text-[#C4622D] underline underline-offset-2">
                          Change / Cambiar
                        </button>
                      </div>
                      <p className="font-semibold text-gray-900 min-[900px]:text-base">{servicePrimaryName(service)}</p>
                      {serviceSecondaryName(service) && <p className="text-xs min-[900px]:text-sm text-gray-500">{serviceSecondaryName(service)}</p>}
                    </div>
                  )}
                  {!rebookMode && (
                    <div className="space-y-2">
                      <Link
                        to={quizHref}
                        className="w-full flex items-center gap-2 p-4 min-[900px]:p-5 rounded-2xl border border-dashed border-[#C4622D] bg-[#FAF6F1] motion-safe:transition hover:bg-[#F6EFE6]"
                      >
                        <Sparkles size={18} className="text-[#C4622D] flex-shrink-0" />
                        <span className="min-w-0 text-left">
                          <span className="block text-sm min-[900px]:text-base font-semibold text-[#C4622D]">Not sure which massage? Take the 60 second quiz</span>
                          <span className="block text-xs min-[900px]:text-sm text-[#8a7460]">¿No sabes cuál elegir? Haz el test</span>
                        </span>
                      </Link>
                      {profile.services.map(s => (
                        <button key={s.id} onClick={(e) => { setServiceId(s.id); scrollIntoViewGently(e.currentTarget); }}
                          className={`w-full text-left p-4 min-[900px]:p-5 rounded-2xl border-2 transition ${
                            serviceId === s.id ? "border-[#C4622D] bg-[#C4622D]/5" : "border-gray-200 bg-white"
                          }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900 min-[900px]:text-lg">{servicePrimaryName(s)}</p>
                              {serviceSecondaryName(s) && <p className="text-xs min-[900px]:text-sm text-gray-500">{serviceSecondaryName(s)}</p>}
                              {s.description && <p className="text-xs min-[900px]:text-sm text-gray-500 mt-0.5">{s.description}</p>}
                              {Number(s.duration) > 0 && (
                                <p className="text-xs min-[900px]:text-sm text-gray-400 mt-1 flex items-center gap-1"><Clock size={11} /> {Number(s.duration)} min</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {s.price != null && Number(s.price) > 0 && (
                                <p className="font-bold text-[#C4622D] min-[900px]:text-lg flex items-center gap-0.5"><Euro size={13} />{Number(s.price)}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      {profile.services.length === 0 && <p className="text-sm min-[900px]:text-base text-gray-400">No services listed yet.</p>}
                    </div>
                  )}
                </Section>
                <WizardNav
                  onNext={() => goStep(2)}
                  disabled={!service}
                  hint="Choose a service to continue"
                  hintEs="Elige un servicio para continuar"
                />
              </div>
            )}

            {/* STEP 2: day and time */}
            {step === 2 && (
              <div ref={dateRef} className="min-w-0">
                <Section step="2" title="Pick a day and time" titleEs="Elige día y hora">
                  {openDates.length === 0 ? (
                    <p className="text-sm min-[900px]:text-base text-gray-400">No availability set yet. Message the studio directly.</p>
                  ) : (
                    <div className="relative flex gap-2 w-full min-w-0 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory" style={{ scrollPaddingLeft: "4px" }}>
                      {openDates.map(d => {
                        const active = date && isoDate(d) === isoDate(date);
                        return (
                          <button key={isoDate(d)} onClick={(e) => { setDate(d); setTime(null); scrollIntoViewGently(e.currentTarget); }}
                            className={`flex-shrink-0 w-16 min-[900px]:w-20 py-2.5 min-[900px]:py-3.5 rounded-2xl border-2 text-center transition snap-start ${
                              active ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                            }`}>
                            <div className="text-[10px] min-[900px]:text-xs uppercase opacity-70">{DAY_LABELS[d.getDay()]}</div>
                            <div className="text-lg min-[900px]:text-2xl font-bold leading-none mt-0.5">{d.getDate()}</div>
                            <div className="text-[10px] min-[900px]:text-xs opacity-70">{MONTHS[d.getMonth()]}</div>
                          </button>
                        );
                      })}
                      <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-[#FAF6F1] to-transparent" aria-hidden />
                    </div>
                  )}
                  {date && (
                    <div ref={timeRef} className="mt-5">
                      <p className="text-xs min-[900px]:text-xl font-semibold text-gray-500 mb-2 min-[900px]:mb-3">Times <span className="font-normal text-gray-400 min-[900px]:text-sm">/ Horas</span></p>
                      {times.length === 0 ? (
                        <p className="text-sm min-[900px]:text-base text-gray-400">Fully booked that day. Try another date.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 min-[900px]:gap-3">
                          {times.map(t => {
                            const left = remainingFor(t);
                            const cap = date ? capacityFor(date.getDay(), t) : therapistCount;
                            const lowStock = cap > 1 && left < cap;
                            return (
                              <button key={t} onClick={() => setTime(t)}
                                className={`px-4 min-[900px]:px-5 py-2 min-[900px]:py-3 rounded-full border-2 text-sm min-[900px]:text-[15px] font-medium motion-safe:transition ${
                                  time === t ? "border-[#C4622D] bg-[#C4622D] text-white" : "border-gray-200 bg-white text-gray-700"
                                }`}>
                                {t}
                                {lowStock && (
                                  <span className={`block text-[10px] min-[900px]:text-xs font-normal ${time === t ? "text-white/80" : "text-amber-600"}`}>
                                    {left} left
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Section>
                <WizardNav
                  onBack={() => goStep(1)}
                  onNext={() => goStep(3)}
                  disabled={!date || !time}
                  hint="Pick a day and a time to continue"
                  hintEs="Elige un día y una hora para continuar"
                />
              </div>
            )}

            {/* STEP 3: customize */}
            {step === 3 && (
              <div>
                <Section step="3" title="Customize your session" titleEs="Personaliza tu sesión">
                  <p className="text-sm min-[900px]:text-base text-gray-500 mb-4 min-[900px]:mb-5">
                    Optional, but it helps your therapist get it right.
                    <span className="block text-xs min-[900px]:text-sm text-gray-400">Opcional, pero ayuda a tu terapeuta.</span>
                  </p>
                  {customerProfile && prefsApplied && (
                    <div className="mb-4 min-[900px]:mb-5 rounded-xl border border-[#C4622D]/30 bg-[#C4622D]/5 px-3 min-[900px]:px-4 py-2 min-[900px]:py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs min-[900px]:text-sm font-medium text-gray-700">Prefilled from your profile</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPressure("Medium");
                          setFocusAreas([]);
                          setAddonNames([]);
                          setConversationPref("");
                          setPrefsApplied(false);
                        }}
                        className="text-xs min-[900px]:text-sm font-semibold text-[#C4622D] underline"
                      >
                        Start blank
                      </button>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">Comfort <span className="font-normal text-gray-400 min-[900px]:text-sm">/ Confort</span></p>
                  <div className="flex flex-wrap gap-2 mb-4 min-[900px]:gap-3 min-[900px]:mb-5">
                    {[
                      { v: "silence", l: "Silence" },
                      { v: "minimal", l: "A little chat" },
                      { v: "chatty", l: "Happy to chat" },
                    ].map(o => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setConversationPref(prev => prev === o.v ? "" : o.v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition min-[900px]:px-5 min-[900px]:py-3 min-[900px]:text-[15px] ${
                          conversationPref === o.v ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">Pressure <span className="font-normal text-gray-400 min-[900px]:text-sm">/ Presión</span></p>
                  <div className="flex flex-wrap gap-2 mb-4 min-[900px]:gap-3 min-[900px]:mb-5">
                    {PRESSURE_LEVELS.map(p => (
                      <button key={p} onClick={() => setPressure(p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition min-[900px]:px-5 min-[900px]:py-3 min-[900px]:text-[15px] ${
                          pressure === p ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                        }`}>{p}</button>
                    ))}
                  </div>

                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">Focus areas <span className="font-normal text-gray-400 min-[900px]:text-sm">/ Zonas</span></p>
                  <div className="flex flex-wrap gap-2 mb-4 min-[900px]:gap-3 min-[900px]:mb-5">
                    {FOCUS_AREAS.map(f => (
                      <button key={f} onClick={() => toggle(focusAreas, f, setFocusAreas)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition min-[900px]:px-5 min-[900px]:py-3 min-[900px]:text-[15px] ${
                          focusAreas.includes(f) ? "bg-[#C4622D] text-white border-[#C4622D]" : "bg-white text-gray-600 border-gray-200"
                        }`}>{f}</button>
                    ))}
                  </div>

                  {addons.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">Add-ons <span className="font-normal text-gray-400 min-[900px]:text-sm">/ Extras</span></p>
                      <div className="space-y-2 min-[900px]:space-y-3 mb-4 min-[900px]:mb-5">
                        {addons.map((a: any) => {
                          const on = addonNames.includes(a.name);
                          return (
                            <button key={a.id} onClick={() => toggle(addonNames, a.name, setAddonNames)}
                              className={`w-full flex items-center justify-between p-3 min-[900px]:p-4 rounded-xl border-2 text-left transition ${
                                on ? "border-[#C4622D] bg-[#C4622D]/5" : "border-gray-200 bg-white"
                              }`}>
                              <div>
                                <p className="text-sm font-medium text-gray-900 min-[900px]:text-base">{a.name}</p>
                                <p className="text-xs text-gray-400 min-[900px]:text-sm">+€{a.price}</p>
                              </div>
                              <div className={`h-5 w-5 min-[900px]:h-6 min-[900px]:w-6 rounded-full border-2 flex items-center justify-center ${on ? "border-[#C4622D] bg-[#C4622D]" : "border-gray-300"}`}>
                                {on && <Check size={12} className="text-white min-[900px]:size-4" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <p className="text-xs font-semibold text-gray-500 mb-2 min-[900px]:text-xl min-[900px]:mb-3">Notes for your therapist <span className="font-normal text-gray-400 min-[900px]:text-sm">/ Notas</span></p>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Anything we should know? Injuries, allergies, preferences."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#C4622D] resize-none h-24 min-[900px]:text-base min-[900px]:h-28" />
                </Section>
                <WizardNav onBack={() => goStep(2)} onNext={() => goStep(4)} skip={() => goStep(4)} />
              </div>
            )}

            {/* STEP 4: your details */}
            {step === 4 && (
              <div>
                <Section step="4" title="Your details" titleEs="Tus datos">
                  <div className="space-y-2 min-[900px]:space-y-3">
                    <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setStepError(null); }} placeholder="Your name / Tu nombre"
                      aria-invalid={!!stepError && !name.trim()}
                      className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                        stepError && !name.trim() ? "border-2 border-[#B03A2E]" : "border-gray-200"
                      }`} />
                    <input ref={emailRef} value={email} onChange={e => { setEmail(e.target.value); setStepError(null); }} placeholder="Email" type="email"
                      className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                        stepError && !hasContact ? "border-2 border-[#B03A2E]" : "border-gray-200"
                      }`} />
                    <input value={phone} onChange={e => { setPhone(e.target.value); setStepError(null); }} placeholder="Phone / WhatsApp (optional)" type="tel"
                      className={`w-full h-12 min-[900px]:h-14 px-4 rounded-xl border bg-white text-sm min-[900px]:text-base focus:outline-none focus:border-[#C4622D] ${
                        stepError && !hasContact ? "border-2 border-[#B03A2E]" : "border-gray-200"
                      }`} />
                    <p className="text-xs min-[900px]:text-sm text-gray-400">
                      Add at least one way to reach you: email or phone.
                      <span className="block text-[11px] min-[900px]:text-xs text-gray-400">Añade al menos un email o teléfono.</span>
                    </p>
                    {!userId && !!email.trim() && (
                      <label className="flex items-start gap-2 pt-2 min-[900px]:pt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createAccount}
                          onChange={e => setCreateAccount(e.target.checked)}
                          className="mt-1 h-4 w-4 min-[900px]:h-5 min-[900px]:w-5 accent-[#C4622D]"
                        />
                        <span className="text-xs min-[900px]:text-sm text-gray-600 leading-snug">
                          Create my free Massage Club account
                          <span className="block text-[11px] min-[900px]:text-xs text-gray-400">
                            Track your booking and rebook faster. We'll email you a one-tap sign-in link, no password.
                          </span>
                          <span className="block text-[11px] min-[900px]:text-xs text-gray-400">
                            Sigue tu reserva y repite más rápido. Te enviamos un enlace de acceso de un toque, sin contraseña.
                          </span>
                        </span>
                      </label>
                    )}
                    <label className="flex items-start gap-2 pt-2 min-[900px]:pt-3 cursor-pointer">

                      <input
                        type="checkbox"
                        checked={marketingOptIn}
                        onChange={e => setMarketingOptIn(e.target.checked)}
                        className="mt-1 h-4 w-4 min-[900px]:h-5 min-[900px]:w-5 accent-[#C4622D]"
                      />
                      <span className="text-xs min-[900px]:text-sm text-gray-600 leading-snug">
                        Send me Massage Club news and offers (optional)
                        <span className="block text-[11px] min-[900px]:text-xs text-gray-400">Quiero recibir novedades y ofertas de Massage Club por email</span>
                      </span>
                    </label>
                    {stepError && (
                      <p role="alert" className="text-sm min-[900px]:text-base font-medium text-[#B03A2E]">
                        {stepError.en}
                        <span className="block text-xs min-[900px]:text-sm font-normal text-[#8a7460]">{stepError.es}</span>
                      </p>
                    )}
                  </div>
                </Section>
                <WizardNav
                  onBack={() => goStep(3)}
                  onNext={submitDetailsStep}
                  disabled={!name.trim() || !hasContact}
                  hint="Add your name and an email or phone so the studio can reach you"
                  hintEs="Añade tu nombre y un email o teléfono para que el estudio pueda contactarte"
                />
              </div>
            )}

            {/* STEP 5: confirm */}
            {step === 5 && (
              <div>
                <Section step="5" title="Review and confirm" titleEs="Revisa y confirma">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 min-[900px]:p-5 space-y-2 min-[900px]:space-y-3">
                    <SummaryRow label="Service" labelEs="Servicio" value={service ? servicePrimaryName(service) : null} placeholder="Pick a service" />
                    <SummaryRow label="Day" labelEs="Día" value={prettyDay} placeholder="Pick a day" />
                    <SummaryRow label="Time" labelEs="Hora" value={time} placeholder="Pick a time" />
                    <SummaryRow label="Pressure" labelEs="Presión" value={pressure || null} placeholder="Not set" />
                    <SummaryRow label="Comfort" labelEs="Confort" value={conversationPref ? CONVERSATION_LABELS[conversationPref] || conversationPref : null} placeholder="Not set" />
                    <SummaryRow label="Focus areas" labelEs="Zonas" value={focusAreas.length ? focusAreas.join(", ") : null} placeholder="None" />
                    <SummaryRow label="Add-ons" labelEs="Extras" value={addonNames.length ? addonNames.join(", ") : null} placeholder="None" />
                    <SummaryRow label="Notes" labelEs="Notas" value={notes.trim() || null} placeholder="None" />
                    <SummaryRow label="Name" labelEs="Nombre" value={name.trim() || null} placeholder="Add your name" />
                    <SummaryRow label="Contact" labelEs="Contacto" value={[email.trim(), phone.trim()].filter(Boolean).join(" · ") || null} placeholder="Add a contact" />
                    <SummaryRow label="Price" labelEs="Precio" value={total > 0 ? `€${total}` : null} placeholder="Pick a service" />
                  </div>
                  {error && <p className="mt-3 text-sm min-[900px]:text-base text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}
                  <button
                    onClick={handleBook}
                    disabled={submitting || !canBook}
                    className={`mt-4 w-full h-14 min-[900px]:h-16 rounded-2xl font-semibold flex items-center justify-center gap-2 motion-safe:transition ${
                      canBook ? "bg-[#C4622D] text-white shadow-lg" : "bg-[#E7D9CB] text-[#9E8B78]"
                    }`}
                  >
                    {submitting ? (
                      <><Loader2 size={18} className="animate-spin" /> Booking</>
                    ) : (
                      <span className="flex flex-col items-center leading-tight">
                        <span className="inline-flex items-center gap-2 min-[900px]:text-lg"><CalendarDays size={18} /> Request booking · €{total}</span>
                        <span className="text-xs min-[900px]:text-sm font-normal opacity-90">Solicitar reserva</span>
                      </span>
                    )}
                  </button>
                  <p className="mt-2 text-xs min-[900px]:text-sm text-center text-[#8a7460]">
                    The studio confirms your time. You pay at the studio.
                    <span className="block">El estudio confirma tu hora. Pagas en el estudio.</span>
                  </p>
                  <div className="pt-3">
                    <button type="button" onClick={() => goStep(4)} className="text-sm min-[900px]:text-base font-semibold text-[#8a7460] underline underline-offset-2">
                      Back <span className="font-normal">/ Atrás</span>
                    </button>
                  </div>
                </Section>
              </div>
            )}
          </div>

          {/* RIGHT: running summary, desktop only */}
          <aside className="hidden min-[900px]:block min-[900px]:sticky min-[900px]:top-4 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 min-[900px]:p-5 space-y-2 min-[900px]:space-y-3">
              <p className="text-xs min-[900px]:text-sm font-bold uppercase tracking-[2px] text-[#C4622D] mb-1 min-[900px]:mb-2">
                Your booking <span className="font-normal text-[#B3A597]">/ Tu reserva</span>
              </p>
              <SummaryRow label="Service" labelEs="Servicio" value={service ? servicePrimaryName(service) : null} placeholder="Pick a service" />
              <SummaryRow label="Day" labelEs="Día" value={prettyDay} placeholder="Pick a day" />
              <SummaryRow label="Time" labelEs="Hora" value={time} placeholder="Pick a time" />
              <SummaryRow label="Price" labelEs="Precio" value={service && total > 0 ? `€${total}` : null} placeholder="Pick a service" />
            </div>
            {bookingWaHref && (
              <a
                href={bookingWaHref}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  clarityEvent("whatsapp_click");
                  sendTrack({
                    event: "whatsapp_click",
                    path: window.location.pathname,
                    slug: partner.slug || partner.id,
                    meta: { filled: !!(service || date || time), service: !!service, date: !!date },
                  });
                  logWhatsappRequest({
                    partner_id: partner.id,
                    slug: partner.slug || null,
                    studio_name: partner.business_name,
                    service_name: service ? servicePrimaryName(service) : null,
                    price: service && total > 0 ? total : null,
                    day1: prettyDay,
                    time1: time,
                    first_name: name.trim() || null,
                    contact_email: email.trim() || null,
                    languages: spokenLangs.join(", "),
                    user_id: userId,
                    wa_number: bookingWaNumber,
                    message_text: bookingWaMsg,
                  });
                }}
                className={`w-full inline-flex flex-col items-center justify-center min-h-[48px] min-[900px]:min-h-[56px] px-6 py-2 min-[900px]:py-2.5 rounded-2xl font-semibold motion-safe:transition ${
                  partner.status === "active"
                    ? "border border-[#C4622D] text-[#C4622D] bg-white hover:bg-[#FAF6F1]"
                    : "text-white bg-[#C4622D] shadow-sm hover:opacity-95"
                }`}
              >
                <span className="inline-flex items-center gap-2 min-[900px]:text-base"><MessageCircle size={18} /> Ask on WhatsApp</span>
                <span className="text-xs min-[900px]:text-sm font-normal opacity-90">Preguntar por WhatsApp</span>
              </a>
            )}
            <div className="flex flex-wrap gap-2 min-[900px]:gap-2.5">
              {(partner.languages || []).slice(0, 4).map((l: string) => (
                <span key={l} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs min-[900px]:text-sm text-gray-600">{tagLabel(l)}</span>
              ))}
              {(partner.amenities || []).slice(0, 4).map((a: string) => (
                <span key={a} className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs min-[900px]:text-sm text-gray-600">{tagLabel(a)}</span>
              ))}
            </div>
          </aside>

          <div className="min-[900px]:col-span-2 space-y-5">
            {/* Contact footer */}
            <div className="flex items-center justify-center gap-4 pt-6 pb-8 text-gray-400">
              {bookingWaNumber && (() => {
                const contactWa = studioWhatsappUrl(bookingWaNumber);
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
      </div>


    </div>
  );
}

function Section({ step, title, titleEs, children }: { step: string; title: string; titleEs?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 min-[900px]:mb-4">
        <div className="h-6 w-6 min-[900px]:h-8 min-[900px]:w-8 rounded-full bg-[#C4622D] text-white flex items-center justify-center text-xs min-[900px]:text-sm font-bold flex-shrink-0">{step}</div>
        <div>
          <h2 className="font-display text-lg min-[900px]:text-[22px] leading-tight text-gray-900">{title}</h2>
          {titleEs && <p className="text-xs min-[900px]:text-sm text-[#8a7460] leading-tight">{titleEs}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Horizontal day strip used by the WhatsApp handoff form (ISO value in/out). */
function DayStrip({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {days.map(d => {
        const iso = isoDate(d);
        const active = value === iso;
        return (
          <button
            key={iso}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? "" : iso)}
            className="flex-shrink-0 w-16 min-[900px]:w-20 py-2 min-[900px]:py-3.5 rounded-2xl border-2 text-center motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D]"
            style={{
              borderColor: active ? "#C4622D" : "#E6DCCF",
              background: active ? "#C4622D" : "#ffffff",
              color: active ? "#ffffff" : "#5a4736",
            }}
          >
            <div className="text-[10px] min-[900px]:text-xs uppercase opacity-70">{DAY_LABELS[d.getDay()]}</div>
            <div className="text-lg min-[900px]:text-2xl font-bold leading-none mt-0.5">{d.getDate()}</div>
            <div className="text-[10px] min-[900px]:text-xs opacity-70">{MONTHS[d.getMonth()]}</div>
          </button>
        );
      })}
    </div>
  );
}

/** Rounded time pills for the handoff form (fixed options, real availability unknown). */
function TimePills({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2 min-[900px]:gap-3">
      {HANDOFF_TIMES.map(t => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? "" : t)}
            className="px-3.5 min-[900px]:px-5 py-2 min-[900px]:py-3 rounded-full border-2 text-sm min-[900px]:text-[15px] font-medium motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D]"
            style={{
              borderColor: active ? "#C4622D" : "#E6DCCF",
              background: active ? "#C4622D" : "#ffffff",
              color: active ? "#ffffff" : "#5a4736",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

export type StepDef = { label: string; labelEs: string };

/** Always visible wizard header. Completed steps are clickable, upcoming ones muted. */
/** Keeps a freshly selected card comfortably in view without a jarring jump. */
function scrollIntoViewGently(el: HTMLElement | null) {
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  } catch {
    /* older browsers: no smooth scrolling, no problem */
  }
}

/**
 * Always reachable Continue bar. Full width on mobile, aligned under the right
 * summary column on desktop, so picking a service never looks like nothing happened.
 */
function StickyContinue({
  ready, onNext, label, labelEs,
}: { ready: boolean; onNext: () => void; label?: string; labelEs?: string }) {
  if (!ready) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EADFD2] bg-[#FAF6F1]/95 backdrop-blur shadow-[0_-6px_24px_rgba(80,44,20,0.06)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg min-[900px]:max-w-[1100px] mx-auto min-[900px]:flex min-[900px]:justify-center">
        <button
          type="button"
          onClick={onNext}
          className="w-full min-[900px]:max-w-md min-[900px]:w-auto min-[900px]:px-16 h-13 min-h-[52px] min-[900px]:h-14 rounded-2xl font-semibold flex flex-col items-center justify-center leading-tight bg-[#C4622D] text-white shadow-lg motion-safe:transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D] focus-visible:ring-offset-2"
        >
          <span className="min-[900px]:text-lg">{label || "Continue"}</span>
          <span className="text-xs font-normal opacity-90 min-[900px]:text-sm">{labelEs || "Continuar"}</span>
        </button>
      </div>
    </div>
  );
}

function Stepper({
  steps, current, maxReached, onGo,
}: { steps: StepDef[]; current: number; maxReached: number; onGo: (n: number) => void }) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  // On narrow screens the five steps scroll, so keep the active one in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [current]);
  return (
    <nav
      aria-label="Booking steps"
      className="relative flex items-start gap-0.5 min-[900px]:gap-1 overflow-x-auto pb-1 -mx-1 px-1 max-w-full min-[900px]:max-w-[720px] no-scrollbar"
    >
      {/* Thin connector line behind the step bullets */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-8 right-8 top-[22px] h-px bg-[#E7D9CB]"
      />
      {steps.map((s, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isDone = n < current || (n <= maxReached && n !== current);
        const reachable = n <= maxReached;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => reachable && onGo(n)}
            disabled={!reachable}
            aria-current={isCurrent ? "step" : undefined}
            ref={isCurrent ? activeRef : undefined}
            className={`relative flex-1 min-w-[62px] min-[900px]:min-w-[86px] text-center px-1 min-[900px]:px-1.5 py-2 rounded-xl motion-safe:transition ${
              isCurrent ? "bg-[#C4622D]/10" : ""
            } ${reachable && !isCurrent ? "hover:bg-[#F1E7DB]" : ""}`}
          >
            <span
              className={`relative mx-auto mb-1 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ring-4 ring-[#FAF6F1] ${
                isCurrent
                  ? "bg-[#C4622D] text-white"
                  : isDone
                    ? "bg-[#C4622D]/15 text-[#C4622D]"
                    : "bg-[#E7D9CB] text-[#9E8B78]"
              }`}
            >
              {isDone ? <Check size={13} /> : n}
            </span>
            <span
              className={`block text-[10px] min-[900px]:text-[11px] font-semibold leading-tight ${
                isCurrent ? "text-[#C4622D]" : isDone ? "text-gray-700" : "text-[#A6968A]"
              }`}
            >
              {s.label}
            </span>
            <span className="hidden min-[380px]:block text-[9px] min-[900px]:text-[10px] leading-tight text-[#B3A597]">{s.labelEs}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Back link plus the primary Continue button used at the bottom of each step. */
function WizardNav({
  onBack, onNext, disabled, label, labelEs, hint, hintEs, skip,
}: {
  onBack?: () => void;
  onNext: () => void;
  disabled?: boolean;
  label?: string;
  labelEs?: string;
  hint?: string;
  hintEs?: string;
  skip?: () => void;
}) {
  return (
    <div className="pt-4 min-[900px]:pt-5 space-y-2 min-[900px]:space-y-3">
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className={`w-full h-14 min-[900px]:h-16 rounded-2xl font-semibold flex flex-col items-center justify-center leading-tight motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4622D] focus-visible:ring-offset-2 ${
          disabled ? "bg-[#E7D9CB] text-[#9E8B78]" : "bg-[#C4622D] text-white shadow-lg"
        }`}
      >
        <span className="min-[900px]:text-lg">{label || "Continue"}</span>
        <span className="text-xs min-[900px]:text-sm font-normal opacity-90">{labelEs || "Continuar"}</span>
      </button>
      {disabled && hint && (
        <p className="text-xs min-[900px]:text-sm text-center text-[#8a7460]">
          {hint}
          {hintEs && <span className="block">{hintEs}</span>}
        </p>
      )}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm min-[900px]:text-base font-semibold text-[#8a7460] underline underline-offset-2">
            Back <span className="font-normal">/ Atrás</span>
          </button>
        ) : <span />}
        {skip && (
          <button type="button" onClick={skip} className="text-sm min-[900px]:text-base font-semibold text-[#C4622D] underline underline-offset-2">
            Skip this step <span className="font-normal">/ Saltar</span>
          </button>
        )}
      </div>
    </div>
  );
}


/** One line of the live booking summary. */
function SummaryRow({ label, labelEs, value, placeholder }: { label: string; labelEs: string; value: string | null; placeholder: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs min-[900px]:text-sm text-gray-400 flex-shrink-0">
        {label} <span className="text-[10px] min-[900px]:text-xs text-gray-300">{labelEs}</span>
      </span>
      <span className={`text-sm min-[900px]:text-base text-right truncate ${value ? "font-semibold text-gray-900" : "text-gray-300"}`}>
        {value || placeholder}
      </span>
    </div>
  );
}
