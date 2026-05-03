import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getStoredUser } from "./Login";

const SURVEY_STEPS = [
  {
    id: "q1",
    question: "How do you usually book a massage in Madrid?",
    subtitle: "Be honest — this helps us build something you'll actually use.",
    options: [
      { label: "WhatsApp / text the studio", value: "whatsapp" },
      { label: "Call the studio directly", value: "call" },
      { label: "Fresha, Treatwell or another platform", value: "fresha" },
      { label: "Walk in / no booking", value: "walkin" },
      { label: "I don't really book massages", value: "never" },
    ],
    multi: false,
  },
  {
    id: "q2",
    question: "What's the hardest part?",
    subtitle: "Pick the one that bugs you most.",
    options: [
      { label: "Can't find available times", value: "availability" },
      { label: "Back-and-forth messages to confirm", value: "messages" },
      { label: "Not knowing which studio to trust", value: "trust" },
      { label: "Price — it adds up fast", value: "price" },
      { label: "It's easy — no problems", value: "easy" },
    ],
    multi: false,
  },
  {
    id: "q3",
    question: "How often do you get a massage?",
    subtitle: "",
    options: [
      { label: "Weekly", value: "weekly" },
      { label: "Every 2–4 weeks", value: "biweekly" },
      { label: "Monthly", value: "monthly" },
      { label: "Every few months", value: "rarely" },
      { label: "First time / very rare", value: "first" },
    ],
    multi: false,
  },
  {
    id: "q4",
    question: "What would you actually pay?",
    subtitle: "Imagine an app where you browse studios, pick a time, and book instantly.",
    options: [
      { label: "€0 — only if it's free", value: "nothing" },
      { label: "€5–8 per booking", value: "5_8" },
      { label: "€9–12 per booking", value: "9_12" },
      { label: "€15+ per booking", value: "15plus" },
    ],
    multi: false,
  },
  {
    id: "q5",
    question: "Would a membership work for you?",
    subtitle: "Say €49/month for unlimited bookings. No per-session fees.",
    options: [
      { label: "Yes — I'd book more if it was unlimited", value: "yes" },
      { label: "Maybe — depends on the price", value: "maybe" },
      { label: "No — I'd rather pay per session", value: "nopay" },
    ],
    multi: false,
  },
  {
    id: "q6",
    question: "What matters most? Pick up to 3.",
    subtitle: "",
    options: [
      { label: "Real-time availability — book instantly", value: "availability" },
      { label: "Verified studio reviews", value: "reviews" },
      { label: "Price — cheaper than booking direct", value: "price" },
      { label: "Appointment reminders", value: "reminders" },
      { label: "Easy cancellation", value: "cancel" },
      { label: "Same-day bookings", value: "sameday" },
      { label: "Filter by neighborhood", value: "district" },
    ],
    multi: true,
    max: 3,
  },
];

export default function Survey() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = SURVEY_STEPS[step];
  const isMulti = current?.multi ?? false;
  const total = SURVEY_STEPS.length;

  const toggleOption = (value: string) => {
    if (!isMulti) {
      setSelected([value]);
    } else {
      const max = current.max ?? 3;
      if (selected.includes(value)) {
        setSelected(selected.filter((v) => v !== value));
      } else if (selected.length < max) {
        setSelected([...selected, value]);
      }
    }
  };

  const canContinue = selected.length > 0;

  const next = async () => {
    setAnswers((prev) => ({ ...prev, [current.id]: isMulti ? selected : selected[0] }));
    if (step + 1 < total) {
      setStep(step + 1);
      setSelected([]);
    } else {
      // Submit
      await handleSubmit({ ...answers, [current.id]: isMulti ? selected : selected[0] });
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string | string[]>) => {
    setSubmitting(true);
    const user = getStoredUser();
    const payload = {
      ...finalAnswers,
      email: user?.email ?? "",
      user_name: user?.name ?? "",
      source: "in_app_survey",
      submitted_at: new Date().toISOString(),
    };

    // Try to save to Supabase, but don't block on failure
    try {
      await supabase.from("survey_responses").insert([payload]);
    } catch (e) {
      console.error("Survey submit error:", e);
    }

    setSubmitting(false);
    setDone(true);
  };

  // Done state
  if (done) {
    return (
      <div className="flex flex-col h-full bg-gradient-warm p-8 items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">You're done.</h1>
        <p className="text-muted-foreground mt-2 max-w-xs text-sm">
          Thanks for being honest. This helps us build something you'll actually want to use.
        </p>
        <Button
          onClick={() => navigate("/app/massages")}
          className="w-full h-12 mt-8 bg-gradient-royal text-primary-foreground hover:opacity-90"
        >
          Back to studios
        </Button>
      </div>
    );
  }

  const progress = ((step) / total) * 100;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Quick survey</p>
          <h1 className="font-display text-lg font-bold">{current.question}</h1>
        </div>
        <span className="text-xs text-muted-foreground">{step + 1}/{total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {current.subtitle && (
          <p className="text-sm text-muted-foreground mb-5">{current.subtitle}</p>
        )}

        <div className="space-y-2">
          {current.options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                  isSelected
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-card border-border text-foreground hover:border-primary/50"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className={cn("text-sm font-medium", isSelected && "text-foreground")}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {isMulti && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {selected.length}/{current.max} selected
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border bg-card">
        <Button
          disabled={!canContinue || submitting}
          onClick={next}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
        >
          {submitting ? "Sending…" : step + 1 === total ? "Submit" : "Continue"}
        </Button>
        {step > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              const prev = SURVEY_STEPS[step - 1];
              setSelected(
                Array.isArray(answers[prev.id])
                  ? (answers[prev.id] as string[])
                  : answers[prev.id]
                  ? [(answers[prev.id] as string)]
                  : []
              );
              setStep(step - 1);
            }}
            className="w-full h-10 mt-1 text-muted-foreground"
          >
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
