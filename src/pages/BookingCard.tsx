import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

/**
 * Massage Club "booking card" opened from a WhatsApp link: /r/:token
 * Standalone, phone-width, no site chrome. Talks only to the card-api
 * edge function with plain fetch (no Supabase JS client).
 */

const API = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/card-api";
const WA = "https://wa.me/34613977900";

type Phase = "idle" | "queued" | "asking" | "offered" | "booked";

type CardRequest = {
  id: string;
  stage?: string | null;
  service?: string | null;
  day?: string | null;
  time?: string | null;
  band?: string | null;
  area?: string | null;
  studio?: string | null;
  price?: number | null;
  confirmed_day?: string | null;
  confirmed_time?: string | null;
  client_confirmed_at?: string | null;
  studios_asked?: number | null;
  created_at?: string | null;
};

type CardStudio = {
  partner_id: string;
  rank?: number | null;
  outcome: "pending" | "yes" | "no" | "won" | "stood_down" | "send_failed";
  name?: string | null;
  area?: string | null;
  rating?: number | null;
  reviews?: number | null;
  asked_at?: string | null;
  replied_at?: string | null;
  replied?: boolean;
};

type CardState = {
  ok: true;
  phone_masked?: string | null;
  lang?: "en" | "es";
  phase: Phase;
  request: CardRequest | null;
  studios: CardStudio[];
};

type CardError = { ok: false; error: string };

const C = {
  page: "#262019",
  card: "transparent",
  panel: "rgba(243,236,226,0.08)",
  ink: "#F3ECE2",
  onCream: "#262019",
  muted: "#B8AC9E",
  faint: "#8A7F73",
  line: "rgba(243,236,226,0.14)",
  clay: "#D08A62",
  green: "#8BD3A5",
  greenBg: "rgba(111,196,143,0.14)",
  greenLine: "rgba(111,196,143,0.35)",
};

const display = { fontFamily: "'Fraunces', 'EB Garamond', Georgia, serif", letterSpacing: "-0.02em" } as const;


/* ---------------------------------------------------------------- copy */

