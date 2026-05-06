import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextDays, TIME_SLOTS, MASSAGES } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { date, time, set, shop } = useBooking();
  // shop is set by MassageList when navigating through the app
  const massage = shop || MASSAGES.find((m) => m.id === id);
  const days = getNextDays(14);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">Select date & time</p>
          <h1 className="font-display text-lg font-bold">{massage?.name}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Choose a day</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6">
          {days.map((d) => {
            const selected = date === d.iso;
            const day = d.date.toLocaleDateString("en", { weekday: "short" });
            const num = d.date.getDate();
            return (
              <button
                key={d.iso}
                onClick={() => set({ date: d.iso, time: null })}
                className={cn(
                  "flex-shrink-0 w-14 h-20 rounded-2xl flex flex-col items-center justify-center border transition-all",
                  selected
                    ? "bg-gradient-royal text-primary-foreground border-primary shadow-elegant"
                    : "bg-card border-border text-foreground hover:border-primary/50",
                )}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">{day}</span>
                <span className="font-display text-2xl font-bold mt-1">{num}</span>
              </button>
            );
          })}
        </div>

        <h3 className="text-sm font-semibold text-foreground mt-6 mb-3">Available times</h3>
        {!date ? (
          <p className="text-sm text-muted-foreground">Pick a day first.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map((t) => {
              const selected = time === t;
              return (
                <button
                  key={t}
                  onClick={() => set({ time: t })}
                  className={cn(
                    "h-12 rounded-xl border text-sm font-semibold transition-all",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-soft"
                      : "bg-card border-border text-foreground hover:border-primary/50",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border bg-card">
        <Button
          disabled={!date || !time}
          onClick={() => navigate(`/app/booking/${id}/customize`)}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90 shadow-elegant disabled:opacity-40"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
