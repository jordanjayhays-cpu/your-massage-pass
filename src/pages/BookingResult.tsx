import { useMemo } from "react";

function getParam(sp: URLSearchParams, key: string): string {
  const v = sp.get(key);
  if (!v) return "";
  // Strip control chars; rendering as text via React auto-escapes.
  return v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 300);
}

function safeRebookUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const origin = u.origin;
    if (
      origin === "https://book.massageclub.io" ||
      origin === "https://massageclub.io"
    ) {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

type Outcome =
  | "confirmed"
  | "declined"
  | "cancelled"
  | "already-confirmed"
  | "already-declined"
  | "was-cancelled"
  | "error"
  | "invalid"
  | "completed"
  | "noshow"
  | "hours-confirmed";

const KNOWN: Outcome[] = [
  "confirmed",
  "declined",
  "cancelled",
  "already-confirmed",
  "already-declined",
  "was-cancelled",
  "error",
  "invalid",
  "completed",
  "noshow",
  "hours-confirmed",
];

const STUDIO_FACING: Outcome[] = [
  "confirmed",
  "declined",
  "already-confirmed",
  "already-declined",
  "completed",
  "noshow",
];

function looksLikePhone(input: string): boolean {
  return /^[\d\s+]+$/.test(input);
}

function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}

