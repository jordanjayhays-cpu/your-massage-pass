import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const serif = { fontFamily: "'Fraunces', serif" };

type PartnerRow = {
  id: string;
  business_name?: string | null;
  slug?: string | null;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  outreach_email_at?: string | null;
  outreach_status?: string | null;
  hours_confirmed_at?: string | null;
  google_calendar_connected?: boolean | null;
};

type Stage = "live" | "claimed" | "bounced" | "contacted" | "not_contacted" | "excluded";

const STAGE_META: Record<Stage, { label: string; bg: string; fg: string; rank: number }> = {
  live: { label: "Live", bg: "#DDEFD8", fg: "#1F4A1B", rank: 5 },
  claimed: { label: "Claimed", bg: "#E4EAF6", fg: "#22375F", rank: 4 },
  contacted: { label: "Contacted", bg: "#F4E9D6", fg: "#5A4413", rank: 3 },
  bounced: { label: "Bounced", bg: "#F7D7D1", fg: "#7A241A", rank: 2 },
  not_contacted: { label: "Not contacted", bg: "#F0E7DB", fg: "#7A7068", rank: 1 },
  excluded: { label: "Excluded", bg: "#ECEAE7", fg: "#9A938C", rank: 0 },
};

type Row = PartnerRow & {
  services: number;
  slots: number;
  bookings: number;
  stage: Stage;
  needsAttention: boolean;
};

function shortDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function Pill({ stage }: { stage: Stage }) {
  const m = STAGE_META[stage];
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function FunnelStat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068]">{label}</p>
      <p style={serif} className="text-3xl mt-1">{value}</p>
      <div className="h-1.5 mt-2 rounded-full bg-[#F0E7DB] overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: "#C4622D" }} />
      </div>
    </div>
  );
}

type SortKey = "stage" | "name" | "contacted" | "services" | "slots" | "bookings";

