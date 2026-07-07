import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      { value: "tourist", label: "Tourist visiting" },
      { value: "local", label: "Local resident" },
    ],
  },
  {
    key: "last_massage",
    question: "When did you last get a massage in Madrid?",
    options: [
      { value: "never", label: "Never" },
      { value: "six_months_plus", label: "6+ months ago" },
      { value: "recent_months", label: "In the last few months" },
      { value: "monthly_plus", label: "Monthly or more" },
    ],
  },
  {
    key: "frustration",
    question: "Biggest frustration when booking a massage here?",
    options: [
      { value: "trust", label: "Finding a trustworthy place" },
      { value: "english", label: "Booking in English" },
      { value: "prices", label: "Knowing real prices" },
      { value: "availability", label: "Availability & scheduling" },
      { value: "none", label: "I have no frustration" },
    ],
  },
  {
    key: "channel",
    question: "How do you find massages now?",
    options: [
      { value: "google_maps", label: "Google Maps" },
      { value: "instagram", label: "Instagram" },
      { value: "treatwell_booksy", label: "Treatwell/Booksy" },
      { value: "word_of_mouth", label: "Hotel or word of mouth" },
      { value: "dont", label: "I don't" },
    ],
  },
  {
    key: "language",
    question: "Would you rather book in…",
    options: [
      { value: "english", label: "English" },
      { value: "spanish", label: "Spanish" },
      { value: "either", label: "Either" },
    ],
  },
  {
    key: "budget",
    question: "What would you typically pay for a 60-min massage?",
    options: [
      { value: "under_40", label: "Under €40" },
      { value: "40_60", label: "€40–60" },
      { value: "60_90", label: "€60–90" },
      { value: "90_plus", label: "€90+" },
    ],
  },
  {
    key: "intent",
    question: "If you could book a top-rated massage near you in under a minute, how likely would you use it?",
    options: [
      { value: "definitely", label: "Definitely" },
      { value: "probably", label: "Probably" },
      { value: "probably_not", label: "Probably not" },
    ],
  },
];

export default function SurveyCustomers() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = QUESTIONS.every((q) => answers[q.key]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payloadAnswers: Record<string, string> = { ...answers };
    if (comments.trim()) {
      payloadAnswers.comments = comments.trim();
    }
    const { error } = await supabase.from("validation_responses").insert([
      { survey_type: "b2c", answers: payloadAnswers, email: email.trim() || null },
    ]);
    setSubmitting(false);
    if (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  };

  const shellStyle: React.CSSProperties = {
    background: "linear-gradient(180deg,#F7F4F0 0%,#EFE7DD 100%)",
    color: "#211C1A",
    fontFamily: "'Outfit', system-ui, sans-serif",
    minHeight: "100vh",
  };
  const serif = { fontFamily: "'Fraunces', serif" };

  if (done) {
    return (
      <div style={shellStyle} className="flex items-center justify-center px-6">
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-md w-full text-center py-16">
          <div className="text-5xl mb-4">🙏</div>
          <h1 style={serif} className="text-4xl mb-3">Thanks!</h1>
          <p className="text-[#7A7068] mb-8">Want to browse Madrid's best studios?</p>
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

  const answered = Object.keys(answers).length;
  const progress = Math.round((answered / QUESTIONS.length) * 100);

  return (
    <div style={shellStyle}>
      <link href={FONT_CSS} rel="stylesheet" />
      <div className="max-w-xl mx-auto px-5 py-10">
        <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068] mb-3">Madrid · Quick survey</p>
        <h1 style={serif} className="text-4xl leading-[1.05] mb-2">Help shape the best massage app in Madrid.</h1>
        <p className="text-[#7A7068] mb-6">7 quick questions. Takes 60 seconds.</p>

        {/* progress */}
        <div className="h-1.5 rounded-full bg-[#E5DDD3] mb-8 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "#C4622D" }}
          />
        </div>

        <div className="space-y-8">
          {QUESTIONS.map((q, i) => (
            <div key={q.key}>
              <p style={serif} className="text-xl mb-3">
                <span className="text-[#E0A458] mr-2">{String(i + 1).padStart(2, "0")}</span>
                {q.question}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const selected = answers[q.key] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers({ ...answers, [q.key]: opt.value })}
                      className="px-4 py-2 rounded-full text-sm border transition"
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
            </div>
          ))}

          <div>
            <p style={serif} className="text-xl mb-3">Leave your email for early access ✨</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full h-12 rounded-xl bg-white border border-[#E5DDD3] px-4 placeholder:text-[#9E9387]"
            />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full h-13 py-3 rounded-full text-base font-medium disabled:opacity-50 mt-4"
            style={{ background: "#C4622D", color: "#F7F4F0" }}
          >
            {submitting ? "Sending…" : canSubmit ? "Send answers" : `Answer all ${QUESTIONS.length} questions`}
          </button>
        </div>
      </div>
    </div>
  );
}