function whatsappUrl(number: string): string | null {
  const digits = number.replace(/[^\d]/g, "");
  if (!digits) return null;
  const withCountry = digits.length === 9 ? `34${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

function convLabel(conv: string): string {
  switch (conv) {
    case "silence":
      return "🤫 Prefiere silencio / Prefers silence";
    case "minimal":
      return "Un poco de charla / A little chat";
    case "chatty":
      return "Le gusta charlar / Happy to chat";
    default:
      return conv;
  }
}

export default function BookingResult() {
  const params = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );

  const oRaw = getParam(params, "o");
  const outcome: Outcome = (KNOWN as string[]).includes(oRaw) ? (oRaw as Outcome) : "invalid";
  const studio = getParam(params, "studio");
  const service = getParam(params, "service");
  const date = getParam(params, "date");
  const time = getParam(params, "time");
  const name = getParam(params, "name");
  const rb = safeRebookUrl(getParam(params, "rb"));

  const ph = getParam(params, "ph");
  const em = getParam(params, "em");
  const dur = getParam(params, "dur");
  const pr = getParam(params, "pr");
  const press = getParam(params, "press");
  const focus = getParam(params, "focus");
  const addons = getParam(params, "addons");
  const conv = getParam(params, "conv");
  const health = getParam(params, "health");
  const notes = getParam(params, "notes");

  const hasClientCard =
    STUDIO_FACING.includes(outcome) &&
    [ph, em, dur, pr, press, focus, addons, conv, health, notes].some(Boolean);

  const summaryFull = [name, service, [date, time].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
  const summaryNoName = [service, [date, time].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");

  let icon = "⚠️";
  let titleEs = "Enlace no válido";
  let titleEn = "Invalid link";
  let body = "";
  let summary = "";
  let showRebookBtn = false;

  switch (outcome) {
    case "confirmed":
      icon = "✅";
      titleEs = "¡Cita confirmada!";
      titleEn = "Appointment confirmed";
      body = "Hemos avisado al cliente.";
      summary = summaryFull;
      break;
    case "declined":
      icon = "🗓️";
      titleEs = "Reserva rechazada";
      titleEn = "Booking declined";
      body = "Hemos avisado al cliente para que elija otro horario.";
      summary = summaryFull;
      break;
    case "cancelled":
      icon = "🗓️";
      titleEs = "Reserva cancelada";
      titleEn = "Booking cancelled";
      body = "Hemos avisado al estudio. Puedes reservar de nuevo cuando quieras.";
      summary = summaryNoName;
      showRebookBtn = true;
      break;
    case "already-confirmed":
      icon = "✅";
      titleEs = "Cita ya confirmada";
      titleEn = "Already confirmed";
      summary = summaryFull;
      break;
    case "already-declined":
      icon = "🗓️";
      titleEs = "Reserva ya rechazada";
      titleEn = "Already declined";
      summary = summaryFull;
      break;
    case "was-cancelled":
      icon = "⚠️";
      titleEs = "Esta reserva fue cancelada";
      titleEn = "This booking was cancelled and can no longer be confirmed";
      break;
    case "completed":
      icon = "🎉";
      titleEs = "¡Visita completada!";
      titleEn = "Marked as completed";
      body = "Gracias — la reserva queda registrada como completada.";
      summary = summaryFull;
      break;
    case "noshow":
      icon = "🕐";
      titleEs = "Cliente no asistió";
      titleEn = "Marked as no-show";
      body = "Hemos registrado que el cliente no asistió.";
      summary = summaryFull;
      break;
    case "hours-confirmed":
      icon = "🗓️";
      titleEs = "¡Horario confirmado!";
      titleEn = "Hours confirmed";
      body =
        "Gracias — tus reservas ya siguen tu horario real. Puedes ajustarlo cuando quieras desde tu portal. / Thanks — your bookings now follow your real hours. You can adjust them any time from your portal.";
      break;
    case "error":
      icon = "⚠️";
      titleEs = "No se pudo completar la acción";
      titleEn = "Something went wrong — please try the link again";
      break;
    case "invalid":
    default:
      icon = "⚠️";
      titleEs = "Enlace no válido";
      titleEn = "Invalid link";
      break;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf6f1" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 20px",
          borderBottom: "1px solid #ece4d7",
          background: "#faf6f1",
        }}
      >
        <img
          src="/brand/mc-avatar-terracotta.png"
          alt="Massage Club"
          width={28}
          height={28}
          style={{ borderRadius: 8 }}
        />
        <span style={{ fontWeight: 600, color: "#3d2b1f", letterSpacing: 0.2 }}>
          Massage Club
        </span>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "48px 20px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            background: "#ffffff",
            borderRadius: 20,
            boxShadow: "0 6px 24px rgba(80, 44, 20, 0.08)",
            padding: "32px 24px",
            textAlign: "center",
            color: "#3d2b1f",
          }}
        >
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>{icon}</div>

          {studio && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 6,
                color: "#3d2b1f",
              }}
            >
              {studio}
            </div>
          )}

          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: "6px 0 4px",
              color: "#3d2b1f",
            }}
          >
            {titleEs}
          </h1>
          <div style={{ fontSize: 14, color: "#8a7460", marginBottom: 14 }}>{titleEn}</div>

          {body && (
            <p style={{ fontSize: 15, color: "#5a4736", margin: "8px 0 12px" }}>{body}</p>
          )}

          {summary && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                background: "#faf6f1",
                borderRadius: 12,
                fontSize: 14,
                color: "#3d2b1f",
              }}
            >
              {summary}
            </div>
          )}

          {hasClientCard && (
            <div
              style={{
                marginTop: 16,
                padding: "16px",
                background: "#faf6f1",
                borderRadius: 12,
                textAlign: "left",
                color: "#3d2b1f",
                fontSize: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#B85C38",
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                📋 Ficha del cliente / Client details
              </div>

              {(name || ph || em) && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>👤 Cliente / Client:</span>{" "}
                  {name && <span>{name}</span>}
                  {ph && looksLikePhone(ph) && (
                    <>
                      {" · "}
                      <a
                        href={`tel:${ph.replace(/\s/g, "")}`}
                        style={{ color: "#B85C38", textDecoration: "underline" }}
                      >
                        {ph}
                      </a>
                      {whatsappUrl(ph) && (
                        <>
                          {" · "}
                          <a
                            href={whatsappUrl(ph)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#B85C38", textDecoration: "underline" }}
                          >
                            WhatsApp
                          </a>
                        </>
                      )}
                    </>
                  )}
                  {em && looksLikeEmail(em) && (
                    <>
                      {" · "}
                      <a
                        href={`mailto:${em}`}
                        style={{ color: "#B85C38", textDecoration: "underline" }}
                      >
                        {em}
                      </a>
                    </>
                  )}
                </div>
              )}

              {(service || dur || pr) && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>
                    💆 Servicio / Service:
                  </span>{" "}
                  {[service, dur && `${dur} min`, pr && `€${pr}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}

              {press && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>Presión / Pressure:</span>{" "}
                  {press}
                </div>
              )}

              {focus && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>Zonas / Focus:</span>{" "}
                  {focus}
                </div>
              )}

              {addons && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>Extras:</span> {addons}
                </div>
              )}

              {conv && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>Conversación:</span>{" "}
                  {convLabel(conv)}
                </div>
              )}

              {health && (
                <div
                  style={{
                    marginBottom: 10,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>⚠️ Salud / Health:</span>{" "}
                  {health}
                </div>
              )}

              {notes && (
                <div>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>📝 Notas / Notes:</span>{" "}
                  {notes}
                </div>
              )}
            </div>
          )}

          {showRebookBtn && rb && (
            <a
              href={rb}
              style={{
                display: "inline-block",
                marginTop: 20,
                padding: "12px 20px",
                background: "#c26b4a",
                color: "#fff",
                borderRadius: 999,
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              📅 Cambiar fecha / Change date
            </a>
          )}
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 13,
            color: "#8a7460",
            textAlign: "center",
          }}
        >
          Massage Club · Madrid · book.massageclub.io
        </div>
      </div>
    </div>
  );
}
