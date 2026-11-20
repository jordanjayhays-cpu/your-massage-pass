import { useState } from "react";
import { Check } from "lucide-react";
import { useFlowLang } from "@/lib/flowLang";
import {
  CONSENT_COPY,
  consentLang,
  saveConsent,
  type ConsentChoice,
  type ConsentLang,
  type ConsentSource,
  type SaveConsentInput,
} from "@/lib/marketingOptIn";

/**
 * The offers question (the Kelly rule, 19 Nov): the notice, a Privacy link
 * and two equal buttons, nothing pre-selected. Controlled, for forms: the
 * form saves the answer after its own request went through. A second tap on
 * the chosen button clears it, back to "not answered".
 */
export function ConsentQuestion({
  lang,
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  lang: ConsentLang;
  value: ConsentChoice | null;
  onChange: (v: ConsentChoice | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const c = CONSENT_COPY[lang];
  const btn = (v: ConsentChoice, label: string) => {
    const on = value === v;
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={() => onChange(on ? null : v)}
        className={`min-h-[44px] w-full rounded-full border px-3 py-2 text-sm font-semibold leading-tight transition disabled:opacity-60 ${
          on
            ? "border-[#B85C38] bg-[#FDF3EC] text-[#3d2b1f] shadow-[inset_0_0_0_1px_#B85C38]"
            : "border-gray-300 bg-white text-[#3d2b1f] hover:border-[#B85C38]"
        }`}
      >
        {on && <Check size={14} className="mr-1 inline-block align-[-2px]" aria-hidden="true" />}
        {label}
      </button>
    );
  };
  return (
    <div role="group" aria-label={c.notice} className={`rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4 text-left ${className}`}>
      <p className="text-sm leading-snug text-[#3d2b1f]">
        {c.notice}{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
          {c.privacy}
        </a>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {btn("yes", c.yes)}
        {btn("no", c.no)}
      </div>
    </div>
  );
}

export type ConsentSaveState = "idle" | "saving" | "done" | "error";

/** One answer saved on tap, with the state the view shows. */
export function useConsentSaver() {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [state, setState] = useState<ConsentSaveState>("idle");
  const save = async (input: SaveConsentInput): Promise<boolean> => {
    setChoice(input.choice);
    setState("saving");
    const res = await saveConsent(input);
    setState(res.ok ? "done" : "error");
    return res.ok;
  };
  return { choice, state, save };
}

/**
 * The question while it is open, then "Done" once the consent function
 * answered ok. A failed save keeps the buttons and says so.
 */
export function ConsentSaveView({
  lang,
  choice,
  state,
  onPick,
  className = "",
}: {
  lang: ConsentLang;
  choice: ConsentChoice | null;
  state: ConsentSaveState;
  onPick: (v: ConsentChoice) => void;
  className?: string;
}) {
  const c = CONSENT_COPY[lang];
  if (state === "done") {
    return (
      <div role="status" className={`rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4 text-left ${className}`}>
        <p className="flex items-start gap-2 text-sm leading-snug text-[#3d2b1f]">
          <Check size={16} className="mt-0.5 flex-shrink-0 text-[#B85C38]" aria-hidden="true" />
          <span>{choice === "yes" ? c.savedYes : c.savedNo}</span>
        </p>
      </div>
    );
  }
  return (
    <div className={className}>
      <ConsentQuestion
        lang={lang}
        value={state === "saving" ? choice : null}
        onChange={(v) => { if (v && state !== "saving") onPick(v); }}
        disabled={state === "saving"}
      />
      {state === "saving" && <p className="mt-2 text-sm text-[#8a7460]" role="status">{c.saving}</p>}
      {state === "error" && <p className="mt-2 text-sm text-[#B03A2E]" role="alert">{c.error}</p>}
    </div>
  );
}

type CardProps = {
  source: ConsentSource;
  email?: string | null;
  phone?: string | null;
  /** bookings.action_token, when the page has one (the review page). */
  token?: string | null;
  bookingRef?: string | null;
  requestId?: number | string | null;
  /** Page language; anything but Spanish shows the English notice. */
  lang?: string | null;
  /** Profile: the session's access token, sent so the function can check the account. */
  getAccessToken?: () => Promise<string | null>;
  /** Called once the answer is saved (a retry card hides its error line). */
  onSaved?: (choice: ConsentChoice) => void;
  className?: string;
};

/**
 * The question saved the moment it is tapped (review thank-you page, profile,
 * a booking whose answer could not be saved). Replaces the 19 Nov card that
 * wrote to a table that did not exist and said "Done" anyway.
 */
export default function MarketingOptInCard({
  source,
  email,
  phone,
  token,
  bookingRef,
  requestId,
  lang,
  getAccessToken,
  onSaved,
  className = "",
}: CardProps) {
  const flowLang = useFlowLang();
  const L = consentLang(lang ?? flowLang);
  const saver = useConsentSaver();
  if (!email && !phone && !token) return null;
  const pick = async (v: ConsentChoice) => {
    const accessToken = getAccessToken ? await getAccessToken().catch(() => null) : null;
    const ok = await saver.save({ choice: v, source, lang: L, email, phone, token, bookingRef, requestId, accessToken });
    if (ok) onSaved?.(v);
  };
  return (
    <ConsentSaveView
      className={className}
      lang={L}
      choice={saver.choice}
      state={saver.state}
      onPick={(v) => void pick(v)}
    />
  );
}
