import { useEffect, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { submitQuizLead, saveQuizResultToProfile } from "@/lib/marketingOptIn";
import { supabase } from "@/lib/supabase";

/**
 * Save your match, on the quiz result screen.
 * The result itself is never gated: this is an offer sitting underneath it.
 */
export default function QuizEmailCapture({ resultSlug }: { resultSlug: string }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const es = (i18n.language || "en").slice(0, 2) === "es";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const u = data?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setChecking(false);
    }).catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  const title = es ? "Guarda tu resultado" : "Save your match";
  const label = es ? "Envíame mi resultado" : "Email me my match";
  const placeholder = es ? "tu@email.com" : "you@email.com";
  const helper = es
    ? "Te enviamos tu resultado y los estudios que lo ofrecen en Madrid."
    : "We will send your match and the studios that offer it in Madrid.";
  const thanks = es ? "¡Enviado! Revisa tu correo pronto." : "Sent. Check your inbox soon.";
  const savedToProfile = es
    ? "Guardado en tu perfil. Lo tendrás siempre a mano."
    : "Saved to your profile. It will always be there.";
  const upsell = es
    ? "¿Lo quieres guardado en un perfil? Créalo en 20 segundos."
    : "Want it saved to a profile? Create one in 20 seconds.";
  const failed = es ? "No se pudo guardar. Inténtalo otra vez." : "Could not save. Please try again.";

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#C4622D]/10 flex items-center justify-center flex-shrink-0">
            <Check className="h-4 w-4 text-[#C4622D]" />
          </div>
          <p className="text-sm text-[#5a4736]">{user ? savedToProfile : thanks}</p>
        </div>
        {!user && (
          <div className="mt-3">
            <p className="text-sm text-[#5a4736]">{upsell}</p>
            <button
              type="button"
              onClick={() => navigate("/login?create=1")}
              className="mt-2 inline-flex items-center justify-center h-11 px-5 rounded-full bg-[#C4622D] text-white text-sm font-semibold"
            >
              {es ? "Crear perfil gratis" : "Create a free profile"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Signed in: no email field, one tap to keep the match on the profile.
  if (!checking && user) {
    return (
      <div className="rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4">
        <p className="text-sm font-semibold text-[#3d2b1f]">{title}</p>
        <p className="mt-1 text-xs text-[#7A7068]">{helper}</p>
        <button
          type="button"
          disabled={state === "saving"}
          onClick={async () => {
            setState("saving");
            const ok = await saveQuizResultToProfile(user.id, user.email, resultSlug);
            setState(ok ? "done" : "error");
          }}
          className="mt-3 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-[#C4622D] text-white text-sm font-semibold disabled:opacity-50"
        >
          {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {es ? "Guardar en mi perfil" : "Save to my profile"}
        </button>
        {state === "error" && <p className="mt-2 text-xs text-red-600">{failed}</p>}
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || state === "saving") return;
        setState("saving");
        const ok = await submitQuizLead(email, resultSlug);
        setState(ok ? "done" : "error");
      }}
    >
      <label htmlFor="quiz-email" className="text-sm font-semibold text-[#3d2b1f]">
        {title}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="quiz-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="h-11 flex-1 min-w-0 rounded-full border border-[#E5DDD3] bg-white px-4 text-sm outline-none focus:border-[#C4622D]"
        />
        <button
          type="submit"
          disabled={!valid || state === "saving"}
          aria-label={label}
          className="h-11 shrink-0 rounded-full bg-[#C4622D] text-white px-4 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
        >
          {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">{label}</span>
        </button>
      </div>
      <p className="mt-2 text-xs text-[#7A7068]">{helper}</p>
      {state === "error" && <p className="mt-2 text-xs text-red-600">{failed}</p>}
    </form>
  );
}
