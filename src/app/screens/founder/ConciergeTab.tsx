import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { waDigits, telHref } from "@/app/lib/whatsapp";

const serif = { fontFamily: "'Fraunces', serif" };

type WaRow = {
  id?: string | number;
  partner_id?: string | null;
  slug?: string | null;
  studio_name?: string | null;
  service_name?: string | null;
  price?: string | number | null;
  day1?: string | null;
  time1?: string | null;
  day2?: string | null;
  time2?: string | null;
  first_name?: string | null;
  contact_email?: string | null;
  languages?: string | null;
  outcome?: string | null;
  created_at?: string | null;
  kind?: "wa" | "lead";
};

type PartnerRow = {
  id: string;
  business_name?: string | null;
  slug?: string | null;
  status?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  auto_confirm_bookings?: boolean | null;
  price_from?: number | null;
};

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!isFinite(diff)) return "";
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Spanish relay message Jordan sends to the studio. */
function relayMessage(r: WaRow): string {
  const price = r.price != null && String(r.price).trim() ? `${String(r.price).replace(/[^\d.,]/g, "")}€` : "";
  const svc = (r.service_name || "un masaje").trim();
  const service = price ? `${svc} (${price})` : svc;
  const pref1 = [r.day1, r.time1].filter(Boolean).join(" ");
  const pref2 = [r.day2, r.time2].filter(Boolean).join(" ");
  const pref = [pref1, pref2].filter(Boolean).join(", ") || "flexible";
  const name = (r.first_name || "un cliente").trim();
  const langs = (r.languages || "").trim();
  const who = langs ? `Cliente: ${name}, habla ${langs}.` : `Cliente: ${name}.`;
  return `Hola! Soy Jordan, de Massage Club. Tengo un cliente que quiere reservar: ${service}. Preferencia: ${pref}. ${who} ¿Tenéis hueco?`;
}

function StatusChip({ status }: { status?: string | null }) {
  const s = (status || "").toLowerCase();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "#DDEFD8", fg: "#2F5E33", label: "Active" },
    pending: { bg: "#F4E9D6", fg: "#5A4413", label: "Pending" },
  };
  const v = map[s] || { bg: "#F0E7DB", fg: "#7A7068", label: status || "unknown" };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0"
      style={{ background: v.bg, color: v.fg }}>{v.label}</span>
  );
}

const pill =
  "inline-flex items-center justify-center h-9 px-3 rounded-full text-xs font-semibold border border-[#E5DDD3] bg-white text-[#211C1A]";
const pillPrimary =
  "inline-flex items-center justify-center h-9 px-3 rounded-full text-xs font-semibold text-white";

