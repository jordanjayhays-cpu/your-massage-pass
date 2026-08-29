import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { isValidEmail } from "@/lib/contactValidation";
import { trackFunnel } from "@/lib/funnel";
import { savePendingAccount } from "@/lib/pendingAccount";

type Variant = "booking" | "save";

type Props = {
  variant?: Variant;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  requestId?: string | null;
  source: string;
  className?: string;
};

const COPY = {
  en: {
    bookingTitle: "Save your details for next time",
    bookingButton: "Create my free account",
    bookingSub: "Track this booking, rebook in two taps, and get member prices when we have them.",
    saveTitle: "Make a free account to save studios and hear when we get a good price",
    saveButton: "Create my free account",
    emailLabel: "Your email",
    sent: "Check your email to finish - one tap",
    invalid: "That email does not look right",
  },
  es: {
    bookingTitle: "Guarda tus datos para la próxima vez",
    bookingButton: "Crear mi cuenta gratis",
    bookingSub: "Sigue tu reserva, repite en dos toques y recibe precios de socio cuando los tengamos.",
    saveTitle: "Crea una cuenta gratis para guardar centros y enterarte cuando consigamos un buen precio",
    saveButton: "Crear mi cuenta gratis",
    emailLabel: "Tu email",
    sent: "Mira tu correo para terminar - un toque",
    invalid: "Ese email no parece correcto",
  },
} as const;

/**
 * The account offer. Never a form asking for what they already typed: if the
 * booking gave us an email it is one tap, otherwise we ask for the email only.
 * Magic link / OTP by email, no password anywhere. Inline, never a modal.
 */
export default function AccountOfferBlock({
  variant = "booking",
  firstName,
  lastName,
  email,
  phone,
  requestId,
  source,
  className = "",
}: Props) {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2) === "es" ? "es" : "en";
  const t = COPY[lang];

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (signedIn !== false) return null;

  const knownEmail = (email || "").trim();
  const effectiveEmail = (knownEmail || typedEmail).trim().toLowerCase();

  const submit = async () => {
    if (!isValidEmail(effectiveEmail)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setState("sending");
    savePendingAccount({
      firstName: firstName || null,
      lastName: lastName || null,
      email: effectiveEmail,
      phone: phone || null,
      requestId: requestId || null,
      source,
    });
    trackFunnel("account_offer_tapped", { source, variant });
    try {
      await supabase.functions.invoke("email-auth", {
        body: {
          action: "signup",
          email: effectiveEmail,
          name: [firstName, lastName].filter(Boolean).join(" ").trim() || null,
          lang,
        },
      });
    } catch {
      /* the link send is best effort - we still tell them to check email */
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <p className={`text-center text-sm text-muted-foreground ${className}`}>{t.sent}</p>
    );
  }

  const title = variant === "save" ? t.saveTitle : t.bookingTitle;
  const button = variant === "save" ? t.saveButton : t.bookingButton;

  return (
    <div className={`rounded-2xl border border-border/60 bg-card/60 p-4 text-left ${className}`}>
      <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
      {!knownEmail && (
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={typedEmail}
          onChange={(e) => {
            setTypedEmail(e.target.value);
            if (invalid) setInvalid(false);
          }}
          placeholder={t.emailLabel}
          aria-invalid={invalid}
          className={`mt-3 h-11 w-full rounded-full border bg-background px-4 text-sm text-foreground ${
            invalid ? "border-2 border-destructive" : "border-border"
          }`}
        />
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={state === "sending"}
        className="mt-3 h-12 w-full rounded-full bg-primary text-primary-foreground font-semibold shadow-sm disabled:opacity-60"
      >
        {button}
      </button>
      {invalid && <p className="mt-1.5 text-xs text-destructive">{t.invalid}</p>}
      {variant === "booking" && (
        <p className="mt-2 text-xs text-muted-foreground leading-snug">{t.bookingSub}</p>
      )}
    </div>
  );
}
