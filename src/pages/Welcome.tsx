import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

type State = "working" | "ok" | "failed";

/**
 * Landing page for the "Open my account" button in our welcome emails.
 * Exchanges the ?th= token hash for a real session, then sends the
 * customer into the app signed in.
 */
export default function Welcome() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").slice(0, 2) === "es";
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
              {es ? "Iniciando sesión..." : "Signing you in..."}
            </h1>
          </>
        )}

        {state === "ok" && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#EFE6DA" }}>
              <Check size={24} style={{ color: "#B85C38" }} />
            </div>
            <h1 className="mt-4 text-xl font-semibold" style={{ color: "#2b2b2b" }}>
              {es ? "Bienvenido a Massage Club" : "Welcome to Massage Club"}
            </h1>
          </>
        )}

        {state === "failed" && (
          <>
            <h1 className="text-xl font-semibold" style={{ color: "#2b2b2b" }}>
              {es ? "Este enlace ha caducado" : "This link has expired"}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#7A7068" }}>
              {es
                ? "Pide un enlace nuevo con tu email y entra en un toque."
                : "Ask for a new link with your email and sign in with one tap."}
            </p>
            <Link
              to="/app"
              className="mt-5 inline-flex items-center justify-center w-full h-12 rounded-2xl font-semibold"
              style={{ background: "#B85C38", color: "#fff" }}
            >
              {es ? "Entrar con email" : "Sign in with email"}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
