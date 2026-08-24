import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/siteVisit";

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
  const { i18n } = useTranslation();
  const es = (i18n.resolvedLanguage || "en").startsWith("es");
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
      setError(es ? "Escribe un email válido" : "Enter a valid email");
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
      setError(es ? "No se pudo guardar. Inténtalo otra vez." : "Could not save. Please try again.");
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
        aria-label={es ? "¿Te lo guardamos?" : "Want us to hold this?"}
        className="relative w-full min-[900px]:max-w-md bg-[#FAF6F1] rounded-t-3xl min-[900px]:rounded-3xl border-t min-[900px]:border border-[#EADFD2] shadow-2xl px-5 pt-4 pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#EADFD2] min-[900px]:hidden" />
        {saved ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#C4622D] text-white flex items-center justify-center">
              <Check size={20} />
            </div>
            <p className="font-semibold text-gray-800">{es ? "Guardado" : "Saved"}</p>
            <p className="text-sm text-[#8a7460]">
              {es ? "Te escribiremos para ayudarte a terminar." : "We will email you to help you finish."}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900">
              {es ? "¿Te lo guardamos?" : "Want us to hold this?"}
            </h2>
            <p className="mt-1 text-sm text-[#8a7460]">
              {es
                ? "Déjanos tu email y guardamos los detalles de tu reserva y te ayudamos a terminar, sin compromiso."
                : "Leave your email and we will save your booking details and help you finish, no commitment."}
            </p>
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
              {es ? "Guardar mi reserva" : "Save my booking"}
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full text-center text-xs text-[#8a7460] underline underline-offset-2"
            >
              {es ? "No, gracias" : "No thanks"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
