import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useFlowLang } from "@/lib/flowLang";
import { consentEmail, consentLang, consentPhone, stopByContact, withdrawConsent } from "@/lib/marketingOptIn";

/**
 * book.massageclub.io/unsubscribe
 *
 * The one-tap stop that every promotional email links to (the Kelly rule,
 * 19 Nov; LSSI art. 21.2 and 22.1), and the place anyone can stop offers
 * without a link (GDPR art. 7.3: withdrawing where you said yes).
 *
 *   With a link: /unsubscribe#u=<u>&s=<sig> (or ?u=&s=, as the consent
 *   function's unsubscribeUrl() builds it). u is the sealed token or the
 *   address, s its signature. The page reads them once and strips them from
 *   the address bar right after, so they stay out of history, and neither the
 *   Google tag nor Clarity ever loads on this path (index.html,
 *   src/lib/clarity.ts NO_TAG_PATHS). One button: a POST, never a GET, so a
 *   mail scanner that opens links unsubscribes nobody.
 *
 *   Without a link (from the privacy page or the footer): the person types
 *   the email or WhatsApp number we write to, and taps Stop offers.
 *
 * "Done" only when the consent function answered ok. A failure says how else
 * to stop (support@massageclub.io).
 */
export const UNSUBSCRIBE_COPY = {
  en: {
    title: "Stop offers from Massage Club",
    body: "Tap below and Massage Club will stop sending you offers and reminders to book again, by email and WhatsApp. Messages about a booking you make still reach you.",
    forWho: "For",
    button: "Stop offers",
    saving: "Saving…",
    done: "Done. Massage Club will not send you offers or reminders to book again any more, by email or WhatsApp. Messages about a booking you make still reach you.",
    broken: "That link did not work. You can stop offers below, or write to support@massageclub.io and we will stop them.",
    failed: "We could not save that. Please try again, or write to support@massageclub.io and we will stop the offers.",
    formBody: "Type the email or WhatsApp number we write to, and Massage Club will stop sending you offers and reminders to book again, by email and WhatsApp. Messages about a booking you make still reach you.",
    formLabel: "Your email or WhatsApp number",
    formPh: "you@email.com or +34 600 000 000",
    formErr: "Check it: an email like name@gmail.com, or a phone with its country code, like +34.",
    formFailed: "We could not save that here. Write to support@massageclub.io and we will stop the offers.",
    pageTitle: "Stop offers · Massage Club",
  },
  es: {
    title: "Dejar de recibir ofertas de Massage Club",
    body: "Toca abajo y Massage Club dejará de enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp. Los mensajes sobre una reserva que hagas te seguirán llegando.",
    forWho: "Para",
    button: "Dejar de recibir ofertas",
    saving: "Guardando…",
    done: "Hecho. Massage Club ya no te enviará ofertas ni recordatorios para volver a reservar, ni por email ni por WhatsApp. Los mensajes sobre una reserva que hagas te seguirán llegando.",
    broken: "Ese enlace no ha funcionado. Puedes darte de baja aquí abajo o escribirnos a support@massageclub.io y dejaremos de enviarte ofertas.",
    failed: "No se ha podido guardar. Inténtalo de nuevo o escríbenos a support@massageclub.io y dejaremos de enviarte ofertas.",
    formBody: "Escribe el email o el número de WhatsApp al que te escribimos y Massage Club dejará de enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp. Los mensajes sobre una reserva que hagas te seguirán llegando.",
    formLabel: "Tu email o tu número de WhatsApp",
    formPh: "tu@email.com o +34 600 000 000",
    formErr: "Revísalo: un email como nombre@gmail.com o un teléfono con su prefijo, como +34.",
    formFailed: "No se ha podido guardar aquí. Escríbenos a support@massageclub.io y dejaremos de enviarte ofertas.",
    pageTitle: "Dejar de recibir ofertas · Massage Club",
  },
} as const;

/** "name@example.com" -> "n•••@example.com", "34600123456" -> "•••••••3456", a sealed token -> "". */
export function maskContact(u: string): string {
  const v = (u || "").trim();
  const at = v.indexOf("@");
  if (at > 0) return `${v[0]}•••${v.slice(at)}`;
  const digits = v.replace(/\D/g, "");
  return digits.length > 4 ? `${"•".repeat(Math.min(7, digits.length - 4))}${digits.slice(-4)}` : "";
}

export type UnsubLink = { u: string; s: string; lang: string | null; tried: boolean };

/**
 * Reads u and s from the fragment (preferred: never sent to any server) or
 * the query. Pure, so React may call it twice (Strict Mode).
 */
export function readLink(): UnsubLink {
  if (typeof window === "undefined") return { u: "", s: "", lang: null, tried: false };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const pick = (k: string) => (hash.get(k) || query.get(k) || "").trim();
  const u = pick("u");
  const s = pick("s");
  const lang = hash.get("lang") || query.get("lang");
  return { u, s, lang, tried: !!(u || s) };
}

