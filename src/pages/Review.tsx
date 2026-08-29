import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";

import {
  COMPLIMENT_TAGS, ISSUE_TAGS, reviewTagLabel, suggestDisplayName, type Lang,
} from "@/lib/reviews";

const FN_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/review";
const BOOK_AGAIN_WA = "https://wa.me/34613977900?text=Hi";

const LAST_STEP = 8;

type Pressure = "too_soft" | "perfect" | "too_strong";

function sanitize(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 300);
}

type FetchResp = {
  studio?: string;
  slug?: string;
  service?: string;
  date?: string;
  time?: string;
  name?: string;
  lang?: string;
  status?: string;
  cancelled?: boolean;
  review?: {
    rating?: number;
    would_return?: boolean | null;
    pressure_feedback?: Pressure | null;
    cleanliness?: number | null;
    ambience?: number | null;
    comment?: string | null;
    tags?: string[] | null;
    private_note?: string | null;
    display_name?: string | null;
    custom_tag?: string | null;
  } | null;
};

const COPY = {
  en: {
    loading: "Loading…",
    invalid: "Invalid link",
    invalidSub: "We could not find that booking.",
    cancelled: "This booking was cancelled",
    back: "Back",
    skip: "Skip",
    continue: "Continue",
    finish: "Finish",
    sending: "Saving…",
    error: "Could not save. Please try again.",
    s1: (what: string, where: string) => (what ? `How was your ${what} at ${where}?` : `How was your massage at ${where}?`),
    s1sub: "Tap a star",
    s2: "How was the pressure?",
    s2sub: "Only you and Massage Club see how you answer this.",
    tooSoft: "Too soft",
    justRight: "Just right",
    tooFirm: "Too firm",
    s3: "How clean was the studio?",
    s4: "How was the atmosphere?",
    starsSub: "Tap a star",
    s5good: "What stood out?",
    s5bad: "What could have been better?",
    s5sub: "Tap any that apply",
    other: "Other",
    otherPh: "Tell us in a word or two",

    s6: "Share your experience",
    s6sub: "This appears on the studio's page.",
    s6ph: "What would you tell a friend about this massage?",
    nameLabel: "Shown as",
    namePh: "Massage Club client",
    s7: "Anything just for us?",
    s7sub: "Just for Massage Club. The studio never sees this.",
    s7ph: "Anything you would rather not say publicly",
    s8: (studio: string) => `Would you go back to ${studio}?`,
    yes: "Yes",
    no: "No",
    thanksTitle: "Thank you",
    thanksBody: "Thanks, your review helps other people find great massages.",
    bookNext: "Book your next massage",
    browse: "Browse studios",
  },
  es: {
    loading: "Cargando…",
    invalid: "Enlace no válido",
    invalidSub: "No encontramos esa reserva.",
    cancelled: "Esta reserva fue cancelada",
    back: "Atrás",
    skip: "Saltar",
    continue: "Continuar",
    finish: "Terminar",
    sending: "Guardando…",
    error: "No se pudo guardar. Inténtalo de nuevo.",
    s1: (what: string, where: string) => (what ? `¿Qué tal tu ${what} en ${where}?` : `¿Qué tal tu masaje en ${where}?`),
    s1sub: "Toca una estrella",
    s2: "¿Qué tal la presión?",
    s2sub: "Esto solo lo vemos tú y Massage Club.",
    tooSoft: "Muy suave",
    justRight: "Perfecta",
    tooFirm: "Muy fuerte",
    s3: "¿Qué tal la limpieza?",
    s4: "¿Qué tal el ambiente?",
    starsSub: "Toca una estrella",
    s5good: "¿Qué destacarías?",
    s5bad: "¿Qué se podría mejorar?",
    s5sub: "Toca lo que aplique",
    other: "Otro",
    otherPh: "Cuéntanoslo en pocas palabras",

    s6: "Cuenta tu experiencia",
    s6sub: "Se muestra en la página del estudio.",
    s6ph: "¿Qué le contarías a un amigo sobre este masaje?",
    nameLabel: "Se muestra como",
    namePh: "Cliente de Massage Club",
    s7: "¿Algo solo para nosotros?",
    s7sub: "Solo para Massage Club. El estudio nunca lo ve.",
    s7ph: "Algo que prefieras no decir en público",
    s8: (studio: string) => `¿Volverías a ${studio}?`,
    yes: "Sí",
    no: "No",
    thanksTitle: "Gracias",
    thanksBody: "Gracias, tu opinión ayuda a otras personas a encontrar buenos masajes.",
    bookNext: "Reserva tu próximo masaje",
    browse: "Ver estudios",
  },
} as const;

