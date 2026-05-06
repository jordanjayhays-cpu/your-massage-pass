import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ADD_ONS, FOCUS_AREAS, MASSAGES, PRESSURE_LEVELS } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";

export default function Customize() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { pressure, focusAreas, addOns, notes, set, toggleFocus, toggleAddOn, shop } = useBooking();
  const massage = shop || MASSAGES.find((m) => m.id === id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">Customize your session</p>
          <h1 className="font-display text-lg font-bold">{massage?.name}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Pressure</h3>
          <div className="grid grid-cols-4 gap-2">
            {PRESSURE_LEVELS.map((p) => (
              <button
                key={p}
                onClick={() => set({ pressure: p })}
                className={cn(
                  "h-11 rounded-xl border text-xs font-semibold transition-all",
                  pressure === p ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Focus areas</h3>
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFocus(f)}
                className={cn(
                  "h-9 px-3 rounded-full border text-xs font-medium transition-all",
                  focusAreas.includes(f)
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-card border-border text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Add-ons</h3>
          <div className="space-y-2">
            {ADD_ONS.map((a) => {
              const checked = addOns.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAddOn(a.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 h-14 rounded-xl border text-left transition-all",
                    checked ? "border-primary bg-primary/5" : "border-border bg-card",
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.price === 0 ? "Free with membership" : `+€${a.price}`}</p>
                  </div>
                  <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", checked ? "border-primary bg-primary" : "border-border")}>
                    {checked && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Notes for your therapist</h3>
          <Textarea
            value={notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Anything we should know? Injuries, allergies, preferences…"
            className="min-h-[88px]"
          />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border bg-card">
        <Button
          onClick={() => navigate(`/app/booking/${id}/payment`)}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90 shadow-elegant"
        >
          Review & confirm
        </Button>
      </div>
    </div>
  );
}
