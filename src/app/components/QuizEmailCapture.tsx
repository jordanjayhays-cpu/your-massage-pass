import { useState } from "react";
import { Check, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { submitQuizLead } from "@/lib/marketingOptIn";

/**
 * Optional inline email capture on the quiz result screen.
 * The result is never gated behind this field.
 */
export default function QuizEmailCapture({ resultSlug }: { resultSlug: string }) {
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").slice(0, 2) === "es";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const label = es ? "Envíame mi resultado" : "Email me my match";
  const placeholder = es ? "tu@email.com" : "you@email.com";
  const thanks = es ? "¡Enviado! Revisa tu correo pronto." : "Sent. Check your inbox soon.";
  const failed = es ? "No se pudo guardar. Inténtalo otra vez." : "Could not save. Please try again.";

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#C4622D]/10 flex items-center justify-center">
          <Check className="h-4 w-4 text-[#C4622D]" />
        </div>
        <p className="text-sm text-[#5a4736]">{thanks}</p>
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
        {label}
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
          className="h-11 w-11 shrink-0 rounded-full bg-[#C4622D] text-white flex items-center justify-center disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-xs text-red-600">{failed}</p>}
    </form>
  );
}
