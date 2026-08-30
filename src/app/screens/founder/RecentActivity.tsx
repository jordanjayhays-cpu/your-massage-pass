import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isTestBookingRow, isTestWaRow } from "./testTag";

const serif = { fontFamily: "'Fraunces', serif" };
const DAY_MS = 86400000;

type BookingRow = {
  id: number | string;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  spa_name?: string | null;
  partner_id?: string | null;
  massage_type?: string | null;
  booking_date?: string | null;
  booking_time?: string | null;
  status?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  is_test?: boolean | null;
};

type WaRow = {
  id?: string | number;
  first_name?: string | null;
  last_name?: string | null;
  contact_email?: string | null;
  client_phone?: string | null;
  service_name?: string | null;
  studio_name?: string | null;
  stage?: string | null;
  outcome?: string | null;
  created_at?: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#F4E9D6", fg: "#5A4413", label: "Pending" },
  confirmed: { bg: "#DDEFD8", fg: "#2F5E33", label: "Confirmed" },
  completed: { bg: "#D9E7F2", fg: "#2A4C68", label: "Completed" },
  cancelled: { bg: "#F4D6D0", fg: "#8A3626", label: "Cancelled" },
  no_show: { bg: "#EDE3F2", fg: "#5A3A6B", label: "No show" },
};

function Chip({ status }: { status?: string | null }) {
  const key = (status || "").toLowerCase();
  const v = STATUS_STYLE[key] || { bg: "#F0E7DB", fg: "#7A7068", label: status || "unknown" };
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap"
      style={{ background: v.bg, color: v.fg }}
    >
      {v.label}
    </span>
  );
}

function TestBadge() {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest text-[#7A7068] whitespace-nowrap"
      style={{ background: "#F0E7DB" }}
    >
      Test
    </span>
  );
}