/** Removes the link from the address bar (and so from history), keeping only ?lang. */
export function stripLink(lang: string | null): void {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  if (!q.has("u") && !q.has("s") && !window.location.hash) return;
  try {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`);
  } catch {
    /* an old browser keeps the address; the tags still never load here */
  }
}

type State = "idle" | "saving" | "done" | "failed" | "broken" | "formFailed";

export default function Unsubscribe() {
  const [link] = useState<UnsubLink>(readLink);
  useEffect(() => stripLink(link.lang), [link.lang]);
  const flowLang = useFlowLang();
  const L = consentLang(link.lang || flowLang);
  const c = UNSUBSCRIBE_COPY[L];
  const linkOk = !!link.u && /^[0-9a-f]{32}$/i.test(link.s);
  // No usable link: the typed form, with the "link did not work" line when
  // someone did arrive with one.
  const [mode, setMode] = useState<"link" | "form">(linkOk ? "link" : "form");
  const [state, setState] = useState<State>(link.tried && !linkOk ? "broken" : "idle");
  const [typed, setTyped] = useState("");
  const [typedErr, setTypedErr] = useState(false);

  useEffect(() => {
    document.title = c.pageTitle;
    // Keep search engines out.
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

  const stopLink = async () => {
    if (state === "saving") return;
    setState("saving");
    const res = await withdrawConsent(link.u, link.s, { lang: L, wording: c.body });
    if (res.ok) setState("done");
    else if (/^(bad_link|http_4\d\d)/.test(res.error || "")) { setMode("form"); setState("broken"); }
    else setState("failed");
  };

  const stopTyped = async () => {
    if (state === "saving") return;
    const v = typed.trim();
    const okShape = v.includes("@") ? !!consentEmail(v) : !!consentPhone(v) && v.replace(/\D/g, "").length >= 8;
    if (!okShape) { setTypedErr(true); return; }
    setTypedErr(false);
    setState("saving");
    const res = await stopByContact(v, { lang: L, wording: c.formBody });
    setState(res.ok ? "done" : "formFailed");
  };

  const masked = maskContact(link.u);
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
        ) : mode === "link" ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5C5349]">{c.body}</p>
            {masked && <p className="mt-3 text-sm text-[#8A7460]">{c.forWho} {masked}</p>}
            <button
              type="button"
              onClick={() => void stopLink()}
              disabled={state === "saving"}
              className="mt-6 w-full min-h-[52px] rounded-full bg-[#B85C38] px-6 text-base font-semibold text-white disabled:opacity-70"
            >
              {state === "saving" ? c.saving : c.button}
            </button>
            {state === "failed" && (
              <p role="alert" className="mt-3 text-sm text-[#B03A2E]">{c.failed}</p>
            )}
          </>
        ) : (
          <form
            noValidate
            className="mt-3 text-left"
            onSubmit={(e) => { e.preventDefault(); void stopTyped(); }}
          >
            {state === "broken" && (
              <p role="alert" className="mt-3 rounded-2xl border border-[#E5DDD3] bg-white p-4 text-[15px] leading-relaxed text-[#3d2b1f]">
                {c.broken}
              </p>
            )}
            <p className="mt-3 text-[15px] leading-relaxed text-[#5C5349]">{c.formBody}</p>
            <label htmlFor="unsub-contact" className="mt-5 block text-sm font-semibold text-[#3d2b1f]">{c.formLabel}</label>
            <input
              id="unsub-contact"
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => { setTyped(e.target.value); if (typedErr) setTypedErr(false); }}
              placeholder={c.formPh}
              aria-invalid={typedErr}
              aria-describedby={typedErr ? "unsub-contact-err" : undefined}
              className="mt-1.5 w-full min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base focus:outline-none focus:border-[#B85C38]"
            />
            {typedErr && <p id="unsub-contact-err" role="alert" className="mt-1.5 text-sm text-[#B03A2E]">{c.formErr}</p>}
            <button
              type="submit"
              disabled={state === "saving"}
              className="mt-5 w-full min-h-[52px] rounded-full bg-[#B85C38] px-6 text-base font-semibold text-white disabled:opacity-70"
            >
              {state === "saving" ? c.saving : c.button}
            </button>
            {state === "formFailed" && (
              <p role="alert" className="mt-3 text-sm text-[#B03A2E]">{c.formFailed}</p>
            )}
          </form>
        )}

        <a href="/privacy" className="mt-8 inline-block text-sm text-[#8A7460] underline underline-offset-4">
          {L === "es" ? "Privacidad" : "Privacy"}
        </a>
      </main>
    </div>
  );
}
