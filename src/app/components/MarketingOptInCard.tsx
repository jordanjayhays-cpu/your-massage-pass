import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { submitMarketingOptIn, type MarketingOptInSource } from "@/lib/marketingOptIn";

type Props = {
  email: string | null;
  userId?: string | null;
  source: MarketingOptInSource;
  bookingRef?: string | null;
  className?: string;
};

/**
 * "One email a month" opt-in card.
 * Shown once after a successful booking and at the end of profile setup.
 */
export default function MarketingOptInCard({
  email,
  userId,
  source,
  bookingRef,
  className = "",
}: Props) {
  const { i18n } = useTranslation();
  const es = (i18n.language || "en").slice(0, 2) === "es";
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  if (!email && !userId) return null;

  const heading = es ? "Un correo al mes" : "One email a month";
  const body = es
    ? "Nuevos estudios, ofertas para estudiantes y qué probar después. Nada de spam."
    : "New studios, student deals, and what to try next. No spam ever.";
  const cta = es ? "Apúntame" : "Count me in";
  const thanks = es ? "¡Hecho! Te escribimos una vez al mes." : "Done. We will write once a month.";

  return (
    <div
      className={`rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4 text-left ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-[#C4622D]/10 flex items-center justify-center">
          {state === "done" ? (
            <Check className="h-4 w-4 text-[#C4622D]" />
          ) : (
            <Mail className="h-4 w-4 text-[#C4622D]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#3d2b1f]">{heading}</p>
          <p className="mt-0.5 text-sm text-[#8a7460] leading-snug">
            {state === "done" ? thanks : body}
          </p>
          {state !== "done" && (
            <button
              type="button"
              disabled={state === "saving"}
              onClick={async () => {
                setState("saving");
                await submitMarketingOptIn({ email, userId, source, bookingRef });
                setState("done");
              }}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#C4622D] px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
