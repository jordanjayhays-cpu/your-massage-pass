import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type DayAvailability = {
  [day: number]: string[]; // array of time slots like ["09:00", "10:00", "14:00"]
};

// 0=Sun, 1=Mon, ... 6=Sat
const DAYS = [
  { num: 1, label: "Monday", short: "Mon" },
  { num: 2, label: "Tuesday", short: "Tue" },
  { num: 3, label: "Wednesday", short: "Wed" },
  { num: 4, label: "Thursday", short: "Thu" },
  { num: 5, label: "Friday", short: "Fri" },
  { num: 6, label: "Saturday", short: "Sat" },
  { num: 0, label: "Sunday", short: "Sun" },
];

const TIME_SLOTS = [
  "09:00", "09:30",
  "10:00", "10:30",
  "11:00", "11:30",
  "12:00", "12:30",
  "13:00", "13:30",
  "14:00", "14:30",
  "15:00", "15:30",
  "16:00", "16:30",
  "17:00", "17:30",
  "18:00", "18:30",
  "19:00", "19:30",
  "20:00", "20:30",
  "21:00",
];

export default function PartnerCalendar() {
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<DayAvailability>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [],
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectingDay, setSelectingDay] = useState<number | null>(null);

  const toggleSlot = (day: number, slot: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: prev[day].includes(slot)
        ? prev[day].filter(s => s !== slot)
        : [...prev[day], slot].sort(),
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in first"); setLoading(false); return; }

    // Clear old availability
    await supabase.from("partner_availability").delete().eq("partner_id", user.id);

    // Insert new
    const rows = DAYS.flatMap(day =>
      (availability[day.num] ?? []).map(slot => ({
        partner_id: user.id,
        day_of_week: day.num,
        time_slot: slot,
      }))
    );

    if (rows.length > 0) {
      const { error } = await supabase.from("partner_availability").insert(rows);
      if (error) { toast.error("Error: " + error.message); setLoading(false); return; }
    }

    setLoading(false);
    setSaved(true);
    toast.success("Availability saved! Your listing is live.");
    setTimeout(() => navigate("/partner/dashboard"), 1500);
  };

  const totalSlots = Object.values(availability).flat().length;
  const selectedDayCount = Object.values(availability).filter(a => a.length > 0).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/partner/services")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
            <div>
              <p className="text-xs text-muted-foreground">Step 3 of 3</p>
              <h1 className="font-display text-lg font-bold">Set Your Availability</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Tap time slots when you're available. Customers will only be able to book during these times.
        </p>

        {DAYS.map(day => (
          <Card key={day.num} className={`bg-card border-border ${availability[day.num].length > 0 ? "border-primary/50" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-sm">{day.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {availability[day.num].length === 0 ? "Closed" : `${availability[day.num].length} slot(s)`}
                  </span>
                </div>
                {availability[day.num].length > 0 && (
                  <button
                    onClick={() => setAvailability(prev => ({ ...prev, [day.num]: [] }))}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map(slot => {
                  const active = availability[day.num].includes(slot);
                  return (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(day.num, slot)}
                      className={`h-8 px-2 rounded-lg text-xs font-semibold border transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="bg-gradient-royal text-primary-foreground border-0">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-semibold">
              {totalSlots === 0
                ? "No slots selected — you won't appear in search yet"
                : `${selectedDayCount} day(s) open · ${totalSlots} time slots set`
              }
            </p>
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={loading}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? "✓ Done!" : "Go Live"}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
