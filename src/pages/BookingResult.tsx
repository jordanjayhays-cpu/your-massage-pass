import { telHref } from "@/app/lib/whatsapp";
import { useMemo } from "react";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";
import { parseISODate, shortDate, timeLabel as formatTimeLabel } from "@/lib/localeFormat";
import { localizedServiceName } from "@/lib/serviceTypeI18n";

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
  | "hours-confirmed"
  | "picked"
  | "studio-ok"
  | "studio-none";

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
  "picked",
  "studio-ok",
  "studio-none",
];

const STUDIO_FACING: Outcome[] = [
  "confirmed",
  "declined",
  "already-confirmed",
  "already-declined",
  "completed",
  "noshow",
  "studio-ok",
  "studio-none",
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

type OutcomeCopy = { title: string; body?: string };

type Copy = {
  brand: string;
  footer: string;
  changeDate: string;
  clientDetailsHeader: string;
  clientLabel: string;
  serviceLabel: string;
  pressureLabel: string;
  focusLabel: string;
  extrasLabel: string;
  conversationLabel: string;
  healthLabel: string;
  notesLabel: string;
  whatsapp: string;
  conv: { silence: string; minimal: string; chatty: string };
  outcomes: Record<Outcome, OutcomeCopy>;
};

const COPY: Record<FlowLang, Copy> = {
  en: {
    brand: "Massage Club",
    footer: "Massage Club · Madrid · book.massageclub.io",
    changeDate: "📅 Change date",
    clientDetailsHeader: "📋 Client details",
    clientLabel: "👤 Client:",
    serviceLabel: "💆 Service:",
    pressureLabel: "Pressure:",
    focusLabel: "Focus areas:",
    extrasLabel: "Extras:",
    conversationLabel: "Conversation:",
    healthLabel: "⚠️ Health:",
    notesLabel: "📝 Notes:",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 Prefers silence", minimal: "A little chat", chatty: "Happy to chat" },
    outcomes: {
      confirmed: { title: "✅ Appointment confirmed", body: "We've let the client know." },
      declined: { title: "🗓️ Booking declined", body: "We've told the client to pick another time." },
      cancelled: { title: "🗓️ Booking cancelled", body: "We've told the studio. You can book again whenever you like." },
      "already-confirmed": { title: "✅ Already confirmed" },
      "already-declined": { title: "🗓️ Already declined" },
      "was-cancelled": { title: "⚠️ This booking was cancelled and can no longer be confirmed" },
      completed: { title: "🎉 Marked as completed", body: "Thanks - the booking is now recorded as completed." },
      noshow: { title: "🕐 Marked as no-show", body: "We've recorded that the client didn't show up." },
      "hours-confirmed": { title: "🗓️ Hours confirmed", body: "Thanks - your bookings now follow your real hours. You can adjust them any time from your portal." },
      picked: { title: "✅ Great choice!", body: "We're confirming your exact time right now. Watch WhatsApp - you'll have 2-3 time slots to pick from shortly, usually within the hour. You pay the studio directly. No booking fee." },
      "studio-ok": { title: "✅ Confirmed", body: "The client has been sent their confirmation automatically. Thank you." },
      "studio-none": { title: "👍 Understood", body: "We've told the team and will find another time with the client. Thanks for replying." },
      error: { title: "⚠️ Something went wrong - please try the link again" },
      invalid: { title: "⚠️ Invalid link" },
    },
  },
  es: {
    brand: "Massage Club",
    footer: "Massage Club · Madrid · book.massageclub.io",
    changeDate: "📅 Cambiar fecha",
    clientDetailsHeader: "📋 Ficha del cliente",
    clientLabel: "👤 Cliente:",
    serviceLabel: "💆 Servicio:",
    pressureLabel: "Presión:",
    focusLabel: "Zonas:",
    extrasLabel: "Extras:",
    conversationLabel: "Conversación:",
    healthLabel: "⚠️ Salud:",
    notesLabel: "📝 Notas:",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 Prefiere silencio", minimal: "Un poco de charla", chatty: "Le gusta charlar" },
    outcomes: {
      confirmed: { title: "✅ ¡Cita confirmada!", body: "Hemos avisado al cliente." },
      declined: { title: "🗓️ Reserva rechazada", body: "Hemos avisado al cliente para que elija otro horario." },
      cancelled: { title: "🗓️ Reserva cancelada", body: "Hemos avisado al estudio. Puedes reservar de nuevo cuando quieras." },
      "already-confirmed": { title: "✅ Cita ya confirmada" },
      "already-declined": { title: "🗓️ Reserva ya rechazada" },
      "was-cancelled": { title: "⚠️ Esta reserva fue cancelada y ya no se puede confirmar" },
      completed: { title: "🎉 ¡Visita completada!", body: "Gracias - la reserva queda registrada como completada." },
      noshow: { title: "🕐 Cliente no asistió", body: "Hemos registrado que el cliente no asistió." },
      "hours-confirmed": { title: "🗓️ ¡Horario confirmado!", body: "Gracias - tus reservas ya siguen tu horario real. Puedes ajustarlo cuando quieras desde tu portal." },
      picked: { title: "✅ ¡Buena elección!", body: "Estamos confirmando tu hora exacta ahora mismo. Mira WhatsApp - tendrás 2-3 horarios entre los que elegir en breve, normalmente en menos de una hora. Pagas directamente al estudio. Sin comisión." },
      "studio-ok": { title: "✅ ¡Confirmado!", body: "El cliente ha recibido la confirmación automáticamente. Gracias - nos vemos pronto." },
      "studio-none": { title: "👍 Entendido", body: "Hemos avisado al equipo y buscaremos otra hora con el cliente. Gracias por responder." },
      error: { title: "⚠️ No se pudo completar la acción - inténtalo de nuevo con el enlace" },
      invalid: { title: "⚠️ Enlace no válido" },
    },
  },
  fr: {
    brand: "Massage Club",
    footer: "Massage Club · Madrid · book.massageclub.io",
    changeDate: "📅 Changer la date",
    clientDetailsHeader: "📋 Fiche client",
    clientLabel: "👤 Client :",
    serviceLabel: "💆 Service :",
    pressureLabel: "Pression :",
    focusLabel: "Zones à cibler :",
    extrasLabel: "Extras :",
    conversationLabel: "Conversation :",
    healthLabel: "⚠️ Santé :",
    notesLabel: "📝 Notes :",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 Préfère le silence", minimal: "Un peu de conversation", chatty: "Aime discuter" },
    outcomes: {
      confirmed: { title: "✅ Rendez-vous confirmé", body: "Nous avons prévenu le client." },
      declined: { title: "🗓️ Réservation refusée", body: "Nous avons demandé au client de choisir un autre horaire." },
      cancelled: { title: "🗓️ Réservation annulée", body: "Nous avons prévenu le studio. Vous pouvez réserver de nouveau quand vous voulez." },
      "already-confirmed": { title: "✅ Déjà confirmé" },
      "already-declined": { title: "🗓️ Déjà refusé" },
      "was-cancelled": { title: "⚠️ Cette réservation a été annulée et ne peut plus être confirmée" },
      completed: { title: "🎉 Visite terminée !", body: "Merci - la réservation est enregistrée comme terminée." },
      noshow: { title: "🕐 Client absent", body: "Nous avons enregistré que le client ne s'est pas présenté." },
      "hours-confirmed": { title: "🗓️ Horaires confirmés !", body: "Merci - vos réservations suivent désormais vos vrais horaires. Vous pouvez les ajuster à tout moment depuis votre portail." },
      picked: { title: "✅ Excellent choix !", body: "Nous confirmons votre horaire exact en ce moment même. Surveillez WhatsApp - vous aurez bientôt 2 à 3 créneaux au choix, en général en moins d'une heure. Vous payez directement le studio. Sans frais de réservation." },
      "studio-ok": { title: "✅ Confirmé", body: "Le client a reçu sa confirmation automatiquement. Merci." },
      "studio-none": { title: "👍 Compris", body: "Nous avons informé l'équipe et chercherons un autre créneau avec le client. Merci d'avoir répondu." },
      error: { title: "⚠️ Une erreur est survenue - veuillez réessayer le lien" },
      invalid: { title: "⚠️ Lien invalide" },
    },
  },
  de: {
    brand: "Massage Club",
    footer: "Massage Club · Madrid · book.massageclub.io",
    changeDate: "📅 Termin ändern",
    clientDetailsHeader: "📋 Kundendetails",
    clientLabel: "👤 Kunde:",
    serviceLabel: "💆 Leistung:",
    pressureLabel: "Druckstärke:",
    focusLabel: "Fokusbereiche:",
    extrasLabel: "Extras:",
    conversationLabel: "Gespräch:",
    healthLabel: "⚠️ Gesundheit:",
    notesLabel: "📝 Notizen:",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 Bevorzugt Stille", minimal: "Etwas Small Talk", chatty: "Unterhält sich gerne" },
    outcomes: {
      confirmed: { title: "✅ Termin bestätigt", body: "Wir haben den Kunden benachrichtigt." },
      declined: { title: "🗓️ Buchung abgelehnt", body: "Wir haben den Kunden gebeten, einen anderen Termin zu wählen." },
      cancelled: { title: "🗓️ Buchung storniert", body: "Wir haben das Studio informiert. Du kannst jederzeit erneut buchen." },
      "already-confirmed": { title: "✅ Bereits bestätigt" },
      "already-declined": { title: "🗓️ Bereits abgelehnt" },
      "was-cancelled": { title: "⚠️ Diese Buchung wurde storniert und kann nicht mehr bestätigt werden" },
      completed: { title: "🎉 Besuch abgeschlossen!", body: "Danke - die Buchung ist jetzt als abgeschlossen vermerkt." },
      noshow: { title: "🕐 Kunde nicht erschienen", body: "Wir haben vermerkt, dass der Kunde nicht erschienen ist." },
      "hours-confirmed": { title: "🗓️ Öffnungszeiten bestätigt!", body: "Danke - deine Buchungen folgen jetzt deinen echten Öffnungszeiten. Du kannst sie jederzeit über dein Portal anpassen." },
      picked: { title: "✅ Gute Wahl!", body: "Wir bestätigen gerade deine genaue Uhrzeit. Behalte WhatsApp im Auge - du bekommst gleich 2-3 Zeitfenster zur Auswahl, meist innerhalb einer Stunde. Du zahlst direkt im Studio. Keine Buchungsgebühr." },
      "studio-ok": { title: "✅ Bestätigt", body: "Der Kunde hat seine Bestätigung automatisch erhalten. Vielen Dank." },
      "studio-none": { title: "👍 Verstanden", body: "Wir haben das Team informiert und suchen mit dem Kunden einen anderen Termin. Danke für die Antwort." },
      error: { title: "⚠️ Etwas ist schiefgelaufen - bitte versuche den Link erneut" },
      invalid: { title: "⚠️ Ungültiger Link" },
    },
  },
  it: {
    brand: "Massage Club",
    footer: "Massage Club · Madrid · book.massageclub.io",
    changeDate: "📅 Cambia data",
    clientDetailsHeader: "📋 Scheda cliente",
    clientLabel: "👤 Cliente:",
    serviceLabel: "💆 Servizio:",
    pressureLabel: "Pressione:",
    focusLabel: "Zone da trattare:",
    extrasLabel: "Extra:",
    conversationLabel: "Conversazione:",
    healthLabel: "⚠️ Salute:",
    notesLabel: "📝 Note:",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 Preferisce il silenzio", minimal: "Un po' di chiacchiere", chatty: "Ama chiacchierare" },
    outcomes: {
      confirmed: { title: "✅ Appuntamento confermato", body: "Abbiamo avvisato il cliente." },
      declined: { title: "🗓️ Prenotazione rifiutata", body: "Abbiamo chiesto al cliente di scegliere un altro orario." },
      cancelled: { title: "🗓️ Prenotazione annullata", body: "Abbiamo avvisato lo studio. Puoi prenotare di nuovo quando vuoi." },
      "already-confirmed": { title: "✅ Già confermato" },
      "already-declined": { title: "🗓️ Già rifiutato" },
      "was-cancelled": { title: "⚠️ Questa prenotazione è stata annullata e non può più essere confermata" },
      completed: { title: "🎉 Visita completata!", body: "Grazie - la prenotazione è registrata come completata." },
      noshow: { title: "🕐 Cliente non presentato", body: "Abbiamo registrato che il cliente non si è presentato." },
      "hours-confirmed": { title: "🗓️ Orari confermati!", body: "Grazie - le tue prenotazioni ora seguono i tuoi orari reali. Puoi modificarli in qualsiasi momento dal tuo portale." },
      picked: { title: "✅ Ottima scelta!", body: "Stiamo confermando il tuo orario esatto in questo momento. Controlla WhatsApp - riceverai a breve 2-3 orari tra cui scegliere, di solito entro un'ora. Paghi direttamente lo studio. Nessuna commissione." },
      "studio-ok": { title: "✅ Confermato", body: "Il cliente ha ricevuto la conferma automaticamente. Grazie." },
      "studio-none": { title: "👍 Capito", body: "Abbiamo informato il team e cercheremo un altro orario con il cliente. Grazie per la risposta." },
      error: { title: "⚠️ Qualcosa è andato storto - riprova con il link" },
      invalid: { title: "⚠️ Link non valido" },
    },
  },
  pt: {
    brand: "Massage Club",
    footer: "Massage Club · Madrid · book.massageclub.io",
    changeDate: "📅 Alterar data",
    clientDetailsHeader: "📋 Ficha do cliente",
    clientLabel: "👤 Cliente:",
    serviceLabel: "💆 Serviço:",
    pressureLabel: "Pressão:",
    focusLabel: "Zonas a tratar:",
    extrasLabel: "Extras:",
    conversationLabel: "Conversa:",
    healthLabel: "⚠️ Saúde:",
    notesLabel: "📝 Notas:",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 Prefere silêncio", minimal: "Um pouco de conversa", chatty: "Gosta de conversar" },
    outcomes: {
      confirmed: { title: "✅ Marcação confirmada", body: "Já avisámos o cliente." },
      declined: { title: "🗓️ Reserva recusada", body: "Pedimos ao cliente para escolher outro horário." },
      cancelled: { title: "🗓️ Reserva cancelada", body: "Avisámos o estúdio. Podes reservar de novo quando quiseres." },
      "already-confirmed": { title: "✅ Já confirmado" },
      "already-declined": { title: "🗓️ Já recusado" },
      "was-cancelled": { title: "⚠️ Esta reserva foi cancelada e já não pode ser confirmada" },
      completed: { title: "🎉 Visita concluída!", body: "Obrigado - a reserva fica registada como concluída." },
      noshow: { title: "🕐 Cliente não compareceu", body: "Registámos que o cliente não compareceu." },
      "hours-confirmed": { title: "🗓️ Horário confirmado!", body: "Obrigado - as tuas reservas seguem agora o teu horário real. Podes ajustá-lo quando quiseres a partir do teu portal." },
      picked: { title: "✅ Ótima escolha!", body: "Estamos a confirmar a tua hora exata agora mesmo. Fica atento ao WhatsApp - vais receber em breve 2-3 horários à escolha, normalmente em menos de uma hora. Pagas diretamente ao estúdio. Sem taxa de reserva." },
      "studio-ok": { title: "✅ Confirmado", body: "O cliente recebeu a confirmação automaticamente. Obrigado." },
      "studio-none": { title: "👍 Entendido", body: "Avisámos a equipa e vamos procurar outro horário com o cliente. Obrigado por responderes." },
      error: { title: "⚠️ Algo correu mal - tenta novamente o link" },
      invalid: { title: "⚠️ Link inválido" },
    },
  },
  zh: {
    brand: "Massage Club",
    footer: "Massage Club · 马德里 · book.massageclub.io",
    changeDate: "📅 更改日期",
    clientDetailsHeader: "📋 客户信息",
    clientLabel: "👤 客户：",
    serviceLabel: "💆 服务：",
    pressureLabel: "力度：",
    focusLabel: "重点部位：",
    extrasLabel: "附加项目：",
    conversationLabel: "交流偏好：",
    healthLabel: "⚠️ 健康：",
    notesLabel: "📝 备注：",
    whatsapp: "WhatsApp",
    conv: { silence: "🤫 喜欢安静", minimal: "偶尔聊聊", chatty: "喜欢聊天" },
    outcomes: {
      confirmed: { title: "✅ 预约已确认", body: "我们已通知客户。" },
      declined: { title: "🗓️ 预约已拒绝", body: "我们已通知客户另选时间。" },
      cancelled: { title: "🗓️ 预约已取消", body: "我们已通知门店。您可以随时重新预约。" },
      "already-confirmed": { title: "✅ 已确认过" },
      "already-declined": { title: "🗓️ 已拒绝过" },
      "was-cancelled": { title: "⚠️ 此预约已被取消，无法再确认" },
      completed: { title: "🎉 服务已完成！", body: "谢谢 - 该预约已记录为已完成。" },
      noshow: { title: "🕐 客户未到店", body: "我们已记录客户未到店。" },
      "hours-confirmed": { title: "🗓️ 营业时间已确认！", body: "谢谢 - 您的预约现在将按照您的实际营业时间进行。您可以随时在门店后台调整。" },
      picked: { title: "✅ 选得好！", body: "我们正在为您确认具体时间。请留意 WhatsApp - 您很快会收到 2-3 个可选时间段，通常一小时内。您直接向门店付款，无预约费。" },
      "studio-ok": { title: "✅ 已确认", body: "系统已自动向客户发送确认。谢谢。" },
      "studio-none": { title: "👍 已知悉", body: "我们已通知团队，将与客户另约时间。感谢您的回复。" },
      error: { title: "⚠️ 操作未完成 - 请重试该链接" },
      invalid: { title: "⚠️ 链接无效" },
    },
  },
};

function convLabel(conv: string, c: Copy): string {
  switch (conv) {
    case "silence":
      return c.conv.silence;
    case "minimal":
      return c.conv.minimal;
    case "chatty":
      return c.conv.chatty;
    default:
      return conv;
  }
}

export default function BookingResult() {
  const lang = useFlowLang();
  const c = COPY[lang];

  const params = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [],
  );

  const oRaw = getParam(params, "o");
  const outcome: Outcome = (KNOWN as string[]).includes(oRaw) ? (oRaw as Outcome) : "invalid";
  const studio = getParam(params, "studio");
  const serviceRaw = getParam(params, "service");
  const service = serviceRaw ? localizedServiceName(serviceRaw, lang) : "";
  const dateRaw = getParam(params, "date");
  const timeRaw = getParam(params, "time");
  const parsedDate = dateRaw ? parseISODate(dateRaw) : null;
  const date = parsedDate ? shortDate(parsedDate, lang) : dateRaw;
  const time = timeRaw
    ? (() => {
        const m = /^(\d{1,2}):(\d{2})/.exec(timeRaw);
        if (!m) return timeRaw;
        const d = new Date();
        d.setHours(Number(m[1]), Number(m[2]), 0, 0);
        return formatTimeLabel(d, lang);
      })()
    : "";
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

  const oc = c.outcomes[outcome];
  const title = oc.title;
  const body = oc.body || "";

  let summary = "";
  let showRebookBtn = false;

  switch (outcome) {
    case "confirmed":
    case "declined":
    case "already-confirmed":
    case "already-declined":
    case "completed":
    case "noshow":
      summary = summaryFull;
      break;
    case "cancelled":
      summary = summaryNoName;
      showRebookBtn = true;
      break;
    default:
      break;
  }

  const icon = title.match(/^\S+/)?.[0] || "⚠️";
  const titleText = title.replace(/^\S+\s*/, "");

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
          {c.brand}
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
            {titleText}
          </h1>

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
                {c.clientDetailsHeader}
              </div>

              {(name || ph || em) && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.clientLabel}</span>{" "}
                  {name && <span>{name}</span>}
                  {ph && looksLikePhone(ph) && (
                    <>
                      {" · "}
                      <a
                        href={telHref(ph) || undefined}
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
                            {c.whatsapp}
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
                    {c.serviceLabel}
                  </span>{" "}
                  {[service, dur && formatMinutesLabel(dur, lang), pr && `€${pr}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}

              {press && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.pressureLabel}</span>{" "}
                  {press}
                </div>
              )}

              {focus && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.focusLabel}</span>{" "}
                  {focus}
                </div>
              )}

              {addons && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.extrasLabel}</span> {addons}
                </div>
              )}

              {conv && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.conversationLabel}</span>{" "}
                  {convLabel(conv, c)}
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
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.healthLabel}</span>{" "}
                  {health}
                </div>
              )}

              {notes && (
                <div>
                  <span style={{ color: "#B85C38", fontWeight: 600 }}>{c.notesLabel}</span>{" "}
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
              {c.changeDate}
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
          {c.footer}
        </div>
      </div>
    </div>
  );
}

function formatMinutesLabel(dur: string, lang: FlowLang): string {
  const n = Number(dur);
  if (!Number.isFinite(n)) return dur;
  const units: Record<FlowLang, string> = {
    en: "min",
    es: "min",
    fr: "min",
    de: "Min.",
    it: "min",
    pt: "min",
    zh: "分钟",
  };
  return `${n} ${units[lang]}`;
}
