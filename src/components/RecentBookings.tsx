import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface FeedRow {
  id: number;
  display_name: string;
  area: string | null;
  studio_name: string | null;
  service_name: string | null;
  confirmed_start: string;
  requested_at: string;
  confirmed_at: string;
  minutes_to_confirm: number | null;
}

const SVC_ES: Record<string, string> = {
  relaxing: "masaje relajante",
  relax: "masaje relajante",
  "deep tissue": "masaje descontracturante",
  thai: "masaje tailandés",
  sports: "masaje deportivo",
  couples: "masaje en pareja",
};

function svcLabel(name: string | null, es: boolean): string {
  const key = (name ?? "").trim().toLowerCase();
  if (es) return SVC_ES[key] ?? (key ? `masaje ${key}` : "masaje");
  if (!key) return "massage";
  return /massage/.test(key) ? key : `${key} massage`;
}

function whenLabel(iso: string, es: boolean): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(es ? "es-ES" : "en-GB", {
    weekday: "long",
    timeZone: "Europe/Madrid",
  });
  const time = d.toLocaleTimeString(es ? "es-ES" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
  });
  return `${day} ${time}`;
}

function speedLabel(mins: number | null, es: boolean): string {
  if (mins == null) return "";
  if (mins < 60) return es ? `confirmado en ${mins} min` : `confirmed in ${mins} min`;
  const h = Math.round(mins / 60);
  return es ? `confirmado en ${h} h` : `confirmed in ${h} h`;
}

/**
 * Live strip of real, recently confirmed bookings. Reads the anon-readable
 * recent_bookings_feed view, which only ever exposes a first initial unless the
 * customer has agreed to be quoted (share_ok). Renders nothing when empty.
 */
export function RecentBookings() {
  const { i18n } = useTranslation();
  const es = (i18n.resolvedLanguage || "en").startsWith("es");
  const [rows, setRows] = useState<FeedRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("recent_bookings_feed")
        .select("*")
        .limit(6);
      if (!error && data) setRows(data as FeedRow[]);
    })();
  }, []);

  if (rows.length === 0) return null;

  return (
    <section aria-label={es ? "Reservas recientes" : "Recent bookings"} className="pb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">
          {es ? "Reservas reales, esta semana" : "Real bookings, this week"}
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {es ? "Pagas en el centro. Sin comisiones." : "Pay at the studio. No commission."}
        </span>
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        {rows.map((r) => (
          <li
            key={r.id}
            className="snap-start flex-shrink-0 w-[260px] rounded-2xl bg-card border border-border/60 shadow-soft px-4 py-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">
                {r.display_name}
                {r.area ? ` · ${r.area}` : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              {svcLabel(r.service_name, es)}, {whenLabel(r.confirmed_start, es)}
              {r.studio_name ? ` · ${r.studio_name}` : ""}
            </p>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-primary mt-1.5">
              {speedLabel(r.minutes_to_confirm, es)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