export default function ConciergeTab({ refreshTick }: { refreshTick?: number }) {
  const [rows, setRows] = useState<WaRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [waRes, partnerRes, leadRes] = await Promise.all([
        supabase.from("whatsapp_requests").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("partners").select("*").in("status", ["active", "pending"]).limit(500),
        supabase.from("booking_leads").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      if (cancelled) return;

      const wa: WaRow[] = ((waRes.data as any[]) || []).map((r) => ({ ...r, kind: "wa" as const }));
      const leads: WaRow[] = leadRes.error
        ? []
        : ((leadRes.data as any[]) || []).map((r) => ({
            id: `lead-${r.id}`,
            slug: r.partner_slug ?? null,
            studio_name: r.partner_slug || "Unknown studio",
            service_name: r.service_name ?? null,
            day1: r.booking_date ?? null,
            time1: r.booking_time ?? null,
            contact_email: r.email ?? null,
            created_at: r.created_at ?? null,
            outcome: "abandoned",
            kind: "lead" as const,
          }));

      const merged = [...wa, ...leads]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 20);

      setRows(merged);
      setPartners(((partnerRes.data as any[]) || []) as PartnerRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const byId = useMemo(() => {
    const m: Record<string, PartnerRow> = {};
    for (const p of partners) {
      m[p.id] = p;
      if (p.slug) m[p.slug] = p;
      if (p.business_name) m[p.business_name.trim().toLowerCase()] = p;
    }
    return m;
  }, [partners]);

  const studioFor = (r: WaRow): PartnerRow | null =>
    (r.partner_id && byId[r.partner_id]) ||
    (r.slug && byId[r.slug]) ||
    (r.studio_name && byId[r.studio_name.trim().toLowerCase()]) ||
    null;

  const studioWa = (p?: PartnerRow | null) => {
    const d = waDigits(p?.whatsapp || p?.phone || "");
    return d || null;
  };

  const directory = useMemo(() => {
    const term = q.trim().toLowerCase();
    return partners
      .filter((p) =>
        !term ||
        (p.business_name || "").toLowerCase().includes(term) ||
        (p.slug || "").toLowerCase().includes(term) ||
        (p.email || "").toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const aa = (a.status || "").toLowerCase() === "active" ? 0 : 1;
        const bb = (b.status || "").toLowerCase() === "active" ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return (a.business_name || "").localeCompare(b.business_name || "");
      });
  }, [partners, q]);

  return (
    <div className="space-y-6">
      {/* Section 1 */}
      <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 sm:p-6">
        <h2 style={serif} className="text-2xl mb-1">Incoming requests</h2>
        <p className="text-xs text-[#7A7068] mb-4">Latest 20, newest first.</p>

        {loading && <p className="text-sm text-[#7A7068]">Loading...</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-[#7A7068]">Nothing incoming yet.</p>}

        <div className="space-y-3">
          {rows.map((r, i) => {
            const p = studioFor(r);
            const digits = studioWa(p);
            const relay = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(relayMessage(r))}` : null;
            const clientMail = r.contact_email
              ? `mailto:${r.contact_email}?subject=${encodeURIComponent("Your massage booking")}`
              : null;
            const pref2 = [r.day2, r.time2].filter(Boolean).join(" ");
            return (
              <div key={String(r.id ?? i)} className="rounded-2xl border border-[#E5DDD3] bg-[#FBF8F4] p-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{r.first_name || "No name"}</span>
                  <span className="text-sm text-[#7A7068]">{r.service_name || "No service"}</span>
                  {r.price != null && String(r.price).trim() !== "" && (
                    <span className="text-sm font-medium">{String(r.price).replace(/[^\d.,]/g, "")}€</span>
                  )}
                  <span className="ml-auto text-[11px] text-[#A79C92]">{relTime(r.created_at)}</span>
                </div>
                <p className="text-sm mt-0.5">{r.studio_name || "Unknown studio"}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[#7A7068]">
                  {(r.day1 || r.time1) && <span>1st: {[r.day1, r.time1].filter(Boolean).join(" ")}</span>}
                  {pref2 && <span>2nd: {pref2}</span>}
                  {r.languages && <span>Speaks {r.languages}</span>}
                  {r.contact_email && <span className="break-all">{r.contact_email}</span>}
                  {r.outcome && <span className="uppercase tracking-widest text-[10px]">{r.outcome}</span>}
                </div>
                <div className="mt-2.5 flex gap-2 flex-wrap">
                  {relay ? (
                    <a href={relay} target="_blank" rel="noreferrer" className={pillPrimary} style={{ background: "#C4622D" }}>
                      Relay to studio
                    </a>
                  ) : (
                    <span className={`${pill} opacity-50`}>No studio number</span>
                  )}
                  {clientMail ? (
                    <a href={clientMail} className={pill}>Reply to client</a>
                  ) : (
                    <span className={`${pill} opacity-50`}>No client contact</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2 */}
      <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 sm:p-6">
        <h2 style={serif} className="text-2xl mb-3">Studio directory</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search studios"
          className="w-full h-11 rounded-full border border-[#E5DDD3] bg-[#FBF8F4] px-4 text-sm mb-4 outline-none focus:border-[#C4622D]"
        />
        <div className="space-y-2">
          {directory.map((p) => {
            const digits = studioWa(p);
            const tel = telHref(p.phone || p.whatsapp || "");
            const page = p.slug ? `/${p.slug}` : `/s/${p.id}`;
            return (
              <div key={p.id} className="rounded-2xl border border-[#E5DDD3] p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.business_name || "Unnamed studio"}</span>
                  <StatusChip status={p.status} />
                </div>
                <p className="text-[11px] text-[#A79C92] mt-0.5">
                  {p.auto_confirm_bookings ? "Auto confirm" : "Manual confirm"}
                  {p.price_from != null ? ` · from ${p.price_from}€` : ""}
                </p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {digits ? (
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={pillPrimary} style={{ background: "#25D366" }}>WhatsApp</a>
                  ) : null}
                  {tel ? <a href={tel} className={pill}>Call</a> : null}
                  {p.email ? <a href={`mailto:${p.email}`} className={pill}>Email</a> : null}
                  <a href={page} target="_blank" rel="noreferrer" className={pill}>Page</a>
                </div>
              </div>
            );
          })}
          {directory.length === 0 && <p className="text-sm text-[#7A7068]">No studios match that search.</p>}
        </div>
      </div>
    </div>
  );
}
