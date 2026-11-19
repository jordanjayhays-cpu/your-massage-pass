import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useFlowLang } from "@/lib/flowLang";
import { supabase } from "@/lib/supabase";
import { CONSENT_COPY, consentLang } from "@/lib/marketingOptIn";
import MarketingOptInCard, { ConsentSaveView, useConsentSaver } from "./MarketingOptInCard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Under the quiz result: the offers question (the Kelly rule, 19 Nov).
 *
 * Until 19 Nov this box promised to email the match ("Sent. Check your inbox
 * soon.") and saved it into quiz_leads and profiles.quiz_result_slug, which do
 * not exist live; nothing ever sent a match. It now only asks about offers,
 * through the consent function (source "quiz"), and says "Done" only when
 * that save answered ok. The quiz result itself is never gated, and it is no
 * longer stored anywhere.
 */
export default function QuizEmailCapture(_props: { resultSlug: string }) {
  const L = consentLang(useFlowLang());
  const c = CONSENT_COPY[L];
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [declined, setDeclined] = useState(false);
  const saver = useConsentSaver();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserEmail(data?.user?.email ?? null);
      setChecking(false);
    }).catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  if (checking) return null;

  // Signed in: the account's email, saved on tap.
  if (userEmail) return <MarketingOptInCard source="quiz" email={userEmail} lang={L} />;

  // "No thanks" with no email typed: nothing to save, nothing claimed.
  if (declined) {
    return (
      <div role="status" className="rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4">
        <p className="flex items-center gap-2 text-sm text-[#5a4736]">
          <Check className="h-4 w-4 text-[#C4622D]" aria-hidden="true" /> {c.noThanksNoEmail}
        </p>
      </div>
    );
  }

  const done = saver.state === "done";
  return (
    <div className={done ? "" : "rounded-2xl border border-[#E5DDD3] bg-[#FBF7F2] p-4"}>
      {!done && (
        <>
          <label htmlFor="quiz-email" className="text-sm font-semibold text-[#3d2b1f]">{c.emailLabel}</label>
          <input
            id="quiz-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={255}
            value={email}
            disabled={saver.state === "saving"}
            onChange={(e) => { setEmail(e.target.value); setNeedEmail(false); }}
            placeholder={L === "es" ? "tu@email.com" : "you@email.com"}
            aria-invalid={needEmail}
            aria-describedby={needEmail ? "quiz-email-err" : undefined}
            className="mt-2 h-11 w-full rounded-full border border-[#E5DDD3] bg-white px-4 text-base outline-none focus:border-[#C4622D]"
          />
          {needEmail && <p id="quiz-email-err" role="alert" className="mt-1.5 text-sm text-[#B03A2E]">{c.emailNeeded}</p>}
        </>
      )}
      <ConsentSaveView
        className={done ? "" : "mt-3 [&>[role=group]]:border-0 [&>[role=group]]:bg-transparent [&>[role=group]]:p-0"}
        lang={L}
        choice={saver.choice}
        state={saver.state}
        onPick={(v) => {
          const e = email.trim();
          if (EMAIL_RE.test(e)) { void saver.save({ choice: v, source: "quiz", lang: L, email: e }); return; }
          if (v === "no" && !e) { setDeclined(true); return; }
          setNeedEmail(true);
        }}
      />
    </div>
  );
}
