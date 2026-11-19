import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useFlowLang } from "@/lib/flowLang";
import { consentLang, withdrawConsent } from "@/lib/marketingOptIn";

/**
 * book.massageclub.io/unsubscribe?u=<email or phone>&s=<signature>
 *
 * The one-tap stop that every promotional email links to (the Kelly rule,
 * 19 Nov; LSSI art. 21.2 and 22.1). The link comes from unsubscribeUrl() in
 * the consent function: s is the first 32 hex of HMAC-SHA256(MC_SIGN_KEY, u).
 *
 * Nothing happens on load: link scanners in mail systems open links, so the
 * withdrawal needs the customer's tap (a POST, never a GET). No login. The
 * result is shown as it is: "Done" only when the consent function answered
 * ok, and a broken link says how else to stop (support@massageclub.io).
 */
export const UNSUBSCRIBE_COPY = {
  en: {
    title: "Stop offers from Massage Club",
    body: "Tap below and Massage Club will stop sending you offers and reminders to book again, by email and WhatsApp. Messages about a booking you make still reach you.",
    forWho: "For",
    button: "Stop offers",
    saving: "Saving…",
    done: "Done. Massage Club will not send you offers or reminders to book again any more, by email or WhatsApp. Messages about a booking you make still reach you.",
    broken: "That link did not work. Write to support@massageclub.io and we will stop the offers.",
    failed: "We could not save that. Please try again, or write to support@massageclub.io and we will stop the offers.",
    pageTitle: "Stop offers · Massage Club",
  },
  es: {
    title: "Dejar de recibir ofertas de Massage Club",
    body: "Toca abajo y Massage Club dejará de enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp. Los mensajes sobre una reserva que hagas te seguirán llegando.",
    forWho: "Para",
    button: "Dejar de recibir ofertas",
    saving: "Guardando…",
    done: "Hecho. Massage Club ya no te enviará ofertas ni recordatorios para volver a reservar, ni por email ni por WhatsApp. Los mensajes sobre una reserva que hagas te seguirán llegando.",
    broken: "Ese enlace no ha funcionado. Escríbenos a support@massageclub.io y dejaremos de enviarte ofertas.",
    failed: "No se ha podido guardar. Inténtalo de nuevo o escríbenos a support@massageclub.io y dejaremos de enviarte ofertas.",
    pageTitle: "Dejar de recibir ofertas · Massage Club",
  },
} as const;

/** "jordan@gmail.com" -> "j•••@gmail.com", "34600123456" -> "•••••••3456". */
export function maskContact(u: string): string {
  const v = (u || "").trim();
  const at = v.indexOf("@");
  if (at > 0) return `${v[0]}•••${v.slice(at)}`;
  const digits = v.replace(/\D/g, "");
  return digits.length > 4 ? `${"•".repeat(Math.min(7, digits.length - 4))}${digits.slice(-4)}` : "";
}

export default function Unsubscribe() {
  const params = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);
  const u = (params.get("u") || "").trim();
  const s = (params.get("s") || "").trim();
  const flowLang = useFlowLang();
  const L = consentLang(params.get("lang") || flowLang);
  const c = UNSUBSCRIBE_COPY[L];
  const linkOk = !!u && /^[0-9a-f]{32}$/i.test(s);
  const [state, setState] = useState<"idle" | "saving" | "done" | "failed" | "broken">(linkOk ? "idle" : "broken");

  useEffect(() => {
    document.title = c.pageTitle;
    // Keep search engines out: the page only makes sense from a signed link.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    const prev = meta.getAttribute("content");
    meta.setAttribute("content", "noindex, nofollow");
    return () => { if (prev) meta!.setAttribute("content", prev); };
  }, [c.pageTitle]);

  const stop = async () => {
    if (state === "saving") return;
    setState("saving");
    const res = await withdrawConsent(u, s);
    if (res.ok) setState("done");
    else setState(/^(bad_link|http_4\d\d)$/.test(res.error || "") ? "broken" : "failed");
  };

  const masked = maskContact(u);
  return (
    <div className="min-h-[100dvh] bg-[#FAF6F0] flex items-center justify-center px-6 py-10">
      <main className="w-full max-w-sm text-center">
        <p className="text-xs font-bold uppercase tracking-[2.5px] text-[#B85C38]">Massage Club</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-[#3D2B1F]">{c.title}</h1>

        {state === "done" ? (
          <div role="status" className="mt-6 rounded-2xl border border-[#E5DDD3] bg-white p-5 text-left">
            <p className="flex items-start gap-2 text-[15px] leading-relaxed text-[#3d2b1f]">
              <Check size={18} className="mt-0.5 flex-shrink-0 text-[#B85C38]" aria-hidden="true" />
              <span>{c.done}</span>
            </p>
          </div>
        ) : state === "broken" ? (
          <p role="alert" className="mt-6 rounded-2xl border border-[#E5DDD3] bg-white p-5 text-left text-[15px] leading-relaxed text-[#3d2b1f]">
            {c.broken}
          </p>
        ) : (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5C5349]">{c.body}</p>
            {masked && <p className="mt-3 text-sm text-[#8A7460]">{c.forWho} {masked}</p>}
            <button
              type="button"
              onClick={() => void stop()}
              disabled={state === "saving"}
              className="mt-6 w-full min-h-[52px] rounded-full bg-[#B85C38] px-6 text-base font-semibold text-white disabled:opacity-70"
            >
              {state === "saving" ? c.saving : c.button}
            </button>
            {state === "failed" && (
              <p role="alert" className="mt-3 text-sm text-[#B03A2E]">{c.failed}</p>
            )}
          </>
        )}

        <a href="/privacy" className="mt-8 inline-block text-sm text-[#8A7460] underline underline-offset-4">
          {L === "es" ? "Privacidad" : "Privacy"}
        </a>
      </main>
    </div>
  );
}
