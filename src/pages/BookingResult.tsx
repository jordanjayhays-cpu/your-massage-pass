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
  | "invalid";

const KNOWN: Outcome[] = [
  "confirmed",
  "declined",
  "cancelled",
  "already-confirmed",
  "already-declined",
  "was-cancelled",
  "error",
  "invalid",
];

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