export default function StudioPipeline({ refreshTick = 0 }: { refreshTick?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "__all__" | "__attention__">("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("stage");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sel = (s: string): string => s;
      const [pRes, svcRes, avRes, bkRes] = await Promise.all([
        supabase.from("partners").select(sel("id, business_name, slug, status, email, phone, outreach_email_at, outreach_status, hours_confirmed_at, google_calendar_connected")).returns<PartnerRow[]>(),
        supabase.from("partner_services").select(sel("partner_id")).returns<{ partner_id: string }[]>(),
        supabase.from("partner_availability").select(sel("partner_id")).returns<{ partner_id: string }[]>(),
        supabase.from("bookings").select(sel("partner_id")).not("partner_id", "is", null).not("is_test", "is", true).returns<{ partner_id: string }[]>(),
      ]);
      if (cancelled) return;

      const tally = (arr: { partner_id: string }[] | null) => {
        const m: Record<string, number> = {};
        for (const r of arr ?? []) {
          const k = r?.partner_id;
          if (!k) continue;
          m[k] = (m[k] || 0) + 1;
        }
        return m;
      };
      const svc = tally(svcRes.data);
      const av = tally(avRes.data);
      const bk = tally(bkRes.data);

      const built: Row[] = (pRes.data ?? [])
        .filter((p) => (p.status || "").toLowerCase() !== "suspended")
        .map((p) => {
          const services = svc[p.id] || 0;
          const slots = av[p.id] || 0;
          const status = (p.status || "").toLowerCase();
          const outreach = (p.outreach_status || "").toLowerCase();
          const active = status === "active";
          let stage: Stage;
          if (outreach === "rejected" || outreach === "skipped_not_massage") stage = "excluded";
          else if (active && services > 0 && slots > 0) stage = "live";
          else if (active) stage = "claimed";
          else if (outreach === "bounced") stage = "bounced";
          else if (p.outreach_email_at) stage = "contacted";
          else stage = "not_contacted";

          return {
            ...p,
            services,
            slots,
            bookings: bk[p.id] || 0,
            stage,
            needsAttention: stage === "bounced" || stage === "claimed",
          };
        });

      setRows(built);
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const all = rows ?? [];
  const funnel = useMemo(() => ({
    listed: all.length,
    contacted: all.filter((r) => !!r.outreach_email_at).length,
    claimed: all.filter((r) => (r.status || "").toLowerCase() === "active").length,
    bookable: all.filter((r) => (r.status || "").toLowerCase() === "active" && r.services > 0 && r.slots > 0).length,
  }), [all]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all.filter((r) => {
      if (stageFilter === "__attention__" && !r.needsAttention) return false;
      if (stageFilter !== "__all__" && stageFilter !== "__attention__" && r.stage !== stageFilter) return false;
      if (needle && !(r.business_name || "").toLowerCase().includes(needle)) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return (a.business_name || "").localeCompare(b.business_name || "") * (asc ? 1 : -1);
        case "contacted":
          return ((a.outreach_email_at || "").localeCompare(b.outreach_email_at || "")) * dir;
        case "services": return (a.services - b.services) * dir;
        case "slots": return (a.slots - b.slots) * dir;
        case "bookings": return (a.bookings - b.bookings) * dir;
        default: {
          const d = (STAGE_META[a.stage].rank - STAGE_META[b.stage].rank) * dir;
          return d !== 0 ? d : (a.business_name || "").localeCompare(b.business_name || "");
        }
      }
    });
    return list;
  }, [all, q, stageFilter, sortKey, asc]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(false); }
  };

  const Th = ({ k, children, className = "" }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-3 py-2 font-normal ${k ? "cursor-pointer select-none" : ""} ${className}`}
      onClick={k ? () => setSort(k) : undefined}
    >
      {children}{k && sortKey === k ? (asc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="rounded-3xl bg-white border border-[#E5DDD3] p-6 shadow-[0_10px_30px_-20px_rgba(122,48,0,0.2)]">
      <h2 style={serif} className="text-2xl mb-4">Studio pipeline</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <FunnelStat label="Studios listed" value={funnel.listed} total={funnel.listed} />
        <FunnelStat label="Contacted" value={funnel.contacted} total={funnel.listed} />
        <FunnelStat label="Claimed" value={funnel.claimed} total={funnel.listed} />
        <FunnelStat label="Bookable" value={funnel.bookable} total={funnel.listed} />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search studio name…"
          className="h-9 px-3 rounded-full border border-[#E5DDD3] bg-white text-sm min-w-[200px] flex-1"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as any)}
          className="h-9 px-3 rounded-full border border-[#E5DDD3] bg-white text-sm"
        >
          <option value="__all__">All stages</option>
          <option value="__attention__">Needs attention</option>
          {(Object.keys(STAGE_META) as Stage[]).map((s) => (
            <option key={s} value={s}>{STAGE_META[s].label}</option>
          ))}
        </select>
        <span className="text-xs text-[#7A7068]">{visible.length} of {all.length}</span>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-xl border border-[#E5DDD3]">
        <table className="w-full text-sm">
          <thead className="bg-[#FBF8F4] sticky top-0 z-10">
            <tr className="text-left text-[11px] uppercase tracking-widest text-[#7A7068]">
              <Th k="name">Studio</Th>
              <Th k="stage">Stage</Th>
              <Th k="contacted">Contacted</Th>
              <Th k="services">Svcs</Th>
              <Th k="slots">Slots</Th>
              <Th>Hours</Th>
              <Th>Cal</Th>
              <Th k="bookings">Bookings</Th>
              <Th>Contact</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0E7DB]">
            {visible.map((r) => {
              const amber = r.stage === "claimed";
              const red = r.stage === "bounced";
              const muted = r.stage === "excluded";
              return (
                <tr
                  key={r.id}
                  style={{ background: red ? "#FDF1EF" : amber ? "#FDF6EA" : undefined, opacity: muted ? 0.55 : 1 }}
                >
                  <td className="px-3 py-2">
                    {r.slug ? (
                      <a href={`/${r.slug}`} target="_blank" rel="noreferrer" className="text-[#C4622D] hover:underline">
                        {r.business_name || "Unnamed studio"}
                      </a>
                    ) : (
                      <span>{r.business_name || "Unnamed studio"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><Pill stage={r.stage} /></td>
                  <td className="px-3 py-2 text-[#7A7068] whitespace-nowrap">{shortDate(r.outreach_email_at) || "—"}</td>
                  <td className="px-3 py-2" style={{ color: amber && r.services === 0 ? "#B26A00" : undefined }}>{r.services}</td>
                  <td className="px-3 py-2" style={{ color: amber && r.slots === 0 ? "#B26A00" : undefined }}>{r.slots}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.hours_confirmed_at ? <span style={{ color: "#2F7A2B" }}>✓</span> : <span className="text-[#9A938C] text-xs">guessed</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.google_calendar_connected ? <span style={{ color: "#2F7A2B" }}>✓</span> : <span className="text-[#C9C2BA]">—</span>}
                  </td>
                  <td className="px-3 py-2">{r.bookings}</td>
                  <td className="px-3 py-2">
                    <div className="text-[11px] text-[#7A7068] leading-tight max-w-[200px] truncate">{r.email || "—"}</div>
                    <div className="text-[11px] text-[#9A938C] leading-tight">{r.phone || ""}</div>
                  </td>
                </tr>
              );
            })}
            {rows === null && (
              <tr><td colSpan={9} className="px-3 py-6 text-sm text-[#7A7068]">Loading studios…</td></tr>
            )}
            {rows !== null && visible.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-sm text-[#7A7068]">No studios match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#7A7068] mt-3">
        Amber = claimed but missing services or availability. Red = email bounced. Both need you.
      </p>
    </div>
  );
}