/** Big tappable star row. */
function StarRow({
  value, onPick,
}: { value: number; onPick: (n: number) => void }) {
  return (
    <div className="flex justify-center gap-1 min-[420px]:gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          aria-label={`${n} / 5`}
          className="px-0.5 leading-none transition-transform active:scale-90"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "clamp(2.6rem, 13vw, 3.6rem)",
            color: n <= value ? "#B85C38" : "#DFD3C3",
          }}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

export default function Review() {
  const params = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );
  const token = sanitize(params.get("token"));
  const preR = Number(params.get("r"));
  const preselectedR = preR >= 1 && preR <= 5 ? Math.floor(preR) : 0;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FetchResp | null>(null);
  const [fatal, setFatal] = useState<"invalid" | "cancelled" | null>(null);
  const [lang, setLang] = useState<Lang>("en");

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<1 | -1>(1);
  const [rating, setRating] = useState(preselectedR);
  const [pressure, setPressure] = useState<Pressure | "">("");
  const [cleanliness, setCleanliness] = useState(0);
  const [ambience, setAmbience] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [otherOn, setOtherOn] = useState(false);
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);

  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [done, setDone] = useState(false);
  const jumped = useRef(false);

  const t = COPY[lang];

  useEffect(() => {
    if (!token) { setFatal("invalid"); setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        if (!r.ok) { setFatal("invalid"); setLoading(false); return; }
        const j: FetchResp = await r.json();
        setData(j);
        setLang(String(j.lang || "").slice(0, 2).toLowerCase() === "es" ? "es" : "en");
        if (j.cancelled) { setFatal("cancelled"); setLoading(false); return; }
        setDisplayName(suggestDisplayName(j.name));
        const rev = j.review;
        if (rev) {
          if (rev.rating) setRating(rev.rating);
          if (rev.pressure_feedback) setPressure(rev.pressure_feedback);
          if (rev.cleanliness) setCleanliness(Number(rev.cleanliness));
          if (rev.ambience) setAmbience(Number(rev.ambience));
          if (Array.isArray(rev.tags)) setTags(rev.tags.filter(Boolean));
          if (rev.custom_tag) { setCustomTag(String(rev.custom_tag)); setOtherOn(true); }
          if (rev.comment) setComment(rev.comment);
          if (rev.private_note) setPrivateNote(rev.private_note);
          if (rev.display_name) setDisplayName(rev.display_name);
          if (typeof rev.would_return === "boolean") setWouldReturn(rev.would_return);
        }
      } catch {
        setFatal("invalid");
      }
      setLoading(false);
    })();
  }, [token]);

  /** Persist everything we know so far. Fire and forget unless it is the final save. */
  const save = async (patch: Record<string, unknown> = {}, final = false) => {
    const score = rating || Number(patch.rating) || 0;
    if (score < 1) return true;
    const body = {
      token,
      rating,
      pressure_feedback: pressure || null,
      cleanliness: cleanliness || null,
      ambience: ambience || null,
      tags,
      custom_tag: customTag.trim() || null,
      comment: comment.trim() || null,
      display_name: displayName.trim() || null,
      private_note: privateNote.trim() || null,
      would_return: wouldReturn,
      lang,
      ...patch,
    };
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 404) { setFatal("invalid"); return false; }
      if (r.status === 409) { setFatal("cancelled"); return false; }
      if (!r.ok) { if (final) setErrMsg(t.error); return false; }
      return true;
    } catch {
      if (final) setErrMsg(t.error);
      return false;
    }
  };

  const goNext = (patch: Record<string, unknown> = {}) => {
    setErrMsg("");
    setDir(1);
    void save(patch);                     // incremental, non-blocking
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const goBack = () => { setErrMsg(""); setDir(-1); setStep((s) => Math.max(1, s - 1)); };

  const finish = async (patch: Record<string, unknown> = {}) => {
    setSaving(true);
    setErrMsg("");
    const ok = await save(patch, true);
    setSaving(false);
    if (ok) setDone(true);
  };

  // Email deep link with &r= skips the first screen.
  useEffect(() => {
    if (!loading && !fatal && preselectedR && !jumped.current) {
      jumped.current = true;
      setStep(2);
      void save({ rating: preselectedR });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, fatal, preselectedR]);

  const pickStars = (n: number, set: (v: number) => void, field?: string) => {
    set(n);
    window.setTimeout(() => {
      if (step === LAST_STEP) return;
      goNext(field ? { [field]: n } : {});
    }, 240);
  };

  const toggleTag = (key: string) =>
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const studio = sanitize(data?.studio) || "—";
  const service = sanitize(data?.service);
  const chipKeys: readonly string[] = rating >= 4 ? COMPLIMENT_TAGS : ISSUE_TAGS;
  const privateScreen = step === 7;

  /* ── Shells ─────────────────────────────────────────────── */

  const Centered = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-[100dvh] bg-[#FAF6F0] flex items-center justify-center px-6 text-center">
      <div className="max-w-sm">{children}</div>
    </div>
  );

  if (loading) {
    return <Centered><p className="text-[#8A7460]">{t.loading}</p></Centered>;
  }
  if (fatal === "invalid") {
    return (
      <Centered>
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="font-display text-2xl font-bold text-[#3D2B1F]">{t.invalid}</h1>
        <p className="mt-1 text-sm text-[#8A7460]">{t.invalidSub}</p>
      </Centered>
    );
  }
  if (fatal === "cancelled") {
    return (
      <Centered>
        <div className="text-5xl mb-3">🗓️</div>
        <h1 className="font-display text-2xl font-bold text-[#3D2B1F]">{t.cancelled}</h1>
      </Centered>
    );
  }
  if (done) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF6F0] flex flex-col items-center justify-center px-6 text-center animate-wizard-in-right">
        <div className="max-w-sm w-full">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#B85C38]/10">
            <Sparkles className="text-[#B85C38]" size={28} />
          </div>
          <h1 className="font-display text-3xl font-bold text-[#3D2B1F]">{t.thanksTitle}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#5C5349]">{t.thanksBody}</p>
          <a
            href={BOOK_AGAIN_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 block w-full rounded-full bg-[#B85C38] px-6 py-4 text-base font-semibold text-white"
          >
            {t.bookNext}
          </a>
          <a href="/studios" className="mt-4 inline-block text-sm font-semibold text-[#B85C38] underline underline-offset-4">
            {t.browse}
          </a>
        </div>
      </div>
    );
  }

  const canContinue =
    step === 1 ? rating >= 1 :
    step === 6 ? true :
    true;

  return (
    <div className={`min-h-[100dvh] flex flex-col ${privateScreen ? "bg-[#F3EBE2]" : "bg-[#FAF6F0]"} transition-colors duration-300`}>
      {/* Progress + back */}
      <header className="sticky top-0 z-10 px-4 pt-3 pb-2 backdrop-blur-sm">
        <div className="h-1 w-full rounded-full bg-[#E7DCCE]">
          <div
            className="h-1 rounded-full bg-[#B85C38] transition-all duration-300"
            style={{ width: `${(step / LAST_STEP) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex h-8 items-center">
          {step > 1 ? (
            <button type="button" onClick={goBack} aria-label={t.back}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[#3D2B1F] active:bg-[#3D2B1F]/5">
              <ArrowLeft size={20} />
            </button>
          ) : <span className="h-9 w-9" />}
          <span className="ml-auto truncate text-xs text-[#8A7460]">{studio}</span>
        </div>
      </header>

      {/* One question per screen */}
      <main className="flex-1 overflow-hidden px-6">
        <div
          key={step}
          className={dir === 1 ? "animate-wizard-in-right" : "animate-wizard-in-left"}
        >
          <div className="mx-auto w-full max-w-md pt-8 min-[720px]:pt-16 pb-40">
            {step === 1 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">
                  {t.s1(service, studio)}
                </h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s1sub}</p>
                <div className="mt-10">
                  <StarRow value={rating} onPick={(n) => { setRating(n); window.setTimeout(() => goNext({ rating: n }), 240); }} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s2}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s2sub}</p>
                <div className="mt-8 space-y-3">
                  {([
                    ["too_soft", t.tooSoft],
                    ["perfect", t.justRight],
                    ["too_strong", t.tooFirm],
                  ] as [Pressure, string][]).map(([v, label]) => {
                    const on = pressure === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setPressure(v); window.setTimeout(() => goNext({ pressure_feedback: v }), 240); }}
                        className={`w-full rounded-2xl border-2 px-5 py-5 text-left text-lg font-semibold transition ${
                          on ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s3}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.starsSub}</p>
                <div className="mt-10">
                  <StarRow value={cleanliness} onPick={(n) => pickStars(n, setCleanliness, "cleanliness")} />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s4}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.starsSub}</p>
                <div className="mt-10">
                  <StarRow value={ambience} onPick={(n) => pickStars(n, setAmbience, "ambience")} />
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">
                  {rating >= 4 ? t.s5good : t.s5bad}
                </h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s5sub}</p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  {chipKeys.map((key) => {
                    const on = tags.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleTag(key)}
                        className={`rounded-full border px-4 py-3 text-[15px] font-medium transition ${
                          on ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                        }`}
                      >
                        {reviewTagLabel(key, lang)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setOtherOn((v) => !v)}
                    className={`rounded-full border px-4 py-3 text-[15px] font-medium transition ${
                      otherOn ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                    }`}
                  >
                    {t.other}
                  </button>
                </div>
                {otherOn && (
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value.slice(0, 60))}
                    placeholder={t.otherPh}
                    maxLength={60}
                    className="mt-4 w-full rounded-2xl border border-[#E7DCCE] bg-white px-4 py-3 text-[15px] text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                  />
                )}
              </>
            )}

            {step === 6 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s6}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s6sub}</p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                  rows={6}
                  placeholder={t.s6ph}
                  className="mt-6 w-full rounded-2xl border border-[#E7DCCE] bg-white p-4 text-[15px] leading-relaxed text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                />
                <label className="mt-6 block text-sm font-semibold text-[#3D2B1F]">{t.nameLabel}</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                  placeholder={t.namePh}
                  className="mt-2 w-full rounded-2xl border border-[#E7DCCE] bg-white px-4 py-3 text-[15px] text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                />
              </>
            )}

            {step === 7 && (
              <>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#3D2B1F]/8">
                  <Lock size={18} className="text-[#3D2B1F]" />
                </div>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s7}</h1>
                <p className="mt-2 text-sm text-[#8A7460]">{t.s7sub}</p>
                <textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value.slice(0, 1000))}
                  rows={6}
                  placeholder={t.s7ph}
                  className="mt-6 w-full rounded-2xl border border-[#E0D4C4] bg-[#FBF7F2] p-4 text-[15px] leading-relaxed text-[#3D2B1F] outline-none focus:border-[#B85C38]"
                />
              </>
            )}

            {step === 8 && (
              <>
                <h1 className="font-display text-[27px] min-[420px]:text-3xl font-bold leading-tight text-[#3D2B1F]">{t.s8}</h1>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {[{ v: true, l: t.yes }, { v: false, l: t.no }].map((o) => {
                    const on = wouldReturn === o.v;
                    return (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setWouldReturn((prev) => (prev === o.v ? null : o.v))}
                        className={`rounded-2xl border-2 px-4 py-7 text-lg font-semibold transition ${
                          on ? "border-[#B85C38] bg-[#B85C38] text-white" : "border-[#E7DCCE] bg-white text-[#3D2B1F]"
                        }`}
                      >
                        {o.l}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {errMsg && <p className="mt-6 text-sm text-[#B23A3A]">{errMsg}</p>}
          </div>
        </div>
      </main>

      {/* Pinned action */}
      <footer className="sticky bottom-0 border-t border-[#EADFD1] bg-[inherit] px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={() => (step === LAST_STEP ? finish() : goNext())}
            className={`w-full rounded-full px-6 py-4 text-base font-semibold text-white transition ${
              canContinue && !saving ? "bg-[#B85C38]" : "bg-[#DFD3C3] cursor-not-allowed"
            }`}
          >
            {saving ? t.sending : step === LAST_STEP ? t.finish : t.continue}
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => (step === LAST_STEP ? finish() : goNext())}
              className="mx-auto mt-3 block text-sm text-[#8A7460] underline underline-offset-4"
            >
              {t.skip}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
