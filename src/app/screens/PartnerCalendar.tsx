import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Copy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// 0=Sun … 6=Sat
const DAYS = [
  { num: 1, label: "Monday" },
  { num: 2, label: "Tuesday" },
  { num: 3, label: "Wednesday" },
  { num: 4, label: "Thursday" },
  { num: 5, label: "Friday" },
  { num: 6, label: "Saturday" },
  { num: 0, label: "Sunday" },
];

// Time options for the open/close dropdowns (30-min granularity)
const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

type DayHours = { closed: boolean; open: string; close: string };

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/** Generate bookable slots every hour between open and close. */
function generateSlots(open: string, close: string): string[] {
  const out: string[] = [];
  for (let m = toMin(open); m < toMin(close); m += 60) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export default function PartnerCalendar() {
  const navigate = useNavigate();
  const [hours, setHours] = useState<Record<number, DayHours>>(() => {
    const h: Record<number, DayHours> = {} as any;
    for (const d of DAYS) {
      const weekend = d.num === 0 || d.num === 6;
      h[d.num] = { closed: weekend, open: "10:00", close: "20:00" };
    }
    return h;
  });
  const [capacity, setCapacity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing opening_hours + capacity
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("partners")
        .select("opening_hours, capacity")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.capacity) setCapacity(Math.max(1, Number(data.capacity)));
      const oh = data?.opening_hours;
      if (oh && typeof oh === "object") {
        const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        setHours(prev => {
          const next = { ...prev };
          for (let i = 0; i < 7; i++) {
            const v = oh[KEYS[i]];
            if (!v) continue;
            if (v.closed) next[i] = { ...next[i], closed: true };
            else if (v.open && v.close) next[i] = { closed: false, open: v.open, close: v.close };
          }
          return next;
        });
      }
    })();
  }, []);

  const update = (day: number, patch: Partial<DayHours>) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const copyToAll = (day: number) => {
    const src = hours[day];
    setHours(prev => {
      const next: Record<number, DayHours> = { ...prev };
      for (const d of DAYS) if (!next[d.num].closed) next[d.num] = { ...src };
      return next;
    });
    toast.success("Applied to all open days");
  };

  const openDays = DAYS.filter(d => !hours[d.num].closed);
  const totalSlots = openDays.reduce((n, d) => n + generateSlots(hours[d.num].open, hours[d.num].close).length, 0);

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in first"); setLoading(false); return; }

    // Replace all availability
    await supabase.from("partner_availability").delete().eq("partner_id", user.id);

    const rows = openDays.flatMap(d =>
      generateSlots(hours[d.num].open, hours[d.num].close).map(slot => ({
        partner_id: user.id, day_of_week: d.num, time_slot: slot,
      }))
    );

    if (rows.length > 0) {
      const { error } = await supabase.from("partner_availability").insert(rows);
      if (error) { toast.error("Error: " + error.message); setLoading(false); return; }
    }

    // Keep business_hours in sync too (used by the booking page profile)
    await supabase.from("business_hours").delete().eq("partner_id", user.id);
    const hourRows = openDays.map(d => ({
      partner_id: user.id, day_of_week: d.num, open_time: hours[d.num].open, close_time: hours[d.num].close,
    }));
    if (hourRows.length > 0) await supabase.from("business_hours").insert(hourRows);

    // Save opening_hours JSONB + capacity on partners (for real-time availability)
    const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const opening_hours: Record<string, any> = {};
    for (const d of DAYS) {
      const h = hours[d.num];
      opening_hours[DAY_KEYS[d.num]] = h.closed
        ? { closed: true }
        : { open: h.open, close: h.close };
    }
    await supabase
      .from("partners")
      .update({ opening_hours, capacity: Math.max(1, capacity) })
      .eq("id", user.id);

    setLoading(false);
    setSaved(true);
    toast.success("Availability saved! Your listing is live.");
    setTimeout(() => navigate("/partner/dashboard"), 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/partner/dashboard")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
            <div>
              <p className="text-xs text-muted-foreground">Availability</p>
              <h1 className="font-display text-lg font-bold">Set your opening hours</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Set when you're open each day — we'll create the bookable times for you. Set one day, then tap “Copy to all” to reuse it.
        </p>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Capacity per time slot</p>
              <p className="text-xs text-muted-foreground">How many simultaneous bookings you can take (e.g. number of therapists / rooms).</p>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={e => setCapacity(Math.max(1, Number(e.target.value) || 1))}
              className="h-10 w-20 px-2 rounded-lg border border-border bg-background text-sm text-center font-semibold"
            />
          </CardContent>
        </Card>

        {DAYS.map(d => {
          const h = hours[d.num];
          return (
            <Card key={d.num} className={`bg-card border-border ${!h.closed ? "border-primary/40" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  {/* Day toggle */}
                  <button
                    onClick={() => update(d.num, { closed: !h.closed })}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition w-28 text-left ${
                      h.closed ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {d.label}
                  </button>

                  {h.closed ? (
                    <span className="text-sm text-muted-foreground flex-1 text-right pr-1">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
                      <select value={h.open} onChange={e => update(d.num, { open: e.target.value })}
                        className="h-10 px-2 rounded-lg border border-border bg-background text-sm">
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-muted-foreground">–</span>
                      <select value={h.close} onChange={e => update(d.num, { close: e.target.value })}
                        className="h-10 px-2 rounded-lg border border-border bg-background text-sm">
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {!h.closed && (
                  <div className="flex items-center justify-between mt-2 pl-1">
                    <span className="text-xs text-muted-foreground">
                      {generateSlots(h.open, h.close).length} bookable times
                    </span>
                    <button onClick={() => copyToAll(d.num)} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                      <Copy className="h-3 w-3" /> Copy to all days
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card className="bg-gradient-royal text-primary-foreground border-0">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-semibold">
              {totalSlots === 0
                ? "No hours set — you won't appear in search yet"
                : `${openDays.length} day(s) open · ${totalSlots} bookable times`}
            </p>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading} className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? "✓ Done!" : "Go Live"}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
