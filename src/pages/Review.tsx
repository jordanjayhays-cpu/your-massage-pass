import { useEffect, useMemo, useState } from "react";

const FN_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/review";

function sanitize(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 300);
}

function safeSlug(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 80);
}

type FetchResp = {
  studio?: string;
  slug?: string;
  service?: string;
  date?: string;
  time?: string;
  name?: string;
  status?: string;
  cancelled?: boolean;
  review?: {
    rating?: number;
    would_return?: boolean | null;
    pressure_feedback?: "too_soft" | "perfect" | "too_strong" | null;
    comment?: string | null;
  } | null;
};

type Pressure = "too_soft" | "perfect" | "too_strong";

const CREAM = "#faf6f1";
const TERRA = "#B85C38";
const INK = "#3d2b1f";
const MUTED = "#8a7460";

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

  const [rating, setRating] = useState<number>(preselectedR);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [pressure, setPressure] = useState<Pressure | "">("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [isUpdate, setIsUpdate] = useState(false);

  useEffect(() => {
    if (!token) { setFatal("invalid"); setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        if (r.status === 404) { setFatal("invalid"); setLoading(false); return; }
        if (!r.ok) { setFatal("invalid"); setLoading(false); return; }
        const j: FetchResp = await r.json();
        if (j.cancelled) { setData(j); setFatal("cancelled"); setLoading(false); return; }
        setData(j);
        if (j.review) {
          setIsUpdate(true);
          if (j.review.rating) setRating(j.review.rating);
          if (typeof j.review.would_return === "boolean") setWouldReturn(j.review.would_return);
          if (j.review.pressure_feedback) setPressure(j.review.pressure_feedback);
          if (j.review.comment) setComment(j.review.comment);
        }
      } catch {
        setFatal("invalid");
      }
      setLoading(false);
    })();
  }, [token]);

  const canSubmit = rating >= 1 && rating <= 5 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrMsg("");
    const lang = (typeof localStorage !== "undefined" && localStorage.getItem("mm-lang")) || "es";
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          would_return: wouldReturn,
          pressure_feedback: pressure || null,
          comment: comment.trim() || null,
          lang,
        }),
      });
      if (r.status === 404) { setFatal("invalid"); setSubmitting(false); return; }
      if (r.status === 409) { setFatal("cancelled"); setSubmitting(false); return; }
      if (!r.ok) {
        setErrMsg("No se pudo enviar / Could not send. Inténtalo de nuevo.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setErrMsg("No se pudo enviar / Could not send. Inténtalo de nuevo.");
    }
    setSubmitting(false);
  };

  const studio = sanitize(data?.studio);
  const service = sanitize(data?.service);
  const date = sanitize(data?.date);
  const time = sanitize(data?.time);
  const slug = safeSlug(sanitize(data?.slug));
  const subLine = [service, [date, time].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

  return (
    <div style={{ minHeight: "100vh", background: CREAM }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 20px", borderBottom: "1px solid #ece4d7", background: CREAM,
      }}>
        <img src="/brand/mc-avatar-terracotta.png" alt="Massage Club" width={28} height={28} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 600, color: INK, letterSpacing: 0.2 }}>Massage Club</span>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px 32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          width: "100%", background: "#fff", borderRadius: 20,
          boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)",
          padding: "32px 24px", textAlign: "center", color: INK,
        }}>
          {loading ? (
            <p style={{ color: MUTED, fontSize: 15 }}>Cargando… / Loading…</p>
          ) : fatal === "invalid" ? (
            <>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>⚠️</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 4px" }}>Enlace no válido</h1>
              <div style={{ fontSize: 14, color: MUTED }}>Invalid link</div>
            </>
          ) : fatal === "cancelled" ? (
            <>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>🗓️</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 4px" }}>Esta reserva fue cancelada</h1>
              <div style={{ fontSize: 14, color: MUTED }}>This booking was cancelled</div>
            </>
          ) : done ? (
            <>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>✅</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 6px" }}>¡Gracias!</h1>
              <p style={{ fontSize: 15, color: "#5a4736", margin: "0 0 4px" }}>
                Tu valoración ayuda a otros clientes.
              </p>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px" }}>
                Your review helps other customers.
              </p>
              {slug && (
                <a href={`/book/${slug}`} style={{
                  display: "inline-block", marginTop: 12, padding: "12px 22px",
                  background: TERRA, color: "#fff", borderRadius: 999,
                  fontWeight: 600, textDecoration: "none", fontSize: 15,
                }}>
                  Reservar de nuevo / Book again
                </a>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: TERRA, margin: 0 }}>
                TU OPINIÓN SOBRE
              </p>
              <h1 style={{
                fontFamily: "'Fraunces','Playfair Display',Georgia,serif",
                fontSize: 34, fontWeight: 700, lineHeight: 1.1, margin: "10px 0 6px", color: INK,
              }}>
                {studio || "—"}
              </h1>
              {subLine && (
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 18 }}>{subLine}</div>
              )}

              {/* Stars */}
              <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "6px 0 18px" }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = n <= rating;
                  return (
                    <button key={n} type="button" onClick={() => setRating(n)}
                      aria-label={`${n} stars`}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        fontSize: "2.5rem", lineHeight: 1, padding: "0 2px",
                        color: active ? TERRA : "#d9cfc2",
                      }}>
                      {active ? "★" : "☆"}
                    </button>
                  );
                })}
              </div>

              {/* Would return */}
              <div style={{ marginBottom: 16, textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>¿Volverías?</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Would you return?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ v: true, l: "Sí / Yes" }, { v: false, l: "No" }].map((o) => {
                    const on = wouldReturn === o.v;
                    return (
                      <button key={String(o.v)} type="button"
                        onClick={() => setWouldReturn(prev => prev === o.v ? null : o.v)}
                        style={{
                          flex: 1, padding: "10px 12px", borderRadius: 999,
                          border: `1px solid ${on ? TERRA : "#e4dcd0"}`,
                          background: on ? TERRA : "#fff",
                          color: on ? "#fff" : INK,
                          fontWeight: 600, fontSize: 14, cursor: "pointer",
                        }}>{o.l}</button>
                    );
                  })}
                </div>
              </div>

              {/* Pressure */}
              <div style={{ marginBottom: 16, textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>¿La presión?</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Pressure?</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { v: "too_soft" as Pressure, l: "Muy suave / Too soft" },
                    { v: "perfect" as Pressure, l: "Perfecta / Perfect" },
                    { v: "too_strong" as Pressure, l: "Muy fuerte / Too strong" },
                  ].map((o) => {
                    const on = pressure === o.v;
                    return (
                      <button key={o.v} type="button"
                        onClick={() => setPressure(prev => prev === o.v ? "" : o.v)}
                        style={{
                          flex: "1 1 30%", padding: "10px 10px", borderRadius: 12,
                          border: `1px solid ${on ? TERRA : "#e4dcd0"}`,
                          background: on ? TERRA : "#fff",
                          color: on ? "#fff" : INK,
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>{o.l}</button>
                    );
                  })}
                </div>
              </div>

              {/* Comment */}
              <div style={{ marginBottom: 16, textAlign: "left" }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                  Cuéntanos más (opcional)
                </label>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Tell us more (optional)</div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 12,
                    border: "1px solid #e4dcd0", background: "#fff",
                    fontSize: 14, color: INK, resize: "vertical", fontFamily: "inherit",
                  }}
                />
              </div>

              {errMsg && (
                <div style={{ color: "#b23a3a", fontSize: 13, marginBottom: 10 }}>{errMsg}</div>
              )}

              <button type="button" onClick={submit} disabled={!canSubmit}
                style={{
                  width: "100%", padding: "14px 20px", borderRadius: 999, border: "none",
                  background: canSubmit ? TERRA : "#e4dcd0",
                  color: "#fff", fontWeight: 700, fontSize: 15,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}>
                {submitting
                  ? "Enviando… / Sending…"
                  : isUpdate
                    ? "Actualizar valoración / Update review"
                    : "Enviar valoración / Send review"}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 24, fontSize: 13, color: MUTED, textAlign: "center" }}>
          Massage Club · Madrid · book.massageclub.io
        </div>
      </div>
    </div>
  );
}
