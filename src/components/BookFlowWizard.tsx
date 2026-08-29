import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, MapPin, MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/siteVisit";
import { trackFunnel } from "@/lib/funnel";
import { MADRID_AREAS } from "@/lib/locationConsent";
import { haversineKm } from "@/lib/nearestStudios";
import { contactOk, CONTACT_COPY } from "@/lib/contactValidation";
import { DealsConfirmationLine } from "@/components/DealsLink";
import ExitCaptureBlock from "@/components/ExitCaptureBlock";


const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";

export type PageLang = "en" | "es";

export const BOOK_FLOW_COPY = {
  en: {
    brand: "Massage Club · Madrid",
    steps: ["Massage", "When", "Where", "Details"],
    step: "Step",
    of: "of",
    back: "Back",
    continue: "Continue",
    s1Title: "What massage?",
    s1Miss: "Pick a massage to continue.",
    specificLabel: "Anything specific?",
    specificPh: "e.g. strong pressure, 90 minutes",
    massages: [
      "Deep tissue",
      "Relaxing",
      "Thai",
      "Sports recovery",
      "Hot stone",
      "Couples",
      "Not sure",
    ],
    s2Title: "When?",
    s2MissDay: "Pick a day to continue.",
    s2MissTime: "Pick a time of day to continue.",
    dayLabel: "Which day",
    timeLabel: "Time of day",
    s2Helper: "The more times you give us, the faster we confirm with the studio.",
    addTime: "+ Add another time (recommended)",
    option: "Option",
    today: "Today",
    tomorrow: "Tomorrow",
    flexible: "Flexible",
    morning: "Morning (10-13)",
    afternoon: "Afternoon (13-18)",
    evening: "Evening (18-21)",
    s3Title: "Where?",
    s3Label: "Area",
    s3Miss: "Choose an area to continue.",
    s3MissOther: "Tell us where you'd like it.",
    s3Helper: "We'll find you something close.",
    otherPh: "Which area or address?",
    areaPlaceholder: "Choose an area",
    other: "Somewhere else",
    useLocation: "Use my location",
    locating: "Locating you...",
    locationDenied: "No problem, pick your area below",
    s4Title: "Your details",
    peopleLabel: "How many people?",
    peopleLink: "Booking for more than one person?",
    peopleHelp: "We will check the studio can take your group at the same time.",
    sumPeople: "People",
    name: "Name",
    firstName: "First name",
    lastName: "Last name",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "We need your first and last name.",
    missContact: "Add a WhatsApp number or an email so we can reply.",
    consent: "By booking you agree we can contact you about this request.",
    submit: "Request my massage",
    sending: "Sending...",
    sendError: "Could not send. Message us on WhatsApp at +34 612 474 827.",
    promiseTitle: "We are checking with the studio now",
    promiseBody:
      "You will hear from us within 30 minutes with your confirmed time. If they cannot fit you, we will send you other studios nearby.",
    successTitle: "Almost done - send it to us",
    successSub: "Tap send in WhatsApp and we'll confirm your time with the studio.",
    sendWhatsApp: "Send my request on WhatsApp",
    noWhatsApp: "No WhatsApp? We'll reply to {contact}.",
    sumMassage: "Massage",
    sumWhen: "When",
    sumWhere: "Where",
    seoTitle: "Book a massage in Madrid | Massage Club",
    seoDesc:
      "Tell us the massage you want, when and where. We confirm the time with the studio and message you back the same day.",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  es: {
    brand: "Massage Club · Madrid",
    steps: ["Masaje", "Cuándo", "Dónde", "Datos"],
    step: "Paso",
    of: "de",
    back: "Atrás",
    continue: "Continuar",
    s1Title: "¿Qué masaje?",
    s1Miss: "Elige un masaje para continuar.",
    specificLabel: "¿Algo concreto?",
    specificPh: "p. ej. presión fuerte, 90 minutos",
    massages: [
      "Masaje descontracturante",
      "Relajante",
      "Tailandés",
      "Recuperación deportiva",
      "Piedras calientes",
      "En pareja",
      "No lo sé",
    ],
    s2Title: "¿Cuándo?",
    s2MissDay: "Elige un día para continuar.",
    s2MissTime: "Elige una franja horaria para continuar.",
    dayLabel: "Qué día",
    timeLabel: "Franja horaria",
    s2Helper: "Cuantas más horas nos des, antes te confirmamos con el centro.",
    addTime: "+ Añadir otra hora (recomendado)",
    option: "Opción",
    today: "Hoy",
    tomorrow: "Mañana",
    flexible: "Flexible",
    morning: "Mañana (10-13)",
    afternoon: "Tarde (13-18)",
    evening: "Noche (18-21)",
    s3Title: "¿Dónde?",
    s3Label: "Zona",
    s3Miss: "Elige una zona para continuar.",
    s3MissOther: "Dinos dónde lo quieres.",
    s3Helper: "Te buscamos algo cerca.",
    otherPh: "¿Qué zona o dirección?",
    areaPlaceholder: "Elige una zona",
    other: "Otra zona",
    useLocation: "Usar mi ubicación",
    locating: "Localizándote...",
    locationDenied: "Sin problema, elige tu zona abajo",
    s4Title: "Tus datos",
    peopleLabel: "¿Cuántas personas?",
    peopleLink: "¿Reservas para más de una persona?",
    peopleHelp: "Confirmamos con el centro que pueden atender a todo el grupo a la vez.",
    sumPeople: "Personas",
    name: "Nombre",
    firstName: "Nombre",
    lastName: "Apellido",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "Necesitamos tu nombre y apellido.",
    missContact: "Añade un WhatsApp o un email para poder responderte.",
    consent: "Al reservar aceptas que te contactemos sobre esta solicitud.",
    submit: "Pedir mi masaje",
    sending: "Enviando...",
    sendError: "No se pudo enviar. Escríbenos por WhatsApp al +34 612 474 827.",
    promiseTitle: "Estamos confirmando con el centro",
    promiseBody:
      "Te escribimos en menos de 30 minutos con tu hora confirmada. Si no pueden, te mandamos otros centros cerca.",
    successTitle: "Casi listo - envíanoslo",
    successSub: "Dale a enviar en WhatsApp y confirmamos tu hora con el centro.",
    sendWhatsApp: "Enviar mi solicitud por WhatsApp",
    noWhatsApp: "¿No tienes WhatsApp? Te respondemos a {contact}.",
    sumMassage: "Masaje",
    sumWhen: "Cuándo",
    sumWhere: "Dónde",
    seoTitle: "Reserva un masaje en Madrid | Massage Club",
    seoDesc:
      "Dinos qué masaje quieres, cuándo y dónde. Confirmamos la hora con el centro y te escribimos el mismo día.",
    weekdays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  },
} as const;

const PEOPLE_OPTIONS = ["2", "3", "4", "5+"];

const AREAS_BASE = [
  "Centro",
  "Chamberí",
  "Malasaña",
  "Chueca",
  "Salamanca",
  "La Latina",
  "Lavapiés",
  "Argüelles/Moncloa",
  "Chamartín",
  "Tetuán",
  "Retiro",
];

export function useBookFlowLang(): PageLang {
  const { i18n } = useTranslation();
  const resolved = (i18n.resolvedLanguage || "en").slice(0, 2);
  const lang: PageLang = resolved === "es" ? "es" : "en";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mc_lang");
      if ((saved === "en" || saved === "es") && saved !== resolved) i18n.changeLanguage(saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("mc_lang", lang); } catch { /* ignore */ }
  }, [lang]);

  return lang;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 px-4 rounded-full border text-base whitespace-nowrap transition ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-soft font-semibold"
          : "bg-card text-foreground border-border hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The 4-step concierge booking wizard (Massage -> When -> Where -> Details).
 * Shared by /book and the /fb landing page; `source` tags the lead row.
 */
