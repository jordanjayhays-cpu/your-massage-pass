import { useEffect, useState } from "react";
import { useFlowLang } from "@/lib/flowLang";
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
    bookingSub: "Track this request and rebook faster.",
    saveTitle: "Make a free account to save your favourite studios",
    saveButton: "Create my free account",
    emailLabel: "Your email",
    sent: "Check your email to finish. One tap.",
    invalid: "That email does not look right",
  },
  es: {
    bookingTitle: "Guarda tus datos para la próxima vez",
    bookingButton: "Crear mi cuenta gratis",
    bookingSub: "Sigue esta solicitud y repite más rápido.",
    saveTitle: "Crea una cuenta gratis para guardar tus centros favoritos",
    saveButton: "Crear mi cuenta gratis",
    emailLabel: "Tu email",
    sent: "Mira tu correo para terminar. Un toque.",
    invalid: "Ese email no parece correcto",
  },
  fr: {
    bookingTitle: "Enregistrez vos infos pour la prochaine fois",
    bookingButton: "Créer mon compte gratuit",
    bookingSub: "Suivez cette demande et réservez à nouveau plus vite.",
    saveTitle: "Créez un compte gratuit pour enregistrer vos studios préférés",
    saveButton: "Créer mon compte gratuit",
    emailLabel: "Votre email",
    sent: "Vérifiez votre email pour terminer. Un clic.",
    invalid: "Cet email ne semble pas correct",
  },
  de: {
    bookingTitle: "Speichere deine Daten für nächstes Mal",
    bookingButton: "Kostenloses Konto erstellen",
    bookingSub: "Verfolge diese Anfrage und buche schneller erneut.",
    saveTitle: "Erstelle ein kostenloses Konto, um deine Lieblingsstudios zu speichern",
    saveButton: "Kostenloses Konto erstellen",
    emailLabel: "Deine E-Mail",
    sent: "Schau in dein E-Mail-Postfach, um fertig zu werden. Ein Klick.",
    invalid: "Diese E-Mail sieht nicht richtig aus",
  },
  it: {
    bookingTitle: "Salva i tuoi dati per la prossima volta",
    bookingButton: "Crea il mio account gratuito",
    bookingSub: "Segui questa richiesta e riprenota più in fretta.",
    saveTitle: "Crea un account gratuito per salvare i tuoi centri preferiti",
    saveButton: "Crea il mio account gratuito",
    emailLabel: "La tua email",
    sent: "Controlla la tua email per finire. Un tocco.",
    invalid: "Questa email non sembra corretta",
  },
  pt: {
    bookingTitle: "Guarda os teus dados para a próxima vez",
    bookingButton: "Criar a minha conta grátis",
    bookingSub: "Acompanha este pedido e volta a reservar mais depressa.",
    saveTitle: "Cria uma conta grátis para guardar os teus estúdios favoritos",
    saveButton: "Criar a minha conta grátis",
    emailLabel: "O teu email",
    sent: "Confere o teu email para terminar. Um toque.",
    invalid: "Esse email não parece correto",
  },
  zh: {
    bookingTitle: "保存您的信息，方便下次预约",
    bookingButton: "创建我的免费账户",
    bookingSub: "跟进这次预约请求，下次预约更快。",
    saveTitle: "创建免费账户，收藏您喜欢的门店",
    saveButton: "创建我的免费账户",
    emailLabel: "您的邮箱",
    sent: "请查看您的邮箱以完成。只需一步。",
    invalid: "这个邮箱地址看起来不对",
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
  const lang = useFlowLang();
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
      /* the link send is best effort; we still tell them to check email */
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
