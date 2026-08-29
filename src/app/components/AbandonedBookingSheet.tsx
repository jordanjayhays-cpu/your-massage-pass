import { useEffect, useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";
import { useFlowLang } from "@/lib/flowLang";

const SESSION_KEY = "mc_booking_lead_sheet";

function alreadyHandled() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function markHandled() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

const COPY = {
  en: {
    title: "Want us to hold this?",
    body: "Leave your email and we will save your booking details and help you finish, no commitment.",
    invalidEmail: "Enter a valid email",
    saveFailed: "Could not save. Please try again.",
    savedTitle: "Saved",
    savedBody: "We will email you to help you finish.",
    save: "Save my booking",
    noThanks: "No thanks",
  },
  es: {
    title: "¿Te lo guardamos?",
    body: "Déjanos tu email y guardamos los detalles de tu reserva y te ayudamos a terminar, sin compromiso.",
    invalidEmail: "Escribe un email válido",
    saveFailed: "No se pudo guardar. Inténtalo otra vez.",
    savedTitle: "Guardado",
    savedBody: "Te escribiremos para ayudarte a terminar.",
    save: "Guardar mi reserva",
    noThanks: "No, gracias",
  },
  fr: {
    title: "On vous le garde ?",
    body: "Laissez votre email, on enregistre les détails de votre réservation et on vous aide à terminer, sans engagement.",
    invalidEmail: "Saisissez un email valide",
    saveFailed: "Impossible d'enregistrer. Réessayez.",
    savedTitle: "Enregistré",
    savedBody: "Nous vous écrirons pour vous aider à terminer.",
    save: "Enregistrer ma réservation",
    noThanks: "Non merci",
  },
  de: {
    title: "Sollen wir das für dich merken?",
    body: "Hinterlasse deine E-Mail, wir speichern deine Buchungsdetails und helfen dir beim Abschluss, ganz unverbindlich.",
    invalidEmail: "Bitte eine gültige E-Mail eingeben",
    saveFailed: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    savedTitle: "Gespeichert",
    savedBody: "Wir schreiben dir, um dir beim Abschluss zu helfen.",
    save: "Meine Buchung speichern",
    noThanks: "Nein danke",
  },
  it: {
    title: "Vuoi che lo teniamo da parte?",
    body: "Lasciaci la tua email, salviamo i dettagli della tua prenotazione e ti aiutiamo a finire, senza impegno.",
    invalidEmail: "Inserisci un'email valida",
    saveFailed: "Impossibile salvare. Riprova.",
    savedTitle: "Salvato",
    savedBody: "Ti scriveremo per aiutarti a finire.",
    save: "Salva la mia prenotazione",
    noThanks: "No grazie",
  },
  pt: {
    title: "Queres que guardemos isto?",
    body: "Deixa o teu email e guardamos os detalhes da tua reserva e ajudamos-te a terminar, sem compromisso.",
    invalidEmail: "Escreve um email válido",
    saveFailed: "Não foi possível guardar. Tenta outra vez.",
    savedTitle: "Guardado",
    savedBody: "Vamos escrever-te para te ajudar a terminar.",
    save: "Guardar a minha reserva",
    noThanks: "Não, obrigado",
  },
  zh: {
    title: "需要我们帮你保留吗？",
    body: "留下你的邮箱，我们会保存你的预约信息并帮助你完成预约，无需承诺。",
    invalidEmail: "请输入有效的邮箱",
    saveFailed: "保存失败，请重试。",
    savedTitle: "已保存",
    savedBody: "我们会发邮件帮助你完成预约。",
    save: "保存我的预约",
    noThanks: "不用了",
  },
} as const;

/**
 * Abandoned-booking capture trigger.
 * Fires at most once per session, only for signed-out visitors who already
 * picked a day and time and have not completed the booking.
 * Triggers: exit intent / tab hidden (navigating away) or 45s idle on the final step.
 */
export function useAbandonedBookingCapture(opts: {
  /** Visitor is invested: past the date and time step, with both chosen. */
  eligible: boolean;
  /** Visitor is on the last wizard step. */
  onFinalStep: boolean;
  /** Never show for signed-in users or after a completed booking. */
  disabled: boolean;
}) {
  const { eligible, onFinalStep, disabled } = opts;
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  const show = () => {
    if (alreadyHandled() || openRef.current) return;
    markHandled();
    setOpen(true);
  };

  // (a) Leaving the wizard: exit intent on desktop, tab hidden on mobile.
  useEffect(() => {
    if (disabled || !eligible || alreadyHandled()) return;
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") show();
    };
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, eligible]);

  // (b) Idle for 45s on the final step.
  useEffect(() => {
    if (disabled || !eligible || !onFinalStep || alreadyHandled()) return;
    let timer: number | undefined;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(show, 45000);
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => document.removeEventListener(ev, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, eligible, onFinalStep]);

  // Never keep it open once the booking completes.
  useEffect(() => {
    if (disabled && openRef.current) setOpen(false);
  }, [disabled]);

  return { open, close: () => setOpen(false) };
}

export default function AbandonedBookingSheet({
  open,
  onClose,
  slug,
  serviceName,
  date,
  time,
  defaultEmail,
}: {
  open: boolean;
  onClose: () => void;
  slug: string | null;
  serviceName: string | null;
  date: string | null;
  time: string | null;
  defaultEmail?: string;
}) {
  const lang = useFlowLang();
  const c = COPY[lang];
  const [email, setEmail] = useState(defaultEmail || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && defaultEmail && !email) setEmail(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 255) {
      setError(c.invalidEmail);
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("booking_leads").insert([
      {
        email: clean,
        partner_slug: slug,
        service_name: serviceName,
        booking_date: date,
        booking_time: time,
      },
    ]);
    setSaving(false);
    if (err) {
      setError(c.saveFailed);
      return;
    }
    trackEvent("lead_captured", { slug, meta: { service: serviceName, date, time } });
    setSaved(true);
    window.setTimeout(onClose, 1800);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center min-[900px]:items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        className="relative w-full min-[900px]:max-w-md bg-[#FAF6F1] rounded-t-3xl min-[900px]:rounded-3xl border-t min-[900px]:border border-[#EADFD2] shadow-2xl px-5 pt-4 pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#EADFD2] min-[900px]:hidden" />
        {saved ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#C4622D] text-white flex items-center justify-center">
              <Check size={20} />
            </div>
            <p className="font-semibold text-gray-800">{c.savedTitle}</p>
            <p className="text-sm text-[#8a7460]">{c.savedBody}</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900">{c.title}</h2>
            <p className="mt-1 text-sm text-[#8a7460]">{c.body}</p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="Email"
              maxLength={255}
              className="mt-4 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#C4622D]"
            />
            {error && <p className="mt-2 text-xs text-[#B03A2E]">{error}</p>}
            <button
              onClick={submit}
              disabled={saving}
              className="mt-3 w-full rounded-2xl bg-[#C4622D] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {c.save}
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full text-center text-xs text-[#8a7460] underline underline-offset-2"
            >
              {c.noThanks}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