function Pills<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="px-3 h-8 rounded-full text-xs font-medium border"
          style={{
            background: value === o.key ? "#C4622D" : "#FFFFFF",
            color: value === o.key ? "#F7F4F0" : "#211C1A",
            borderColor: value === o.key ? "#C4622D" : "#E5DDD3",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function RecentActivity({ refreshTick }: { refreshTick?: number }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [wa, setWa] = useState<WaRow[]>([]);
  const [studioNames, setStudioNames] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"all" | "real">("all");
  const [days, setDays] = useState<"7" | "30" | "all">("30");
  const [listTab, setListTab] = useState<"bookings" | "whatsapp">("bookings");

  useEffect(() => {
    (async () => {
      const [{ data: bks }, { data: waRows }, { data: prs }] = await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("whatsapp_requests").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("partners").select("id,business_name").limit(1000),
      ]);
      setBookings((bks as BookingRow[]) ?? []);
      setWa((waRows as WaRow[]) ?? []);
      const map: Record<string, string> = {};
      for (const p of (prs as any[]) ?? []) map[p.id] = p.business_name || "";
      setStudioNames(map);
    })();
  }, [refreshTick]);

  const studioFor = (b: BookingRow) =>
    (b.partner_id && studioNames[b.partner_id]) || b.spa_name || "Studio";

  const recentBookings = useMemo(() => bookings.slice(0, 10), [bookings]);
  const recentWa = useMemo(() => wa.slice(0, 10), [wa]);

  const funnel = useMemo(() => {
    const cutoff = days === "all" ? 0 : Date.now() - Number(days) * DAY_MS;
    const inWindow = (t?: string | null) => (t ? new Date(t).getTime() >= cutoff : days === "all");

    const bs = bookings.filter((b) => inWindow(b.created_at) && (scope === "all" || !isTestBookingRow(b)));
    const ws = wa.filter((w) => inWindow(w.created_at) && (scope === "all" || !isTestWaRow(w)));

    const status = (b: BookingRow) => (b.status || "").toLowerCase();
    const stage = (w: WaRow) => (w.stage || "").toLowerCase();

    const requests = bs.length + ws.length;
    const confirmed =
      bs.filter((b) => status(b) === "confirmed" || status(b) === "completed").length +
      ws.filter((w) => stage(w) === "confirmed" || stage(w) === "completed").length;
    const completed =
      bs.filter((b) => status(b) === "completed").length +
      ws.filter((w) => stage(w) === "completed" || (w.outcome || "").toLowerCase() === "happened").length;
    const reviewed = bs.filter((b) => !!b.reviewed_at).length;

    return [
      { label: "Requests received", labelEs: "Solicitudes recibidas", count: requests },
      { label: "Studio confirmed", labelEs: "Estudio confirmó", count: confirmed },
      { label: "Massage completed", labelEs: "Masaje realizado", count: completed },
      { label: "Reviewed", labelEs: "Reseñado", count: reviewed },
    ];
  }, [bookings, wa, scope, days]);

  const top = funnel[0].count;

  return (
    <div className="rounded-3xl bg-white border border-[#E5DDD3] p-5 sm:p-6 shadow-[0_10px_30px_-20px_rgba(122,48,0,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 style={serif} className="text-2xl">Booking funnel</h2>
        <div className="flex flex-wrap gap-2">
          <Pills<"all" | "real">
            options={[{ key: "all" as const, label: "All" }, { key: "real" as const, label: "Real only" }]}
            value={scope}
            onChange={setScope}
          />
          <Pills<"7" | "30" | "all">
            options={[
              { key: "7" as const, label: "7d" },
              { key: "30" as const, label: "30d" },
              { key: "all" as const, label: "All" },
            ]}
            value={days}
            onChange={setDays}
          />
        </div>
      </div>

      <div className="mb-6">
        {funnel.map((f, i) => {
          const pct = top ? Math.round((f.count / top) * 100) : 0;
          return (
            <div key={f.label} className="mb-3">
              <div className="flex justify-between items-baseline text-xs mb-1 gap-3">
                <span className="text-[#211C1A]">
                  {f.label} <span className="text-[#A79C92]">{f.labelEs}</span>
                </span>
                <span className="text-[#7A7068] whitespace-nowrap tabular-nums">
                  {f.count}
                  {i > 0 ? ` · ${pct}%` : ""}
                </span>
              </div>
              <div className="h-3 rounded-full bg-[#F0E7DB] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(pct, f.count ? 4 : 0)}%`, background: "#C4622D" }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-[#A79C92] mt-2">
          Percentages are share of requests received. {scope === "real" ? "Test rows excluded." : "Test rows included."}
        </p>
      </div>

      <div className="border-t border-[#F0E7DB] pt-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <Pills<"bookings" | "whatsapp">
            options={[
              { key: "bookings" as const, label: "Recent bookings" },
              { key: "whatsapp" as const, label: "WhatsApp requests" },
            ]}
            value={listTab}
            onChange={setListTab}
          />
          <span className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068]">10 most recent</span>
        </div>

        {listTab === "bookings" ? (
          <div className="divide-y divide-[#F0E7DB]">
            {recentBookings.map((b) => (
              <div key={`rb-${b.id}`} className="py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{b.client_name || "Guest"}</span>
                {isTestBookingRow(b) && <TestBadge />}
                <span className="text-[#7A7068]">· {studioFor(b)}</span>
                {b.massage_type && (
                  <span className="text-[#7A7068]">· {String(b.massage_type).replace(/_/g, " ")}</span>
                )}
                <span className="text-[#7A7068] tabular-nums">
                  · {b.booking_date || "—"} {b.booking_time || ""}
                </span>
                <span className="ml-auto"><Chip status={b.status} /></span>
              </div>
            ))}
            {recentBookings.length === 0 && <p className="text-sm text-[#7A7068] py-4">No bookings yet.</p>}
          </div>
        ) : (
          <div className="divide-y divide-[#F0E7DB]">
            {recentWa.map((w, i) => (
              <div key={`rw-${w.id ?? i}`} className="py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{w.first_name || "Guest"}</span>
                {isTestWaRow(w) && <TestBadge />}
                {w.service_name && <span className="text-[#7A7068]">· {w.service_name}</span>}
                <span className="text-[#7A7068]">· {w.studio_name || "Unknown studio"}</span>
                <span className="text-[#7A7068] tabular-nums">
                  · {w.created_at ? new Date(w.created_at).toLocaleString() : "—"}
                </span>
                <span className="ml-auto"><Chip status={w.stage || w.outcome} /></span>
              </div>
            ))}
            {recentWa.length === 0 && <p className="text-sm text-[#7A7068] py-4">No WhatsApp requests yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