const COPY = {
  en: {
    brand: "MASSAGE CLUB",
    bookingFor: (p: string) => `Booking for ${p}`,
    title: "Book a massage in Madrid",
    sub: "Three taps. We ask the studios for you and come back with a confirmed time.",
    which: "WHICH MASSAGE",
    when: "WHEN",
    where: "WHERE",
    whichQuestion: "Which massage?",
    whenQuestion: "When?",
    whereQuestion: "Where in Madrid?",
    readyQuestion: "Ready to ask?",
    stepOf: (n: number) => `${n} of 3`,
    continue: "Continue",
    dayGroup: "Day",
    timeGroup: "Time",
    summaryMassage: "Massage",
    summaryWhen: "When",
    summaryWhere: "Where",
    backAria: "Back",
    cta: "Ask the studios",
    fine: "You pay the studio directly. No booking fee. Your time is only booked once a studio confirms it, and we tell you here and on WhatsApp.",
    asking: (n: number, area: string) => `Asking ${n} studios in ${area}`,
    liningUp: (area: string) => `Lining up studios in ${area}`,
    askingSub: "First to confirm your time gets the booking. This usually takes minutes during opening hours.",
    change: "Change",
    railLeft: "Studios asked",
    railRight: (r: number, t: number) => `${r} of ${t} replied`,
    pillAsked: "Asked",
    pillReplied: "Replied",
    pillConfirmed: "Confirmed",
    pillStood: "Stood down",
    offerTitle: (s: string) => `${s} can do it`,
    offerSub: "Take it, or ask for a different time. The other studios stand down the moment you accept.",
    offerEyebrow: "CONFIRMED BY THE STUDIO",
    paidAt: "paid at the studio",
    take: (t: string) => `Take ${t}`,
    another: "Another time",
    askedOther: "We have asked for other times. You will hear back here and on WhatsApp.",
    bookedTitle: "Booked",
    bookedLine: "You are booked.",
    bookedAddr: "Address and directions are in your WhatsApp. Reply there if anything changes.",
    whatsappNote: "Every update here also lands in your WhatsApp, so you can close this and carry on.",
    startAnother: "Start another booking",
    expired: "This link has expired. Message us on WhatsApp and we will send you a fresh one.",
    waBtn: "Message us on WhatsApp",
    at: "at",
    services: { relax: "Relaxing", deep: "Deep tissue", thai: "Thai", sports: "Sports", stone: "Hot stone", unsure: "Not sure yet" },
    days: { today: "Today", tomorrow: "Tomorrow", week: "This week", flexible: "Flexible" },
    times: { morning: "Morning 10-13", afternoon: "Afternoon 13-18", evening: "Evening 18-21" },
    timesShort: { morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
  },
  es: {
    brand: "MASSAGE CLUB",
    bookingFor: (p: string) => `Reserva para ${p}`,
    title: "Reservar un masaje en Madrid",
    sub: "Tres toques. Preguntamos a los centros por ti y volvemos con una hora confirmada.",
    which: "QUÉ MASAJE",
    when: "CUÁNDO",
    where: "DÓNDE",
    whichQuestion: "¿Qué masaje?",
    whenQuestion: "¿Cuándo?",
    whereQuestion: "¿En qué zona de Madrid?",
    readyQuestion: "¿Preguntamos?",
    stepOf: (n: number) => `${n} de 3`,
    continue: "Seguir",
    dayGroup: "Día",
    timeGroup: "Hora",
    summaryMassage: "Masaje",
    summaryWhen: "Cuándo",
    summaryWhere: "Zona",
    backAria: "Atrás",
    cta: "Preguntar a los centros",
    fine: "Pagas directamente en el centro. Sin comisión. Tu hora solo queda reservada cuando un centro la confirma, y te lo decimos aquí y por WhatsApp.",
    asking: (n: number, area: string) => `Preguntando a ${n} centros en ${area}`,
    liningUp: (area: string) => `Buscando centros en ${area}`,
    askingSub: "El primero que confirme tu hora se queda la reserva. Suele tardar minutos en horario de apertura.",
    change: "Cambiar",
    railLeft: "Centros preguntados",
    railRight: (r: number, t: number) => `${r} de ${t} han respondido`,
    pillAsked: "Preguntado",
    pillReplied: "Ha respondido",
    pillConfirmed: "Confirmado",
    pillStood: "Se retira",
    offerTitle: (s: string) => `${s} puede`,
    offerSub: "Tómalo o pide otra hora. Los demás centros se retiran en cuanto aceptas.",
    offerEyebrow: "CONFIRMADO POR EL CENTRO",
    paidAt: "se paga en el centro",
    take: (t: string) => `Tomar ${t}`,
    another: "Otra hora",
    askedOther: "Hemos pedido otras horas. Te avisamos aquí y por WhatsApp.",
    bookedTitle: "Reservado",
    bookedLine: "Tu reserva está hecha.",
    bookedAddr: "La dirección y cómo llegar están en tu WhatsApp. Responde ahí si algo cambia.",
    whatsappNote: "Cada novedad aquí también llega a tu WhatsApp, así que puedes cerrar esto y seguir con tu día.",
    startAnother: "Empezar otra reserva",
    expired: "Este enlace ha caducado. Escríbenos por WhatsApp y te enviamos uno nuevo.",
    waBtn: "Escríbenos por WhatsApp",
    at: "a las",
    services: { relax: "Relajante", deep: "Descontracturante", thai: "Tailandés", sports: "Deportivo", stone: "Piedras calientes", unsure: "Aún no lo sé" },
    days: { today: "Hoy", tomorrow: "Mañana", week: "Esta semana", flexible: "Flexible" },
    times: { morning: "Mañana 10-13", afternoon: "Tarde 13-18", evening: "Noche 18-21" },
    timesShort: { morning: "Mañana", afternoon: "Tarde", evening: "Noche" },
  },
};

type Copy = typeof COPY.en;
type Lang = keyof typeof COPY;

const SVCS = ["relax", "deep", "thai", "sports", "stone", "unsure"] as const;
const DAYS = ["today", "tomorrow", "week"] as const;
const BANDS = ["morning", "afternoon", "evening"] as const;
const AREAS_EN = ["Centro / Sol", "Chamberí", "Salamanca", "Retiro", "Malasaña / Chueca", "Anywhere"];
const AREAS_ES = ["Centro / Sol", "Chamberí", "Salamanca", "Retiro", "Malasaña / Chueca", "Cualquier zona"];

/* ------------------------------------------------------------ elements */

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        padding: "9px 14px",
        borderRadius: 999,
        fontSize: 14,
        lineHeight: 1.2,
        cursor: "pointer",
        border: `1px solid ${selected ? C.ink : C.line}`,
        background: selected ? C.ink : "transparent",
        color: selected ? C.onCream : C.ink,
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function TopStrip({ phone, t }: { phone: string; t: Copy }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 11,
        color: C.muted,
        letterSpacing: "0.14em",
        padding: "16px 4px 18px",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.ink }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: C.ink, flex: "0 0 auto" }} />
        {t.brand}
      </span>
      {phone ? <span style={{ letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums" }}>{t.bookingFor(phone)}</span> : null}
    </div>
  );
}

function WhatsAppNote({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        border: "1px dashed rgba(243,236,226,0.25)",
        borderRadius: 14,
        padding: "12px 14px",
        marginTop: 18,
        color: C.muted,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: C.green, marginTop: 6, flex: "0 0 auto" }} />
      <span>{text}</span>
    </div>
  );
}

function OptionButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        width: "100%",
        minHeight: 60,
        padding: "14px 16px",
        borderRadius: 16,
        fontSize: 19,
        lineHeight: 1.25,
        textAlign: "left",
        cursor: "pointer",
        border: `1px solid ${C.line}`,
        background: selected ? C.ink : "transparent",
        color: selected ? C.onCream : C.ink,
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

function StepIndicator({ step, t }: { step: number; t: Copy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{t.stepOf(step)}</span>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: n === step ? C.ink : "rgba(243,236,226,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: C.ink,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}


/* --------------------------------------------------------------- page */

export default function BookingCard() {
  const { token = "" } = useParams();
  const [state, setState] = useState<CardState | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forceCard, setForceCard] = useState(false);
  const [step, setStep] = useState(1);

  const [svc, setSvc] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);

  const lang: Lang = state?.lang === "es" ? "es" : "en";
  const t = COPY[lang];
  const areas = lang === "es" ? AREAS_ES : AREAS_EN;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}?t=${encodeURIComponent(token)}`);
      const json = (await res.json()) as CardState | CardError;
      if (!json || (json as CardError).ok === false) {
        setInvalid(true);
      } else {
        setInvalid(false);
        setState(json as CardState);
      }
    } catch {
      /* keep last good state; a transient network blip should not blank the page */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const phase: Phase = forceCard ? "idle" : state?.phase ?? "idle";
  const prevPhaseRef = useRef<Phase>(phase);

  // Poll every 8s while waiting, pause when the tab is hidden.
  const polling = phase === "queued" || phase === "asking";
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!polling) return;
    let id: number | undefined;
    const start = () => {
      if (id === undefined) id = window.setInterval(() => void loadRef.current(), 8000);
    };
    const stop = () => {
      if (id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    const onVis = () => (document.hidden ? stop() : (void loadRef.current(), start()));
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [polling]);

  // When the card becomes idle, pick a sensible starting step based on what is already filled.
  useEffect(() => {
    if (phase !== prevPhaseRef.current && phase === "idle") {
      setStep(svc && day && band && area ? 4 : svc && day && band ? 3 : svc ? 2 : 1);
    }
    prevPhaseRef.current = phase;
  }, [phase, svc, day, band, area]);


  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: token, ...body }),
        });
        const json = (await res.json()) as CardState | CardError;
        if (json && (json as CardError).ok === false) {
          setInvalid(true);
          return null;
        }
        setState(json as CardState);
        setForceCard(false);
        return json as CardState;
      } catch {
        return null;
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const req = state?.request ?? null;
  const studios = state?.studios ?? [];
  const replied = studios.filter((s) => s.replied || s.outcome === "won" || s.outcome === "yes" || s.outcome === "no").length;
  const total = studios.length;

  const serviceLabel = useMemo(() => {
    const key = (req?.service || svc || "") as keyof typeof t.services;
    return t.services[key] ?? (req?.service || "");
  }, [req?.service, svc, t]);

  const dayLabel = useMemo(() => {
    const key = (req?.day || day || "") as keyof typeof t.days;
    return t.days[key] ?? (req?.day || "");
  }, [req?.day, day, t]);

  const timeLabel = useMemo(() => {
    const key = (req?.band || req?.time || band || "") as keyof typeof t.timesShort;
    return t.timesShort[key] ?? (req?.time || "");
  }, [req?.band, req?.time, band, t]);

  const areaLabel = req?.area || area || (lang === "es" ? "Madrid" : "Madrid");

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: C.page, color: C.ink, fontFamily: "'Outfit', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <Helmet>
        <meta name="robots" content="noindex" />
        <title>Massage Club booking</title>
      </Helmet>
      <style>{`
        .mc-card :focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .mc-card * { transition: none !important; animation: none !important; } }
      `}</style>
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 720, height: 720, borderRadius: "50%", background: "#B85C38", opacity: 0.5, top: -300, left: -260, filter: "blur(2px)" }} />
        <div style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", background: "#8A4A2E", opacity: 0.55, bottom: -220, right: -200, filter: "blur(2px)" }} />
        <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "#D08A62", opacity: 0.55, top: 90, right: -60, filter: "blur(2px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "6px 6px", mixBlendMode: "overlay" }} />
      </div>
      <div className="mc-card" style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px 40px", position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );

  const cardBox: React.CSSProperties = {
    padding: "4px 0",
  };


  if (invalid) {
    return shell(
      <>
        <TopStrip phone="" t={t} />
        <div style={{ ...cardBox, marginTop: 40, textAlign: "center" }}>
          <h1 style={{ ...display, fontWeight: 500, fontSize: 28, lineHeight: 1.15, margin: "8px 0 18px" }}>{t.expired}</h1>
          <a
            href={WA}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              background: C.ink,
              color: C.onCream,
              borderRadius: 999,
              padding: "14px 16px",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {t.waBtn}
          </a>
        </div>
      </>,
    );
  }

  if (loading && !state) {
    return shell(
      <>
        <TopStrip phone="" t={t} />
        <div style={{ ...cardBox, marginTop: 24, color: C.muted, fontSize: 14 }}>...</div>
      </>,
    );
  }

  const phone = state?.phone_masked || "";

  /* ------------------------------------------------------------- idle */
  if (phase === "idle") {
    return shell(
      <>
        <TopStrip phone={phone} t={t} />
        <div style={cardBox}>idle</div>
      </>,
    );
  }

  /* ---------------------------------------------------------- booked */
  if (phase === "booked") {
    const d = req?.confirmed_day || dayLabel;
    const tm = req?.confirmed_time || timeLabel;
    return shell(
      <>
        <TopStrip phone={phone} t={t} />
        <div style={cardBox}>
          <h1 style={{ ...display, fontWeight: 500, fontSize: 40, lineHeight: 1.02, margin: "2px 0 18px" }}>{t.bookedTitle}</h1>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, fontSize: 15, lineHeight: 1.6 }}>
            <div style={{ ...display, fontSize: 18 }}>{t.bookedLine}</div>
            <div style={{ fontVariantNumeric: "tabular-nums" }}>
              {req?.studio ? `${req.studio}, ` : ""}
              {d} {t.at} {tm}.
            </div>
            <div style={{ color: C.muted }}>
              {serviceLabel}
              {req?.price != null ? `. ${req.price} EUR, ${t.paidAt}` : ""}.
            </div>
            <div style={{ color: C.muted, marginTop: 10 }}>{t.bookedAddr}</div>
          </div>
          <WhatsAppNote text={t.whatsappNote} />
          <button
            type="button"
            onClick={() => {
              setSvc(null);
              setDay(null);
              setBand(null);
              setArea(null);
              setStep(1);
              setForceCard(true);
            }}
            style={{
              width: "100%",
              marginTop: 14,
              borderRadius: 999,
              padding: "14px 16px",
              fontSize: 15,
              background: "transparent",
              color: C.ink,
              border: `1px solid ${C.line}`,
              cursor: "pointer",
            }}
          >
            {t.startAnother}
          </button>
        </div>
      </>,
    );
  }

  /* ------------------------------------------- queued / asking / offered */
  const asked = req?.studios_asked ?? total;
  const offered = phase === "offered";
  const headline = offered
    ? t.offerTitle(req?.studio || "")
    : asked > 0
      ? t.asking(asked, areaLabel)
      : t.liningUp(areaLabel);

  const pct = total > 0 ? Math.round((replied / total) * 100) : 0;

  return shell(
    <>
      <TopStrip phone={phone} t={t} />
      <div style={cardBox}>
        <h1 style={{ ...display, fontWeight: 500, fontSize: 40, lineHeight: 1.02, margin: "2px 0 12px" }}>{headline}</h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>{offered ? t.offerSub : t.askingSub}</p>

        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ ...display, fontSize: 18 }}>{serviceLabel}</div>
              <div style={{ color: C.muted, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {dayLabel}, {timeLabel}
              </div>
            </div>
            {phase === "queued" ? (
              <button
                type="button"
                onClick={() => setForceCard(true)}
                style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 999, color: C.ink, fontSize: 13, cursor: "pointer", padding: "6px 12px" }}
              >
                {t.change}
              </button>
            ) : null}
          </div>
        </div>

        {offered ? (
          <div style={{ background: C.greenBg, border: `1px solid ${C.greenLine}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: C.green, marginBottom: 6 }}>{t.offerEyebrow}</div>
            <div style={{ ...display, fontSize: 22, lineHeight: 1.25 }}>{req?.studio}</div>
            <div style={{ fontSize: 14, color: C.ink, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              {(req?.confirmed_day || dayLabel)} {t.at} {(req?.confirmed_time || timeLabel)}
              {req?.price != null ? ` · ${req.price} EUR, ${t.paidAt}` : ""}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void post({ action: "accept", request_id: req?.id })}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  padding: "13px 12px",
                  fontSize: 15,
                  fontWeight: 600,
                  border: "none",
                  background: C.ink,
                  color: C.onCream,
                  cursor: "pointer",
                }}
              >
                {t.take(req?.confirmed_time || timeLabel)}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const r = await post({ action: "other_time", request_id: req?.id });
                  if (r) setOtherNote(true);
                }}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  padding: "13px 12px",
                  fontSize: 15,
                  background: "transparent",
                  color: C.ink,
                  border: `1px solid ${C.line}`,
                  cursor: "pointer",
                }}
              >
                {t.another}
              </button>
            </div>
            {otherNote ? <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>{t.askedOther}</div> : null}
          </div>
        ) : null}

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 6 }}>
            <span>{t.railLeft}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{t.railRight(replied, total)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: C.line, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: C.clay, transition: "width 300ms ease" }} />
          </div>
        </div>

        <div>
          {studios.map((s) => {
            const stood = s.outcome === "stood_down";
            const won = s.outcome === "won";
            const hasReplied = Boolean(s.replied) && s.outcome === "pending";
            const pill = won
              ? { label: t.pillConfirmed, bg: C.greenBg, color: C.green, border: "1px solid transparent" }
              : stood
                ? { label: t.pillStood, bg: "transparent", color: C.faint, border: "1px solid transparent" }
                : hasReplied
                  ? { label: t.pillReplied, bg: "rgba(208,138,98,0.22)", color: C.ink, border: "1px solid transparent" }
                  : { label: t.pillAsked, bg: "transparent", color: C.muted, border: `1px solid ${C.line}` };
            return (
              <div
                key={s.partner_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderTop: `1px solid ${C.line}`,
                  opacity: stood ? 0.45 : 1,
                  textDecoration: stood ? "line-through" : "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...display, fontSize: 16 }}>{s.name || "Studio"}</div>
                  {s.area || s.rating != null ? (
                    <div style={{ color: C.muted, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      {[s.area, s.rating != null ? `${s.rating}${s.reviews != null ? ` (${s.reviews} reviews)` : ""}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  ) : null}
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    fontSize: 12,
                    borderRadius: 999,
                    padding: "5px 10px",
                    background: pill.bg,
                    color: pill.color,
                    border: pill.border,
                  }}
                >
                  {pill.label}
                </span>
              </div>
            );
          })}
        </div>

        <WhatsAppNote text={t.whatsappNote} />
      </div>
    </>,
  );
}
