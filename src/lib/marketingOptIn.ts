import { trackEvent } from "@/lib/siteVisit";

/**
 * THE KELLY RULE (Jordan, 19 Nov; CLAUDE.md). Every booking path asks, with
 * two equal buttons and nothing pre-selected, whether Massage Club may send
 * offers. The booking goes ahead whatever the answer (LOPDGDD 6.3). Each
 * answer is saved by the `consent` edge function into marketing_optins, with
 * the exact words shown, their language, the source and the time (GDPR
 * art. 7: we must be able to prove it). Promotions go only to a "yes".
 *
 * Contract shared with the bot (supabase/functions/consent/index.ts):
 *   POST {choice, source, wording, lang, email?, phone?, token?, booking_ref?, request_id?}
 *   POST {action: "withdraw", u, s}
 *   -> {ok: true} on success; anything else is a failure.
 * The browser never writes the table: RLS gives anon no policy on it.
 *
 * Every save here retries once, and a failure is tracked
 * (consent_save_error) and logged, and the caller shows it. Never "Done"
 * unless the function answered ok.
 */

export const CONSENT_URL = "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/consent";

export type ConsentChoice = "yes" | "no";
export type ConsentSource =
  | "go_page"
  | "studio_booking"
  | "studio_request"
  | "payment"
  | "review_page"
  | "profile"
  | "bot"
  | "quiz"
  | "unsubscribe";
export type ConsentLang = "en" | "es";

/**
 * The notice and buttons (fixed wording, 19 Nov). `notice` is saved word for
 * word with every answer, so change it only together with the bot and
 * public/go.html, never per page.
 */
export const CONSENT_COPY = {
  en: {
    notice:
      "Can Massage Club send you offers and reminders to book again, by email and WhatsApp? You can stop any time with one tap, or by writing to support@massageclub.io.",
    yes: "Yes, send me offers",
    no: "No thanks",
    privacy: "Privacy",
    saving: "Saving…",
    savedYes: "Done. You can stop any time with one tap, or by writing to support@massageclub.io.",
    savedNo: "Done. We will not send you offers.",
    error: "Could not save your answer. Please try again.",
    emailLabel: "Your email",
    emailNeeded: "Add your email first, for example name@gmail.com",
    noThanksNoEmail: "No problem.",
    notSaved: "We could not save your answer about offers. Please choose again.",
  },
  es: {
    notice:
      "¿Puede Massage Club enviarte ofertas y recordatorios para volver a reservar, por email y WhatsApp? Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.",
    yes: "Sí, quiero ofertas",
    no: "No, gracias",
    privacy: "Privacidad",
    saving: "Guardando…",
    savedYes: "Hecho. Puedes darte de baja cuando quieras con un toque o escribiendo a support@massageclub.io.",
    savedNo: "Hecho. No te enviaremos ofertas.",
    error: "No se ha podido guardar tu respuesta. Inténtalo de nuevo.",
    emailLabel: "Tu email",
    emailNeeded: "Primero añade tu email, por ejemplo nombre@gmail.com",
    noThanksNoEmail: "Sin problema.",
    notSaved: "No se ha podido guardar tu respuesta sobre las ofertas. Elige otra vez, por favor.",
  },
} as const;

/** The notice exists in English and Spanish only: Spanish pages get Spanish, every other language English. */
export function consentLang(raw?: string | null): ConsentLang {
  return String(raw || "").toLowerCase().startsWith("es") ? "es" : "en";
}

export type SaveConsentInput = {
  choice: ConsentChoice;
  source: ConsentSource;
  lang: ConsentLang;
  email?: string | null;
  phone?: string | null;
  /** bookings.action_token: the function reads the email and booking_ref itself. */
  token?: string | null;
  bookingRef?: string | null;
  requestId?: number | string | null;
};

export type ConsentResult = { ok: boolean; error?: string };

type Deps = { fetchImpl?: typeof fetch; retryDelayMs?: number };

/** The body sent to the function, or null when there is no way to tie the answer to a person. */
export function consentBody(input: SaveConsentInput): Record<string, unknown> | null {
  const email = (input.email || "").trim().toLowerCase() || undefined;
  const phone = (input.phone || "").replace(/\D/g, "") || undefined;
  const token = (input.token || "").trim() || undefined;
  if (!email && !phone && !token) return null;
  const rid = Number(input.requestId);
  return {
    choice: input.choice,
    source: input.source,
    wording: CONSENT_COPY[input.lang].notice,
    lang: input.lang,
    email,
    phone,
    token,
    booking_ref: (input.bookingRef || "").trim() || undefined,
    request_id: Number.isSafeInteger(rid) && rid > 0 ? rid : undefined,
  };
}

async function postOnce(body: Record<string, unknown>, fetchImpl: typeof fetch): Promise<ConsentResult> {
  try {
    const r = await fetchImpl(CONSENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && (j as { ok?: unknown }).ok === true) return { ok: true };
    return { ok: false, error: `http_${r.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e || "network").slice(0, 80) };
  }
}

/** POST, and once more after a short pause if the first try failed. */
async function postWithRetry(body: Record<string, unknown>, deps: Deps): Promise<ConsentResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const first = await postOnce(body, fetchImpl);
  if (first.ok) return first;
  await new Promise((ok) => setTimeout(ok, deps.retryDelayMs ?? 1500));
  return postOnce(body, fetchImpl);
}

/**
 * Saves one yes or no. Never throws. On failure it tracks
 * consent_save_error and logs it; the caller must show the failure.
 */
export async function saveConsent(input: SaveConsentInput, deps: Deps = {}): Promise<ConsentResult> {
  const body = consentBody(input);
  if (!body) {
    trackEvent("consent_save_error", { meta: { source: input.source, choice: input.choice, error: "no_contact" } });
    console.error("[consent] no email, phone or booking token to save the answer with");
    return { ok: false, error: "no_contact" };
  }
  const res = await postWithRetry(body, deps);
  if (res.ok) {
    trackEvent("consent_saved", { meta: { source: input.source, choice: input.choice } });
  } else {
    trackEvent("consent_save_error", { meta: { source: input.source, choice: input.choice, error: res.error } });
    console.error("[consent] the offers answer was not saved", res.error);
  }
  return res;
}

/** One-tap unsubscribe: u is the email or phone from the link, s its signature. */
export async function withdrawConsent(u: string, s: string, deps: Deps = {}): Promise<ConsentResult> {
  const uu = (u || "").trim();
  const ss = (s || "").trim();
  if (!uu || !/^[0-9a-f]{32}$/i.test(ss)) return { ok: false, error: "bad_link" };
  const res = await postWithRetry({ action: "withdraw", u: uu, s: ss }, deps);
  if (res.ok) {
    trackEvent("consent_withdrawn", { meta: { source: "unsubscribe" } });
  } else {
    trackEvent("consent_save_error", { meta: { source: "unsubscribe", choice: "withdraw", error: res.error } });
    console.error("[consent] the unsubscribe was not saved", res.error);
  }
  return res;
}
