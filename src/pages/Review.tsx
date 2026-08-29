import { useEffect, useMemo, useRef, useState } from "react";

import {
  COMPLIMENT_TAGS, ISSUE_TAGS, reviewTagLabel, suggestDisplayName, type Lang,
} from "@/lib/reviews";

const FN_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/review";
const BOOK_AGAIN_WA = "https://wa.me/34613977900?text=Hi";

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
    comment?: string | null;
    tags?: string[] | null;
    private_note?: string | null;
    display_name?: string | null;
  } | null;
};

const CREAM = "#faf6f1";
const TERRA = "#C4622D";
const INK = "#3d2b1f";
const MUTED = "#8a7460";
const LINE = "#EADFD1";

const COPY = {
  en: {
    loading: "Loading…",
    invalid: "Invalid link",
    invalidSub: "We could not find that booking.",
    cancelled: "This booking was cancelled",
    ratingTitle: "How was it?",
    ratingHint: "Tap a star",
    complimentTitle: "What stood out?",
    issueTitle: "What went wrong?",
    optional: "Optional - tap any that apply",
    wordsTitle: "Anything to add?",
    publicLabel: "Share your experience",
    publicHint: "Shown on the studio page",
    privateLabel: "Anything just for Massage Club?",
    privateHint: "Never published",
    returnLabel: "Would you go back?",
    yes: "Yes",
    no: "No",
    nameLabel: "Shown as",
    back: "Back",
    next: "Next",
    send: "Send review",
    update: "Update review",
    sending: "Sending…",
    error: "Could not send. Please try again.",
    thanksTitle: "Thank you",
    thanksBody: "Your review helps the next person find a good massage in Madrid.",
    bookNext: "Book your next massage",
    browse: "Browse studios",
  },
  es: {
    loading: "Cargando…",
    invalid: "Enlace no válido",
    invalidSub: "No encontramos esa reserva.",
    cancelled: "Esta reserva fue cancelada",
    ratingTitle: "¿Qué tal fue?",
    ratingHint: "Toca una estrella",
    complimentTitle: "¿Qué destacarías?",
    issueTitle: "¿Qué falló?",
    optional: "Opcional - toca lo que aplique",
    wordsTitle: "¿Algo más?",
    publicLabel: "Cuenta tu experiencia",
    publicHint: "Se muestra en la página del estudio",
    privateLabel: "¿Algo solo para Massage Club?",
    privateHint: "Nunca se publica",
    returnLabel: "¿Volverías?",
    yes: "Sí",
    no: "No",
    nameLabel: "Se muestra como",
    back: "Atrás",
    next: "Siguiente",
    send: "Enviar valoración",
    update: "Actualizar valoración",
    sending: "Enviando…",
    error: "No se pudo enviar. Inténtalo de nuevo.",
    thanksTitle: "Gracias",
    thanksBody: "Tu opinión ayuda a la próxima persona a encontrar un buen masaje en Madrid.",
    bookNext: "Reserva tu próximo masaje",
    browse: "Ver estudios",
  },
} as const;

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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rating, setRating] = useState<number>(preselectedR);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [isUpdate, setIsUpdate] = useState(false);
  const advanced = useRef(false);

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
        if (j.review) {
          setIsUpdate(true);
          if (j.review.rating) setRating(j.review.rating);
          if (Array.isArray(j.review.tags)) setTags(j.review.tags.filter(Boolean));
          if (j.review.comment) setComment(j.review.comment);
          if (j.review.private_note) setPrivateNote(j.review.private_note);
          if (j.review.display_name) setDisplayName(j.review.display_name);
          if (typeof j.review.would_return === "boolean") setWouldReturn(j.review.would_return);
        }
      } catch {
        setFatal("invalid");
      }
      setLoading(false);
    })();
  }, [token]);

  // Email deep link with &r= lands straight on the chips step.
  useEffect(() => {
    if (!loading && !fatal && preselectedR && !advanced.current) {
      advanced.current = true;
      setStep(2);
    }
  }, [loading, fatal, preselectedR]);

  const pickStar = (n: number) => {
    setRating(n);
    setTags([]);            // chip set depends on the score
    window.setTimeout(() => setStep(2), 220);   // auto-advance
  };

  const toggleTag = (key: string) =>
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setErrMsg("");
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          tags,
          comment: comment.trim() || null,
          private_note: privateNote.trim() || null,
          display_name: displayName.trim() || null,
          would_return: wouldReturn,
          lang,
        }),
      });
      if (r.status === 404) { setFatal("invalid"); setSubmitting(false); return; }
      if (r.status === 409) { setFatal("cancelled"); setSubmitting(false); return; }
      if (!r.ok) { setErrMsg(t.error); setSubmitting(false); return; }
      setDone(true);
    } catch {
      setErrMsg(t.error);
    }
    setSubmitting(false);
  };

  const studio = sanitize(data?.studio);
  const service = sanitize(data?.service);
  const date = sanitize(data?.date);
  const time = sanitize(data?.time);
  const subLine = [service, [date, time].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const chipKeys: readonly string[] = rating >= 4 ? COMPLIMENT_TAGS : ISSUE_TAGS;

  const card: React.CSSProperties = {
    width: "100%", background: "#fff", borderRadius: 24,
    boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)",
    padding: "28px 22px", color: INK,
  };
  const primaryBtn = (enabled: boolean): React.CSSProperties => ({
    width: "100%", padding: "15px 20px", borderRadius: 999, border: "none",
    background: enabled ? TERRA : "#E4DCD0", color: "#fff",
    fontWeight: 700, fontSize: 16, cursor: enabled ? "pointer" : "not-allowed",
  });

  return (
    <div style={{ minHeight: "100vh", background: CREAM }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 20px", borderBottom: `1px solid ${LINE}`, background: CREAM,
      }}>
        <img src="/brand/mc-avatar-terracotta.png" alt="Massage Club" width={28} height={28} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 600, color: INK, letterSpacing: 0.2 }}>Massage Club</span>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 18px 40px" }}>
        <div style={card}>
          {loading ? (
            <p style={{ color: MUTED, fontSize: 15, textAlign: "center" }}>{t.loading}</p>
          ) : fatal === "invalid" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>⚠️</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>{t.invalid}</h1>
              <p style={{ fontSize: 14, color: MUTED }}>{t.invalidSub}</p>
            </div>
          ) : fatal === "cancelled" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🗓️</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>{t.cancelled}</h1>
            </div>
          ) : done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🌿</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 8px" }}>{t.thanksTitle}</h1>
              <p style={{ fontSize: 15, color: "#5a4736", margin: "0 0 20px" }}>{t.thanksBody}</p>
              <a href={BOOK_AGAIN_WA} target="_blank" rel="noopener noreferrer"
                style={{ ...primaryBtn(true), display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
                {t.bookNext}
              </a>
              <a href="/studios" style={{ display: "inline-block", marginTop: 14, color: TERRA, fontWeight: 600, fontSize: 14 }}>
                {t.browse}
              </a>
            </div>
          ) : (
            <>
              {/* Context */}
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: TERRA, margin: 0 }}>
                  {lang === "es" ? "TU OPINIÓN SOBRE" : "YOUR REVIEW OF"}
                </p>
                <h1 style={{
                  fontFamily: "'Fraunces','Playfair Display',Georgia,serif",
                  fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: "8px 0 4px", color: INK,
                }}>
                  {studio || "—"}
                </h1>
                {subLine && <div style={{ fontSize: 13, color: MUTED }}>{subLine}</div>}
              </div>

              {/* Step dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
                {[1, 2, 3].map((n) => (
                  <span key={n} style={{
                    width: n === step ? 22 : 7, height: 7, borderRadius: 999,
                    background: n === step ? TERRA : "#E4DCD0", transition: "all .2s",
                  }} />
                ))}
              </div>

              {step === 1 && (
                <div style={{ textAlign: "center" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>{t.ratingTitle}</h2>
                  <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px" }}>{t.ratingHint}</p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => pickStar(n)} aria-label={`${n}`}
                        style={{
                          background: "transparent", border: "none", cursor: "pointer",
                          fontSize: "3rem", lineHeight: 1, padding: "0 2px",
                          color: n <= rating ? TERRA : "#DCD1C2",
                        }}>
                        {n <= rating ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>
                    {rating >= 4 ? t.complimentTitle : t.issueTitle}
                  </h2>
                  <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px" }}>{t.optional}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                    {chipKeys.map((key) => {
                      const on = tags.includes(key);
                      return (
                        <button key={key} type="button" onClick={() => toggleTag(key)}
                          style={{
                            padding: "10px 14px", borderRadius: 999,
                            border: `1px solid ${on ? TERRA : LINE}`,
                            background: on ? TERRA : "#fff", color: on ? "#fff" : INK,
                            fontWeight: 600, fontSize: 14, cursor: "pointer",
                          }}>
                          {reviewTagLabel(key, lang)}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setStep(3)} style={primaryBtn(true)}>{t.next}</button>
                  <button type="button" onClick={() => setStep(1)}
                    style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: MUTED, fontSize: 14, cursor: "pointer" }}>
                    {t.back}
                  </button>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 14px" }}>{t.wordsTitle}</h2>

                  <label style={{ fontSize: 14, fontWeight: 600 }}>{t.publicLabel}</label>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{t.publicHint}</div>
                  <textarea value={comment} rows={3}
                    onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${LINE}`,
                      fontSize: 14, color: INK, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                    }} />

                  <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginTop: 16 }}>{t.privateLabel}</label>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{t.privateHint}</div>
                  <textarea value={privateNote} rows={2}
                    onChange={(e) => setPrivateNote(e.target.value.slice(0, 1000))}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${LINE}`,
                      fontSize: 14, color: INK, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                    }} />

                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t.returnLabel}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ v: true, l: t.yes }, { v: false, l: t.no }].map((o) => {
                        const on = wouldReturn === o.v;
                        return (
                          <button key={String(o.v)} type="button"
                            onClick={() => setWouldReturn((prev) => (prev === o.v ? null : o.v))}
                            style={{
                              flex: 1, padding: "11px 12px", borderRadius: 999,
                              border: `1px solid ${on ? TERRA : LINE}`,
                              background: on ? TERRA : "#fff", color: on ? "#fff" : INK,
                              fontWeight: 600, fontSize: 14, cursor: "pointer",
                            }}>{o.l}</button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginTop: 16, marginBottom: 20 }}>
                    <label style={{ fontSize: 14, fontWeight: 600 }}>{t.nameLabel}</label>
                    <input value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                      placeholder={lang === "es" ? "Cliente de Massage Club" : "Massage Club client"}
                      style={{
                        width: "100%", marginTop: 6, padding: "11px 12px", borderRadius: 12,
                        border: `1px solid ${LINE}`, fontSize: 14, color: INK, fontFamily: "inherit", boxSizing: "border-box",
                      }} />
                  </div>

                  {errMsg && <div style={{ color: "#b23a3a", fontSize: 13, marginBottom: 10 }}>{errMsg}</div>}

                  <button type="button" onClick={submit} disabled={rating < 1 || submitting} style={primaryBtn(rating >= 1 && !submitting)}>
                    {submitting ? t.sending : isUpdate ? t.update : t.send}
                  </button>
                  <button type="button" onClick={() => setStep(2)}
                    style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: MUTED, fontSize: 14, cursor: "pointer" }}>
                    {t.back}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ marginTop: 22, fontSize: 13, color: MUTED, textAlign: "center" }}>
          Massage Club · Madrid · book.massageclub.io
        </div>
      </div>
    </div>
  );
}
