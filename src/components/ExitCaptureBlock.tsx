import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isValidEmail } from "@/lib/contactValidation";
import { trackEvent } from "@/lib/siteVisit";
import { trackFunnel } from "@/lib/funnel";

const LEAD_ENDPOINT = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/lead";

const COPY = {
  en: {
    line: "Not ready to book? We will email you when we find a good price on this.",
    placeholder: "Your email",
    button: "Email me deals",
    consent:
      "By joining you agree we can email you about massage deals in Madrid. Unsubscribe any time.",
    done: "Done, we will be in touch",
    invalid: "That email does not look right",
  },
  es: {
    line: "¿No quieres reservar ahora? Te avisamos cuando consigamos un buen precio.",
    placeholder: "Tu email",
    button: "Avisadme de ofertas",
    consent:
      "Al unirte aceptas que te enviemos ofertas de masajes en Madrid. Puedes darte de baja cuando quieras.",
    done: "Listo, te avisamos",
    invalid: "Ese email no parece correcto",
  },
} as const;

type Props = {
  source: string;
  want?: string | null;
  area?: string | null;
  className?: string;
};

/**
 * Quiet exit-capture: for people about to drop out of a booking flow.
 * Sits below the main action, never interrupts. Carries across whatever
 * preferences they have already told us (want / area).
 */
export default function ExitCaptureBlock({ source, want, area, className = "" }: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || "en").slice(0, 2) === "es" ? "es" : "en";
  const t = COPY[lang];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [invalid, setInvalid] = useState(false);

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setState("saving");
    try {
      await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "waitlist",
          email: clean,
          want: want || undefined,
          area: area || undefined,
          lang,
          consent: true,
          consent_text: t.consent,
          source,
        }),
      });
    } catch {
      /* still show done - the lead function is best-effort */
    }
    trackEvent("exit_capture_submit", { meta: { source, has_want: !!want, has_area: !!area } });
    setState("done");
  };

  if (state === "done") {
    return (
      <p className={`text-center text-sm text-muted-foreground ${className}`}>{t.done}</p>
    );
  }

  return (
    <div className={`rounded-2xl border border-border/60 bg-card/60 p-4 ${className}`}>
      <p className="text-center text-sm text-muted-foreground leading-snug">{t.line}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (invalid) setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={t.placeholder}
          aria-invalid={invalid}
          className={`h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm text-foreground ${
            invalid ? "border-2 border-destructive" : "border-border"
          }`}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={state === "saving"}
          className="h-11 shrink-0 rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5 transition disabled:opacity-60"
        >
          {t.button}
        </button>
      </div>
      {invalid && <p className="mt-1.5 text-center text-xs text-destructive">{t.invalid}</p>}
      <p className="mt-2 text-center text-[11px] text-muted-foreground/80 leading-snug">
        {t.consent}
      </p>
    </div>
  );
}
