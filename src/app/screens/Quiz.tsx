import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUIZ, MASSAGE_TYPES, MassageType, MASSAGES } from "../data";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Quiz() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<MassageType, number>>({
    swedish: 0,
    deep: 0,
    stone: 0,
    sports: 0,
    thai: 0,
    lomi: 0,
  });
  const [done, setDone] = useState(false);

  const total = QUIZ.length;
  const current = QUIZ[step];

  const pickOption = (opt: (typeof current.options)[number]) => {
    const next = { ...scores };
    Object.entries(opt.scores).forEach(([k, v]) => {
      next[k as MassageType] = (next[k as MassageType] ?? 0) + (v ?? 0);
    });
    setScores(next);
    if (step + 1 < total) setStep(step + 1);
    else setDone(true);
  };

  const reset = () => {
    setScores({ swedish: 0, deep: 0, stone: 0, sports: 0, thai: 0, lomi: 0 });
    setStep(0);
    setDone(false);
  };

  const winnerType = (Object.entries(scores) as [MassageType, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const winner = MASSAGE_TYPES.find((t) => t.id === winnerType);
  const matchingStudios = MASSAGES.filter((m) => m.type === winnerType);

  if (done && winner) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
          <button
            onClick={() => navigate("/discovery")}
            aria-label="Back"
            className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs text-muted-foreground">Your result</p>
            <h1 className="font-display text-lg font-bold">Your perfect match</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative h-56">
            <img src={winner.image} alt={winner.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <div className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Best match
              </div>
              <h2 className="font-display text-3xl font-bold text-primary-foreground mt-2">{winner.name}</h2>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            <p className="text-foreground/85 leading-relaxed">{winner.description}</p>

            {matchingStudios.length > 0 && (
              <div>
                <h3 className="font-display text-lg font-semibold mb-3">Try it in Madrid</h3>
                <div className="space-y-2">
                  {matchingStudios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/massages/${s.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary transition text-left"
                    >
                      <img src={s.image} alt={s.studio} className="h-14 w-14 rounded-lg object-cover" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{s.studio}</p>
                        <p className="text-xs text-muted-foreground">{s.district} · {s.duration} min</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={reset}
              className="w-full h-11"
            >
              <RefreshCw className="h-4 w-4" /> Retake quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button
          onClick={() => navigate("/discovery")}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Question {step + 1} of {total}</p>
          <div className="mt-1.5 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-royal transition-all duration-500"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <h2 className="font-display text-2xl font-bold text-foreground mb-6">{current.question}</h2>
        <div className="space-y-3">
          {current.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => pickOption(opt)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all",
              )}
            >
              <span className="font-medium text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
