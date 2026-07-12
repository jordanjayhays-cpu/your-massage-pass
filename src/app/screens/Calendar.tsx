import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextDays, TIME_SLOTS, MASSAGES } from "../data";
import { useBooking } from "../BookingContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Build hourly slots between open and close (e.g. "10:00", "11:00" ... < close). */
function generateSlots(open: string, close: string): string[] {
  if (!open || !close) return [];
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const start = oh * 60 + (om || 0);
  const end = ch * 60 + (cm || 0);
  const out: string[] = [];
  for (let m = start; m < end; m += 60) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
}

export default function Calendar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { date, time, set, shop } = useBooking();
  const massage = shop || MASSAGES.find((m) => m.id === id);
  const days = getNextDays(14);

  const partnerId: string | undefined = (massage as any)?.partner_id;

  const [slots, setSlots] = useState<string[]>(TIME_SLOTS);
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [capacity, setCapacity] = useState(1);
  const [loading, setLoading] = useState(false);

  // Load opening_hours + capacity once per studio
  const [partner, setPartner] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!partnerId) {
        setPartner(null);
        return;
      }
      const { data } = await supabase
        .from("partners")
        .select("opening_hours, capacity, partner_availability(day_of_week, time_slot)")
        .eq("id", partnerId)
        .maybeSingle();
      if (!cancelled) {
        setPartner(data);
        setCapacity(Math.max(1, Number(data?.capacity) || 1));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  // Compute slot list whenever date changes
  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    const key = DAY_KEYS[dow];

    let base: string[] = [];
    const hours = partner?.opening_hours?.[key];
    if (hours && !hours.closed && hours.open && hours.close) {
      base = generateSlots(hours.open, hours.close);
    } else if (partner?.partner_availability?.length) {
      base = partner.partner_availability
        .filter((a: any) => Number(a.day_of_week) === dow)
        .map((a: any) => a.time_slot)
        .sort();
    } else if (!partnerId) {
      // Hardcoded demo studio — keep static slots
      base = TIME_SLOTS;
    } else {
      base = [];
    }

    // Hide past times for today
    const today = new Date();
    const isToday = today.toISOString().slice(0, 10) === date;
    if (isToday) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      base = base.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + (m || 0) > nowMin;
      });
    }
    setSlots(base);
  }, [date, partner, partnerId]);

  // Fetch existing bookings for that date+studio
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!date || !partnerId) {
        setBookedCounts({});
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("bookings")
        .select("booking_time, status")
        .eq("partner_id", partnerId)
        .eq("booking_date", date)
        .neq("status", "cancelled");
      const counts: Record<string, number> = {};
      for (const b of data ?? []) {
        const t = (b.booking_time || "").slice(0, 5);
        counts[t] = (counts[t] || 0) + 1;
      }
      if (!cancelled) {
        setBookedCounts(counts);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, partnerId]);

  const isFull = (t: string) => (bookedCounts[t] || 0) >= capacity;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          aria-label={t("app.calendar.back")} 
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">{t("app.calendar.selectDateTime")}</p>
          <h1 className="font-display text-lg font-bold">{massage?.name}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("app.calendar.chooseDay")}</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6">
          {days.map((d) => {
            const selected = date === d.iso;
            const day = t("app.calendar.days." + DAY_KEYS[d.date.getDay()]);
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

        <div className="flex items-center justify-between mt-6 mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t("app.calendar.availableTimes")}</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {!date ? (
          <p className="text-sm text-muted-foreground">{t("app.calendar.pickDayFirst")}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.calendar.closedDay")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((t_slot) => {
              const selected = time === t_slot;
              const full = isFull(t_slot);
              return (
                <button
                  key={t_slot}
                  onClick={() => !full && set({ time: t_slot })}
                  disabled={full}
                  className={cn(
                    "h-12 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center justify-center",
                    full
                      ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                      : selected
                      ? "bg-primary text-primary-foreground border-primary shadow-soft"
                      : "bg-card border-border text-foreground hover:border-primary/50",
                  )}
                >
                  <span>{t_slot}</span>
                  {full && <span className="text-[9px] uppercase tracking-wide">{t("app.calendar.fullyBooked")}</span>}
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
          {t("app.calendar.continue")}
        </Button>
      </div>
    </div>
  );
}
