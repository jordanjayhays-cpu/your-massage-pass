import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackAccountCreatedConversion, isFreshlyCreatedUser } from "@/lib/adsConversion";
import { useFlowLang, type FlowLang } from "@/lib/flowLang";

type State = "working" | "ok" | "failed";

const COPY: Record<FlowLang, {
  signingIn: string;
  welcome: string;
  expiredTitle: string;
  expiredBody: string;
  signInLink: string;
}> = {
  en: {
    signingIn: "Signing you in...",
    welcome: "Welcome to Massage Club",
    expiredTitle: "This link has expired",
    expiredBody: "Ask for a new link with your email and sign in with one tap.",
    signInLink: "Sign in with email",
  },
  es: {
    signingIn: "Iniciando sesión...",
    welcome: "Bienvenido a Massage Club",
    expiredTitle: "Este enlace ha caducado",
    expiredBody: "Pide un enlace nuevo con tu email y entra en un toque.",
    signInLink: "Entrar con email",
  },
  fr: {
    signingIn: "Connexion en cours...",
    welcome: "Bienvenue chez Massage Club",
    expiredTitle: "Ce lien a expiré",
    expiredBody: "Demande un nouveau lien avec ton email et connecte-toi en un clic.",
    signInLink: "Se connecter par email",
  },
  de: {
    signingIn: "Du wirst angemeldet...",
    welcome: "Willkommen bei Massage Club",
    expiredTitle: "Dieser Link ist abgelaufen",
    expiredBody: "Fordere einen neuen Link mit deiner E-Mail an und melde dich mit einem Tipp an.",
    signInLink: "Mit E-Mail anmelden",
  },
  it: {
    signingIn: "Accesso in corso...",
    welcome: "Benvenuto su Massage Club",
    expiredTitle: "Questo link è scaduto",
    expiredBody: "Richiedi un nuovo link con la tua email e accedi con un tocco.",
    signInLink: "Accedi con email",
  },
  pt: {
    signingIn: "A iniciar sessão...",
    welcome: "Bem-vindo ao Massage Club",
    expiredTitle: "Este link expirou",
    expiredBody: "Pede um novo link com o teu email e entra num toque.",
    signInLink: "Entrar com email",
  },
  zh: {
    signingIn: "正在登录…",
    welcome: "欢迎加入 Massage Club",
    expiredTitle: "此链接已过期",
    expiredBody: "用你的邮箱申请一个新链接，一键登录。",
    signInLink: "用邮箱登录",
  },
};

/**
 * Landing page for the "Open my account" button in our welcome emails.
 * Exchanges the ?th= token hash for a real session, then sends the
 * customer into the app signed in.
 */
export default function Welcome() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const lang = useFlowLang();
  const t = COPY[lang];
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    let cancelled = false;
    const tokenHash = params.get("th");
    const run = async () => {
      if (!tokenHash) {
        if (!cancelled) setState("failed");
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
      if (cancelled) return;
      if (error) {
        setState("failed");
        return;
      }
      // Welcome links land brand-new accounts; count the conversion once.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (isFreshlyCreatedUser(user?.created_at, 24 * 60 * 60 * 1000)) trackAccountCreatedConversion();
      } catch {
        /* ignore */
      }
      setState("ok");

      window.setTimeout(() => {
        if (!cancelled) navigate("/", { replace: true });
      }, 1400);
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: "#FAF6F1" }}>
      <div className="w-full max-w-sm rounded-3xl bg-white border p-8 text-center" style={{ borderColor: "#E6DCCF" }}>
        {state === "working" && (
          <>
            <Loader2 size={28} className="mx-auto animate-spin" style={{ color: "#B85C38" }} />
            <h1 className="mt-4 text-lg font-semibold" style={{ color: "#2b2b2b" }}>
              {t.signingIn}
            </h1>
          </>
        )}

        {state === "ok" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#EFE6DA" }}>
              <Check size={24} style={{ color: "#B85C38" }} />
            </div>
            <h1 className="mt-4 text-xl font-semibold" style={{ color: "#2b2b2b" }}>
              {t.welcome}
            </h1>
          </>
        )}

        {state === "failed" && (
          <>
            <h1 className="text-xl font-semibold" style={{ color: "#2b2b2b" }}>
              {t.expiredTitle}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#7A7068" }}>
              {t.expiredBody}
            </p>
            <Link
              to="/login"
              className="mt-5 inline-flex items-center justify-center w-full h-12 rounded-2xl font-semibold"
              style={{ background: "#B85C38", color: "#fff" }}
            >
              {t.signInLink}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
