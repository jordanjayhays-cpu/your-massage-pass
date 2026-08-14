import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Loader2, Copy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// 0=Sun … 6=Sat
const DAY_DEFS = [
  { num: 1, key: "monday" },
  { num: 2, key: "tuesday" },
  { num: 3, key: "wednesday" },
  { num: 4, key: "thursday" },
  { num: 5, key: "friday" },
  { num: 6, key: "saturday" },
  { num: 0, key: "sunday" },
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const DAYS = DAY_DEFS.map(d => ({ ...d, label: t(`partner.calendar.days.${d.key}`) }));
  const [hours, setHours] = useState<Record<number, DayHours>>(() => {
    const h: Record<number, DayHours> = {} as any;
    for (const d of DAY_DEFS) {
      const weekend = d.num === 0 || d.num === 6;
      h[d.num] = { closed: weekend, open: "10:00", close: "20:00" };
    }
    return h;
  });
  const [capacity, setCapacity] = useState(1);
  const [showDayCapacity, setShowDayCapacity] = useState(false);
  const [dayCapacity, setDayCapacity] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const dayCapFor = (day: number) => dayCapacity[day] ?? capacity;


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

      // Load per-day capacity overrides
      const { data: av } = await supabase
        .from("partner_availability")
        .select("day_of_week, capacity")
        .eq("partner_id", user.id);
      const overrides: Record<number, number> = {};
      for (const row of (av as any[]) || []) {
        if (row.capacity != null) overrides[Number(row.day_of_week)] = Number(row.capacity);
      }
      if (Object.keys(overrides).length > 0) {
        setDayCapacity(overrides);
        setShowDayCapacity(true);
      }
    })();

  }, []);

  const update = (day: number, patch: Partial<DayHours>) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const copyToAll = (day: number) => {
    const src = hours[day];
    setHours(prev => {
      const next: Record<number, DayHours> = { ...prev };
      for (const d of DAY_DEFS) if (!next[d.num].closed) next[d.num] = { ...src };
      return next;
    });
    toast.success(t("partner.calendar.toastAppliedAll"));
  };

  const openDays = DAY_DEFS.filter(d => !hours[d.num].closed);
  const totalSlots = openDays.reduce((n, d) => n + generateSlots(hours[d.num].open, hours[d.num].close).length, 0);

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t("partner.calendar.toastSignIn")); setLoading(false); return; }

    // Replace all availability
    await supabase.from("partner_availability").delete().eq("partner_id", user.id);

    const rows = openDays.flatMap(d =>
      generateSlots(hours[d.num].open, hours[d.num].close).map(slot => ({
        partner_id: user.id, day_of_week: d.num, time_slot: slot,
      }))
    );

    if (rows.length > 0) {
      const { error } = await supabase.from("partner_availability").insert(rows);
      if (error) { toast.error(t("partner.calendar.toastError", { message: error.message })); setLoading(false); return; }
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
    for (const d of DAY_DEFS) {
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
    toast.success(t("partner.calendar.toastSaved"));
    setTimeout(() => navigate("/partner/dashboard"), 1200);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/partner/dashboard")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
            <div>
              <p className="text-xs text-muted-foreground">{t("partner.calendar.stepLabel")}</p>
              <h1 className="font-display text-lg font-bold">{t("partner.calendar.title")}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("partner.calendar.intro")}
        </p>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("partner.calendar.capacityLabel")}</p>
              <p className="text-xs text-muted-foreground">{t("partner.calendar.capacityHint")}</p>
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
                    <span className="text-sm text-muted-foreground flex-1 text-right pr-1">{t("partner.calendar.closed")}</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
                      <select value={h.open} onChange={e => update(d.num, { open: e.target.value })}
                        className="h-10 px-2 rounded-lg border border-border bg-background text-sm">
                        {TIME_OPTIONS.map(t3 => <option key={t3} value={t3}>{t3}</option>)}
                      </select>
                      <span className="text-muted-foreground">–</span>
                      <select value={h.close} onChange={e => update(d.num, { close: e.target.value })}
                        className="h-10 px-2 rounded-lg border border-border bg-background text-sm">
                        {TIME_OPTIONS.map(t3 => <option key={t3} value={t3}>{t3}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {!h.closed && (
                  <div className="flex items-center justify-between mt-2 pl-1">
                    <span className="text-xs text-muted-foreground">
                      {t("partner.calendar.bookableTimes", { count: generateSlots(h.open, h.close).length })}
                    </span>
                    <button onClick={() => copyToAll(d.num)} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                      <Copy className="h-3 w-3" /> {t("partner.calendar.copyToAll")}
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
                ? t("partner.calendar.noHoursSet")
                : t("partner.calendar.summary", { days: openDays.length, slots: totalSlots })}
            </p>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading} className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? t("partner.calendar.done") : t("partner.calendar.goLive")}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
