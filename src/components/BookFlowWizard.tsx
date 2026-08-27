import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { trackEvent } from "@/lib/siteVisit";
import { MADRID_AREAS } from "@/lib/locationConsent";
import { haversineKm } from "@/lib/nearestStudios";

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
      "Not sure - my back/neck hurts",
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
    name: "Name",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "We need your name.",
    missContact: "Add a WhatsApp number or an email so we can reply.",
    consent: "By booking you agree we can contact you about this request.",
    submit: "Request my massage",
    sending: "Sending...",
    sendError: "Could not send. Message us on WhatsApp at +34 612 474 827.",
    successTitle: "Request received!",
    successSub:
      "We're confirming your time with the studio. You'll hear from us on WhatsApp shortly - usually within the hour, always the same day.",
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
      "No lo sé - me duele la espalda/el cuello",
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
    name: "Nombre",
    whatsapp: "WhatsApp",
    email: "Email",
    missName: "Necesitamos tu nombre.",
    missContact: "Añade un WhatsApp o un email para poder responderte.",
    consent: "Al reservar aceptas que te contactemos sobre esta solicitud.",
    submit: "Pedir mi masaje",
    sending: "Enviando...",
    sendError: "No se pudo enviar. Escríbenos por WhatsApp al +34 612 474 827.",
    successTitle: "¡Solicitud recibida!",
    successSub:
      "Estamos confirmando tu hora con el centro. Te escribimos por WhatsApp en breve - normalmente en menos de una hora, siempre el mismo día.",
    sumMassage: "Masaje",
    sumWhen: "Cuándo",
    sumWhere: "Dónde",
    seoTitle: "Reserva un masaje en Madrid | Massage Club",
    seoDesc:
      "Dinos qué masaje quieres, cuándo y dónde. Confirmamos la hora con el centro y te escribimos el mismo día.",
    weekdays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  },
} as const;

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
  const t = BOOK_FLOW_COPY[lang];

  const [step, setStep] = useState(1);
  const [massage, setMassage] = useState("");
  const [specific, setSpecific] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [day2, setDay2] = useState("");
  const [time2, setTime2] = useState("");
  const [day3, setDay3] = useState("");
  const [time3, setTime3] = useState("");
  const [slots, setSlots] = useState(1);
  const [area, setArea] = useState("");
  const [areaOther, setAreaOther] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const rootRef = useRef<HTMLDivElement>(null);
  const massageRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const dayChips = useMemo(() => {
    const out: string[] = [t.today, t.tomorrow];
    const now = new Date();
    for (let i = 2; i <= 6; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      out.push(`${t.weekdays[d.getDay()]} ${d.getDate()}`);
    }
    out.push(t.flexible);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (!preselect) return;
    setMassage(preselect.value);
    setStep(1);
    setHint(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect?.nonce]);

  const timeChips = [t.morning, t.afternoon, t.evening, t.flexible];
  const areas = [...AREAS_BASE, t.other];

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
  const wantValue = specific.trim() ? `${massage} + ${specific.trim()}` : massage;
  const whenValue = `${day} ${time}`.trim();
  const when2Value = `${day2} ${time2}`.trim();
  const when3Value = `${day3} ${time3}`.trim();

  const submit = async () => {
    setHint(null);
    if (!name.trim()) return fail(t.missName, nameRef);
    if (!phone.trim() && !email.trim()) return fail(t.missContact, contactRef);

    setStatus("loading");
    try {
      const res = await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          want: wantValue,
          when: whenValue,
          when2: when2Value || undefined,
          when3: when3Value || undefined,
          area: areaValue,
          name: name.trim(),
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
    return (
      <div ref={rootRef}>
        <div className="text-center">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h2 className="font-display text-3xl text-foreground mt-4">{t.successTitle}</h2>
          <p className="text-base text-muted-foreground mt-3 leading-snug">{t.successSub}</p>
        </div>
        <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-soft space-y-3">
          {[
            [t.sumMassage, wantValue],
            [t.sumWhen, [whenValue, when2Value, when3Value].filter(Boolean).join(" · ")],
            [t.sumWhere, areaValue],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <span className="text-sm text-muted-foreground">{k}</span>
              <span className="text-base text-foreground font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
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
          <div ref={areaRef} className="mt-4">
            <Label htmlFor="area" className="text-sm text-foreground">{t.s3Label}</Label>
            <select
              id="area"
              value={area}
              onChange={(e) => { setArea(e.target.value); setHint(null); }}
              className="mt-1.5 w-full h-12 rounded-xl border border-border bg-card px-3 text-base text-foreground"
            >
              <option value="">{t.areaPlaceholder}</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {area === t.other && (
              <Input
                value={areaOther}
                onChange={(e) => setAreaOther(e.target.value)}
                placeholder={t.otherPh}
                className="mt-3 h-12 text-base"
              />
            )}
            <p className="mt-2 text-sm text-muted-foreground">{t.s3Helper}</p>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-5">
          <h2 className="font-display text-2xl md:text-3xl text-foreground">{t.s4Title}</h2>
          <div className="mt-4 space-y-4">
            <div ref={nameRef}>
              <Label htmlFor="bf-name" className="text-sm text-foreground">{t.name}</Label>
              <Input id="bf-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12 text-base" />
            </div>
            <div ref={contactRef} className="space-y-4">
              <div>
                <Label htmlFor="bf-phone" className="text-sm text-foreground">{t.whatsapp}</Label>
                <Input id="bf-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-12 text-base" />
              </div>
              <div>
                <Label htmlFor="bf-email" className="text-sm text-foreground">{t.email}</Label>
                <Input id="bf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12 text-base" />
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
          <button
            type="button"
            onClick={submit}
            disabled={status === "loading"}
            className="w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-70"
          >
            {status === "loading" ? t.sending : t.submit}
          </button>
        )}
      </div>
    </div>
  );
}
