import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const FONT_CSS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Outfit:wght@400;500;600&display=swap";

type Opt = { value: string; label: string };
type Q = { key: string; question: string; options: Opt[] };

const QUESTIONS: Q[] = [
  {
    key: "segment",
    question: "Which best describes you?",
    options: [
      { value: "expat", label: "Expat living in Madrid" },
      { value: "digital_nomad", label: "Digital nomad" },
      { value: "tourist", label: "Tourist visiting Madrid" },
      { value: "local", label: "Local resident" },
      { value: "student", label: "Student in Madrid" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "last_massage",
    question: "When did you last get a professional massage in Madrid?",
    options: [
      { value: "never", label: "Never" },
      { value: "last_30_days", label: "In the last 30 days" },
      { value: "recent_months", label: "In the last few months" },
      { value: "six_months_plus", label: "6+ months ago" },
      { value: "monthly_plus", label: "I get massages monthly or more" },
    ],
  },
  {
    key: "frustration",
    question: "What is your biggest frustration when trying to book a massage here?",
    options: [
      { value: "trust", label: "Finding a trustworthy place" },
      { value: "english", label: "Booking in English" },
      { value: "prices", label: "Knowing the real price before booking" },
      { value: "availability", label: "Finding availability soon" },
      { value: "which_type", label: "Not knowing which massage type to choose" },
      { value: "too_expensive", label: "Prices feel too high" },
      { value: "none", label: "I have no frustration" },
    ],
  },
  {
    key: "channel",
    question: "How do you currently find or book massages in Madrid?",
    options: [
      { value: "google_maps", label: "Google Maps" },
      { value: "instagram", label: "Instagram" },
      { value: "treatwell_booksy", label: "Treatwell / Booksy" },
      { value: "hotel", label: "Hotel recommendation" },
      { value: "word_of_mouth", label: "Word of mouth" },
      { value: "whatsapp_dm", label: "WhatsApp / direct message" },
      { value: "dont", label: "I don't currently book massages" },
    ],
  },
  {
    key: "known_types",
    question: "Which of these types of massage have you heard of?",
    options: [
      { value: "swedish", label: "Swedish / relaxation" },
      { value: "deep_tissue", label: "Deep tissue" },
      { value: "thai", label: "Thai" },
      { value: "sports", label: "Sports" },
      { value: "shiatsu", label: "Shiatsu" },
      { value: "hot_stone", label: "Hot stone" },
      { value: "lymphatic", label: "Lymphatic drainage" },
      { value: "reflexology", label: "Reflexology" },
      { value: "prenatal", label: "Prenatal" },
      { value: "none", label: "None of these" },
    ],
  },
  {
    key: "place",
    question: "Where would you prefer to get a massage?",
    options: [
      { value: "home", label: "At my apartment / home" },
      { value: "hotel", label: "At my hotel" },
      { value: "studio", label: "At a massage studio or spa" },
      { value: "gym", label: "At a gym / wellness center" },
      { value: "no_preference", label: "No preference" },
    ],
  },
  {
    key: "priority",
    question: "What matters most when choosing a massage provider?",
    options: [
      { value: "reviews", label: "Top reviews" },
      { value: "clear_prices", label: "Clear prices" },
      { value: "english_booking", label: "English-speaking booking" },
      { value: "same_day", label: "Same-day availability" },
      { value: "licensed", label: "Licensed or certified therapist" },
      { value: "proximity", label: "Close to me" },
      { value: "clean_space", label: "Clean and professional space" },
      { value: "easy_payment", label: "Easy online payment" },
    ],
  },
  {
    key: "budget",
    question: "What would you typically pay for a 60-minute massage in Madrid?",
    options: [
      { value: "under_40", label: "Under €40" },
      { value: "40_60", label: "€40–60" },
      { value: "60_80", label: "€60–80" },
      { value: "80_100", label: "€80–100" },
      { value: "100_plus", label: "€100+" },
    ],
  },
  {
    key: "intent",
    question: "If you could book a top-rated massage near you in under 60 seconds, how likely would you be to use it?",
    options: [
      { value: "definitely", label: "Definitely" },
      { value: "probably", label: "Probably" },
      { value: "maybe", label: "Maybe" },
      { value: "probably_not", label: "Probably not" },
      { value: "no", label: "No" },
    ],
  },
];

const BY_KEY: Record<string, Q> = Object.fromEntries(QUESTIONS.map((q) => [q.key, q]));

// Questions you can pick more than one answer for
const MULTI_KEYS = new Set(["frustration", "channel", "known_types", "place", "priority"]);

// The three rounds, by question key
const WAVES: string[][] = [
  ["segment", "last_massage", "frustration"],
  ["channel", "known_types", "place", "priority"],
  ["budget", "intent"],
];
const TOTAL_WAVES = WAVES.length;

// Skip logic: a question only shows if its rule passes.
// Example — if someone has NEVER had a massage, skip "how do you currently book".
const SHOW_IF: Record<string, (a: Record<string, string | string[]>) => boolean> = {
  channel: (a) => a.last_massage !== "never",
};

const shellStyle: React.CSSProperties = {
  background: "linear-gradient(180deg,#F7F4F0 0%,#EFE7DD 100%)",
  color: "#211C1A",
  fontFamily: "'Outfit', system-ui, sans-serif",
  minHeight: "100vh",
};
const serif = { fontFamily: "'Fraunces', serif" };

export default function SurveyCustomers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = (searchParams.get("src") || "").trim() || "direct";

  // Resume support: an emailed follow-up link carries ?rid=<id>&wave=2
  const ridParam = (searchParams.get("rid") || "").trim();
  const waveParam = parseInt(searchParams.get("wave") || "1", 10);
  const startWaveIndex = Math.min(Math.max((isNaN(waveParam) ? 1 : waveParam) - 1, 0), TOTAL_WAVES - 1);

  const [respondentId, setRespondentId] = useState<string>(ridParam || "");
  const [waveIndex, setWaveIndex] = useState<number>(startWaveIndex);
  const [step, setStep] = useState(0); // index within the current wave's visible questions
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"questions" | "email" | "wavedone" | "done">("questions");

  const waveNumber = waveIndex + 1;
  const isFirstWave = waveIndex === 0;
  const isLastWave = waveIndex === TOTAL_WAVES - 1;

  // Which questions in this wave actually show, given the answers so far
  const visible = WAVES[waveIndex]
    .map((k) => BY_KEY[k])
    .filter((q) => q && (!SHOW_IF[q.key] || SHOW_IF[q.key](answers)));

  const currentQ = visible[step];

  const isMulti = (q: Q) => MULTI_KEYS.has(q.key);
  const isSelected = (q: Q, value: string) => {
    const v = answers[q.key];
    return Array.isArray(v) ? v.includes(value) : v === value;
  };
  const isAnswered = (q: Q) => {
    const v = answers[q.key];
    return Array.isArray(v) ? v.length > 0 : !!v;
  };

  const pick = (q: Q, value: string) => {
    if (isMulti(q)) {
      const cur = (answers[q.key] as string[] | undefined) || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      setAnswers({ ...answers, [q.key]: next });
    } else {
      setAnswers({ ...answers, [q.key]: value });
      // single-select auto-advances
      setTimeout(() => advance(), 220);
    }
  };

  const advance = () => {
    if (step < visible.length - 1) {
      setStep(step + 1);
    } else {
      // finished the questions in this wave
      if (isFirstWave) setPhase("email");
      else submitWave();
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const submitWave = async () => {
    setSubmitting(true);
    const rid = respondentId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
    if (!respondentId) setRespondentId(rid);

    // Only this wave's answers go in the row
    const waveAnswers: Record<string, string | string[]> = {};
    for (const k of WAVES[waveIndex]) if (answers[k] != null) waveAnswers[k] = answers[k];
    if (isFirstWave && comments.trim()) waveAnswers.comments = comments.trim();

    const row = {
      survey_type: "b2c",
      answers: waveAnswers,
      email: isFirstWave ? email.trim() || null : null,
      source,
      respondent_id: rid,
      wave: waveNumber,
    };

    const { error } = await supabase.from("validation_responses").insert([row]);
    if (error) {
      console.error(error);
      setSubmitting(false);
      alert("Something went wrong. Please try again.");
      return;
    }

    // Notify the founder + (Phase 2) email the respondent their next-round link
    try {
      await supabase.functions.invoke("notify-survey-response", {
        body: {
          record: row,
          followup: isFirstWave && email.trim() && !isLastWave
            ? { email: email.trim(), respondent_id: rid, next_wave: waveNumber + 1 }
            : null,
        },
      });
    } catch (e) {
      console.error("notify failed", e);
    }

    setSubmitting(false);
    setPhase(isLastWave ? "done" : "wavedone");
  };

  const continueNextWave = () => {
    setWaveIndex(waveIndex + 1);
    setStep(0);
    setPhase("questions");
  };

  // ---------- DONE ----------
  if (phase === "done") {
    return (
      <div style={shellStyle} className="flex items-center justify-center px-6">
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-md w-full text-center py-16">
          <div className="text-5xl mb-4">🙏</div>
          <h1 style={serif} className="text-4xl mb-3">That's everything — thank you!</h1>
          <p className="text-[#7A7068] mb-8">You've helped shape the easiest way to book a massage in Madrid.</p>
          <button
            onClick={() => navigate("/app/massages")}
            className="w-full h-13 py-3 rounded-full text-base font-medium"
            style={{ background: "#C4622D", color: "#F7F4F0" }}
          >
            Browse studios →
          </button>
        </div>
      </div>
    );
  }

  // ---------- WAVE COMPLETE ----------
  if (phase === "wavedone") {
    return (
      <div style={shellStyle} className="flex items-center justify-center px-6">
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-md w-full text-center py-16">
          <div className="text-5xl mb-4">⚡</div>
          <h1 style={serif} className="text-3xl mb-2">Round {waveNumber} of {TOTAL_WAVES} done!</h1>
          <p className="text-[#7A7068] mb-8">
            {email.trim()
              ? "We'll email you the next round too — or keep going right now."
              : "Keep the momentum — just a couple more."}
          </p>
          <button
            onClick={continueNextWave}
            className="w-full h-13 py-3 rounded-full text-base font-medium mb-3"
            style={{ background: "#C4622D", color: "#F7F4F0" }}
          >
            Continue to round {waveNumber + 1} →
          </button>
          <button onClick={() => navigate("/app/massages")} className="text-sm text-[#7A7068] underline">
            I'll finish later
          </button>
        </div>
      </div>
    );
  }

  // ---------- EMAIL CAPTURE (end of round 1) ----------
  if (phase === "email") {
    return (
      <div style={shellStyle}>
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-xl mx-auto px-5 py-10">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068] mb-3">Round 1 of {TOTAL_WAVES} · almost there</p>
          <h1 style={serif} className="text-3xl leading-tight mb-2">Nice — where should we send the next rounds? ✨</h1>
          <p className="text-[#7A7068] mb-6">Leave your email and we'll send you rounds 2 &amp; 3 (2 minutes total) plus early access. Optional, but it helps a lot.</p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 placeholder:text-[#9E9387] mb-4"
          />

          <p style={serif} className="text-lg mb-2">Anything else? (optional)</p>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="What would make booking a massage amazing for you?"
            rows={3}
            className="w-full rounded-xl bg-white border border-[#E5DDD3] p-3 placeholder:text-[#9E9387] mb-5"
          />

          <button
            onClick={submitWave}
            disabled={submitting}
            className="w-full h-13 py-3 rounded-full text-base font-medium disabled:opacity-50"
            style={{ background: "#C4622D", color: "#F7F4F0" }}
          >
            {submitting ? "Saving…" : email.trim() ? "Save & continue →" : "Skip email & continue →"}
          </button>
          <button onClick={back} className="w-full text-sm text-[#7A7068] underline mt-3">← Back</button>
        </div>
      </div>
    );
  }

  // ---------- QUESTIONS (one at a time) ----------
  const globalStep = visible.length ? step + 1 : 1;
  const progress = Math.round((globalStep / (visible.length || 1)) * 100);

  return (
    <div style={shellStyle}>
      <link href={FONT_CSS} rel="stylesheet" />
      <div className="max-w-xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068]">
            Round {waveNumber} of {TOTAL_WAVES}
          </p>
          <p className="text-[11px] text-[#7A7068]">Question {globalStep} / {visible.length}</p>
        </div>

        {/* progress */}
        <div className="h-1.5 rounded-full bg-[#E5DDD3] mb-10 overflow-hidden">
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: "#C4622D" }} />
        </div>

        {currentQ && (
          <div key={currentQ.key}>
            <h1 style={serif} className="text-3xl leading-[1.15] mb-2">{currentQ.question}</h1>
            <p className="text-xs text-[#7A7068] mb-6">
              {isMulti(currentQ) ? "Choose all that apply, then Next." : "Tap your answer."}
            </p>

            <div className="flex flex-wrap gap-2.5">
              {currentQ.options.map((opt) => {
                const selected = isSelected(currentQ, opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => pick(currentQ, opt.value)}
                    className="px-4 py-3 rounded-2xl text-base border transition"
                    style={{
                      background: selected ? "#C4622D" : "#FFFFFF",
                      color: selected ? "#F7F4F0" : "#211C1A",
                      borderColor: selected ? "#C4622D" : "#E5DDD3",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-10">
              {step > 0 && (
                <button onClick={back} className="h-12 px-5 rounded-full text-sm text-[#7A7068] border border-[#E5DDD3] bg-white">
                  ← Back
                </button>
              )}
              {isMulti(currentQ) && (
                <button
                  onClick={advance}
                  disabled={!isAnswered(currentQ)}
                  className="flex-1 h-12 rounded-full text-base font-medium disabled:opacity-40"
                  style={{ background: "#C4622D", color: "#F7F4F0" }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