export default function BookFlowWizard({
  source,
  lang,
  showBrand = true,
  scrollTopOnStep = true,
  preselect = null,
}: {
  source: string;
  lang: PageLang;
  showBrand?: boolean;
  scrollTopOnStep?: boolean;
  /** Preselect a massage in step 1 from outside. Bump `nonce` to re-apply. */
  preselect?: { value: string; nonce: number } | null;
}) {
  const t = BOOK_FLOW_COPY[lang] ?? BOOK_FLOW_COPY.en;
  const cc = CONTACT_COPY[lang as "en" | "es"] ?? CONTACT_COPY.en;


  const [step, setStep] = useState(1);
  const [massage, setMassage] = useState("");
  const [specific, setSpecific] = useState("");
  const [people, setPeople] = useState("1");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [day2, setDay2] = useState("");
  const [time2, setTime2] = useState("");
  const [day3, setDay3] = useState("");
  const [time3, setTime3] = useState("");
  const [slots, setSlots] = useState(1);
  const [area, setArea] = useState("");
  const [areaOther, setAreaOther] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const rootRef = useRef<HTMLDivElement>(null);
  const massageRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  // Today in Europe/Madrid, as a local-noon Date so date maths stay stable.
  const madridToday = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const [y, m, d] = parts.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }, []);

  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const dayOptions = useMemo(() => {
    const out: { label: string; iso: string }[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(madridToday);
      d.setDate(madridToday.getDate() + i);
      const label = i === 0 ? t.today : i === 1 ? t.tomorrow : `${t.weekdays[d.getDay()]} ${d.getDate()}`;
      out.push({ label, iso: toIso(d) });
    }
    out.push({ label: t.flexible, iso: "Flexible" });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, madridToday]);

  const dayChips = useMemo(() => dayOptions.map((o) => o.label), [dayOptions]);

  const isoForDay = (label: string) => dayOptions.find((o) => o.label === label)?.iso ?? "Flexible";

  /** "Saturday 29 Aug" / "sábado 29 ago" - or "Flexible". */
  const prettyDay = (label: string) => {
    const iso = isoForDay(label);
    if (iso === "Flexible") return t.flexible;
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(new Date(y, m - 1, d, 12));
  };

  const prettySlot = (dayLabel: string, timeLabel: string) => {
    if (!dayLabel && !timeLabel) return "";
    const parts = [dayLabel ? prettyDay(dayLabel) : "", timeLabel ? timeLabel.toLowerCase() : ""].filter(Boolean);
    return parts.join(", ");
  };


  useEffect(() => {
    if (!preselect) return;
    setMassage(preselect.value);
    setStep(1);
    setHint(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect?.nonce]);

  const timeChips = [t.morning, t.afternoon, t.evening, t.flexible];
  const areas = [...AREAS_BASE, t.other];

  const contact = contactOk(phone, email);
  const nameComplete = !!firstName.trim() && !!lastName.trim();
  const canSubmit = nameComplete && contact.ok;



  const fail = (msg: string, ref: React.RefObject<HTMLDivElement>) => {
    setHint(msg);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const afterStep = () => {
    if (scrollTopOnStep) window.scrollTo({ top: 0, behavior: "smooth" });
    else rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goNext = () => {
    setHint(null);
    if (step === 1) {
      if (!massage) return fail(t.s1Miss, massageRef);
      setStep(2);
    } else if (step === 2) {
      if (!day) return fail(t.s2MissDay, dayRef);
      if (!time) return fail(t.s2MissTime, timeRef);
      setStep(3);
    } else if (step === 3) {
      if (!area) return fail(t.s3Miss, areaRef);
      if (area === t.other && !areaOther.trim()) return fail(t.s3MissOther, areaRef);
      setStep(4);
    }
    afterStep();
  };

  const areaValue = area === t.other ? areaOther.trim() || t.other : area;
  const baseWant = specific.trim() ? `${massage} + ${specific.trim()}` : massage;
  const isGroup = people !== "1";
  const wantValue = isGroup ? `${baseWant} - Personas: ${people}` : baseWant;

  const mapAreaNameToOption = (name: string): string => {
    if (name === "Argüelles") return "Argüelles/Moncloa";
    return name;
  };

  // Funnel: each step becoming visible, with whatever they have chosen so far.
  useEffect(() => {
    trackFunnel(`wizard_step_${step}`, {
      source,
      lang,
      massage: massage || null,
      area: area ? areaValue : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleUseLocation = () => {
    setLocationDenied(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      trackEvent("locate_denied");
      setLocationDenied(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        trackEvent("locate_granted");
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        let nearest = MADRID_AREAS[0];
        let bestKm = Infinity;
        for (const a of MADRID_AREAS) {
          const km = haversineKm(userLat, userLng, a.lat, a.lng);
          if (km < bestKm) {
            bestKm = km;
            nearest = a;
          }
        }
        const option = mapAreaNameToOption(nearest.name);
        if (areas.includes(option)) {
          setArea(option);
          trackFunnel("wizard_area_selected", { area: option, via: "geolocation", massage: massage || null, source });
        } else if (areas.includes(nearest.name)) {
          setArea(nearest.name);
          trackFunnel("wizard_area_selected", { area: nearest.name, via: "geolocation", massage: massage || null, source });
        }
        setHint(null);
      },
      () => {
        setLocating(false);
        trackEvent("locate_denied");
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const whenValue = prettySlot(day, time);
  const when2Value = prettySlot(day2, time2);
  const when3Value = prettySlot(day3, time3);

  const submit = async () => {
    setHint(null);
    if (!firstName.trim() || !lastName.trim()) return fail(t.missName, nameRef);
    if (contact.phoneValid === false) return fail(cc.badPhone, contactRef);
    if (contact.emailValid === false) return fail(cc.badEmail, contactRef);
    if (!contact.ok) return fail(cc.needContact, contactRef);


    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          want: wantValue,
          day1: day ? isoForDay(day) : undefined,
          time1: time || undefined,
          day2: day2 ? isoForDay(day2) : undefined,
          time2: time2 || undefined,
          day3: day3 ? isoForDay(day3) : undefined,
          time3: time3 || undefined,
          when: whenValue,
          when2: when2Value || undefined,
          when3: when3Value || undefined,

          area: areaValue,
          people,
          name: name,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          lang,
          source,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setStatus("success");
        afterStep();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    const slotList = [whenValue, when2Value, when3Value].filter(Boolean);
    const slotsText = slotList.join(lang === "es" ? " o " : " or ");
    const waText =
      lang === "es"
        ? `Hola, soy ${name}. Quiero reservar: ${baseWant}${isGroup ? ` para ${people} personas` : ""} en ${areaValue}. Me va bien ${slotsText}.`
        : `Hi, I'm ${name}. I'd like to book a ${baseWant} massage${isGroup ? ` for ${people} people` : ""} in ${areaValue}. I can do ${slotsText}.`;
    const waLink = `https://wa.me/34612474827?text=${encodeURIComponent(waText)}`;
    const fallbackContact = email.trim() || phone.trim();

    return (
      <div ref={rootRef}>
        <div className="text-center">
          <h2 className="font-display text-3xl text-foreground mt-4">{t.promiseTitle}</h2>
          <p className="text-base text-muted-foreground mt-3 leading-snug">{t.promiseBody}</p>
          <p className="mt-4 text-base font-semibold text-foreground">{t.successTitle}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{t.successSub}</p>
        </div>
        <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-soft space-y-3">
          {[
            [t.sumMassage, baseWant],
            ...(isGroup ? [[t.sumPeople, people]] : []),
            [t.sumWhen, slotList.join(" · ")],
            [t.sumWhere, areaValue],
            [t.name, name],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <span className="text-sm text-muted-foreground">{k}</span>
              <span className="text-base text-foreground font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("wizard_whatsapp_click", { meta: { source, lang } })}
          className="mt-6 w-full h-14 rounded-full bg-[#25D366] text-white text-base font-semibold shadow-soft hover:bg-[#128C7E] transition inline-flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5 fill-current" /> {t.sendWhatsApp}
        </a>
        {fallbackContact && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.noWhatsApp.replace("{contact}", fallbackContact)}
          </p>
        )}
        <DealsConfirmationLine className="mt-6" />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {showBrand && (
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">{t.brand}</p>
      )}

      {/* Progress */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {t.steps.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div
              key={label}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs whitespace-nowrap ${
                active
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : done
                    ? "bg-secondary text-foreground border-border"
                    : "bg-card text-muted-foreground border-border/70"
              }`}
            >
              <span className="font-bold">{n}</span>
              {label}
            </div>
          );
        })}
      </div>

      {step > 1 && (
        <button
          type="button"
          onClick={() => { setHint(null); setStep((s) => s - 1); }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="h-4 w-4" /> {t.back}
        </button>
      )}

      {step === 1 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s1Title}</h2>
          <div ref={massageRef} className="mt-4 grid gap-3 sm:grid-cols-2">
            {(t.massages.includes(massage as never) || !massage
              ? t.massages
              : [...t.massages, massage]
            ).map((m) => {
              const active = massage === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMassage(m); setHint(null); }}
                  aria-pressed={active}
                  className={`text-left rounded-2xl border p-4 text-base transition ${
                    active
                      ? "border-primary bg-secondary/60 shadow-soft font-semibold text-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Label htmlFor="specific" className="text-sm text-foreground">{t.specificLabel}</Label>
            <Input
              id="specific"
              value={specific}
              onChange={(e) => setSpecific(e.target.value)}
              placeholder={t.specificPh}
              className="mt-1.5 h-12 text-base"
            />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s2Title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.s2Helper}</p>

          {([
            [day, setDay, time, setTime],
            [day2, setDay2, time2, setTime2],
            [day3, setDay3, time3, setTime3],
          ] as const).slice(0, slots).map(([dVal, setD, tVal, setT], idx) => (
            <div key={idx} className={idx === 0 ? "" : "mt-8 pt-6 border-t border-border"}>
              {idx > 0 && (
                <p className="text-xs font-bold tracking-wider uppercase text-primary">{t.option} {idx + 1}</p>
              )}
              <div ref={idx === 0 ? dayRef : undefined} className="mt-4">
                <p className="text-sm text-muted-foreground">{t.dayLabel}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dayChips.map((d) => (
                    <Chip key={d} active={dVal === d} onClick={() => { setD(d); setHint(null); }}>{d}</Chip>
                  ))}
                </div>
              </div>

              <div ref={idx === 0 ? timeRef : undefined} className="mt-6">
                <p className="text-sm text-muted-foreground">{t.timeLabel}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {timeChips.map((x) => (
                    <Chip key={x} active={tVal === x} onClick={() => { setT(x); setHint(null); }}>{x}</Chip>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {slots < 3 && day && time && (
            <button
              type="button"
              onClick={() => setSlots((n) => Math.min(3, n + 1))}
              className="mt-6 text-base font-semibold text-primary underline underline-offset-4"
            >
              {t.addTime}
            </button>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s3Title}</h2>
          <div ref={areaRef} className="mt-4 space-y-3">
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="w-full h-12 rounded-xl border border-border bg-card text-foreground font-semibold inline-flex items-center justify-center gap-2 hover:border-primary/50 transition disabled:opacity-70"
            >
              {locating ? (
                <>
                  <span className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  {t.locating}
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-primary" /> {t.useLocation}
                </>
              )}
            </button>

            {locationDenied && (
              <p className="text-sm text-muted-foreground">{t.locationDenied}</p>
            )}

            <div>
              <Label htmlFor="area" className="text-sm text-foreground">{t.s3Label}</Label>
              <select
                id="area"
                value={area}
                onChange={(e) => { setArea(e.target.value); setHint(null); setLocationDenied(false); }}
                className="mt-1.5 w-full h-12 rounded-xl border border-border bg-card px-3 text-base text-foreground"
              >
                <option value="">{t.areaPlaceholder}</option>
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            {area === t.other && (
              <Input
                value={areaOther}
                onChange={(e) => setAreaOther(e.target.value)}
                placeholder={t.otherPh}
                className="h-12 text-base"
              />
            )}
            <p className="text-sm text-muted-foreground">{t.s3Helper}</p>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s4Title}</h2>
          <div className="mt-4 space-y-4">
            <div>
              {!peopleOpen ? (
                <button
                  type="button"
                  onClick={() => setPeopleOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.peopleLink}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {PEOPLE_OPTIONS.map((n) => {
                    const active = people === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPeople(n)}
                        className={`h-9 min-w-[2.5rem] px-3 rounded-lg border text-sm font-medium transition ${
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <p className="w-full mt-1 text-xs text-muted-foreground">{t.peopleHelp}</p>
                </div>
              )}
            </div>
            <div ref={nameRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bf-first-name" className="text-sm text-foreground">{t.firstName}</Label>
                <Input id="bf-first-name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1.5 h-12 text-base" />
              </div>
              <div>
                <Label htmlFor="bf-last-name" className="text-sm text-foreground">{t.lastName}</Label>
                <Input id="bf-last-name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1.5 h-12 text-base" />
              </div>
            </div>
            <div ref={contactRef} className="space-y-4">
              <div>
                <Label htmlFor="bf-phone" className="text-sm text-foreground">{t.whatsapp}</Label>
                <Input
                  id="bf-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+34 600 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={contact.phoneValid === false}
                  className={`mt-1.5 h-12 text-base ${contact.phoneValid === false ? "border-2 border-destructive" : ""}`}
                />
                {contact.phoneValid === false && (
                  <p className="mt-1.5 text-sm text-destructive">{cc.badPhone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="bf-email" className="text-sm text-foreground">{t.email}</Label>
                <Input
                  id="bf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={contact.emailValid === false}
                  className={`mt-1.5 h-12 text-base ${contact.emailValid === false ? "border-2 border-destructive" : ""}`}
                />
                {contact.emailValid === false && (
                  <p className="mt-1.5 text-sm text-destructive">{cc.badEmail}</p>
                )}
              </div>
            </div>

          </div>
        </section>
      )}

      {hint && <p role="alert" className="mt-4 text-sm text-destructive">{hint}</p>}
      {status === "error" && (
        <p role="alert" className="mt-3 text-sm text-destructive">{t.sendError}</p>
      )}

      {step === 4 && <p className="mt-6 text-xs text-muted-foreground">{t.consent}</p>}

      <div className="mt-4">
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            className="w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition inline-flex items-center justify-center gap-2"
          >
            {t.continue} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={submit}
              disabled={status === "loading" || !canSubmit}
              className="w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? t.sending : t.submit}
            </button>
            {!canSubmit && (
              <p className="mt-2 text-center text-sm text-muted-foreground">{cc.needContact}</p>
            )}
          </>
        )}

      </div>

      {step >= 2 && (
        <ExitCaptureBlock
          source="wizard-exit"
          want={massage || null}
          area={area ? (area === t.other ? areaOther || null : area) : null}
          className="mt-8"
        />
      )}
    </div>
  );
}
