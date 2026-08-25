import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { waDigits, telHref } from "@/app/lib/whatsapp";

const serif = { fontFamily: "'Fraunces', serif" };

type Stage = "new" | "acknowledged" | "studio_asked" | "studio_replied" | "confirmed" | "booked" | "dead";

type WaRow = {
  id: string | number;
  partner_id?: string | null;
  slug?: string | null;
  studio_name?: string | null;
  service_name?: string | null;
  price?: string | number | null;
  duration?: number | null;
  day1?: string | null;
  time1?: string | null;
  day2?: string | null;
  time2?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  contact_email?: string | null;
  client_phone?: string | null;
  languages?: string | null;
  created_at?: string | null;
  stage?: string | null;
  acknowledged_at?: string | null;
  studio_asked_at?: string | null;
  studio_reply?: string | null;
  confirmed_day?: string | null;
  confirmed_time?: string | null;
  client_confirmed_at?: string | null;
  booking_id?: number | string | null;
  stage_note?: string | null;
  stage_updated_at?: string | null;
};

type PartnerRow = {
  id: string;
  business_name?: string | null;
  slug?: string | null;
  status?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  auto_confirm_bookings?: boolean | null;
  price_from?: number | null;
};

const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  acknowledged: "Client told",
  studio_asked: "Studio asked",
  studio_replied: "Studio replied",
  confirmed: "Confirmed",
  booked: "Booked",
  dead: "Dead",
};

const STAGE_COLOR: Record<Stage, { bg: string; fg: string }> = {
  new: { bg: "#F4E0D3", fg: "#8A3D14" },
  acknowledged: { bg: "#F4E9D6", fg: "#5A4413" },
  studio_asked: { bg: "#E2E8F4", fg: "#2B3F63" },
  studio_replied: { bg: "#EFE0F4", fg: "#5A2B63" },
  confirmed: { bg: "#DDEFD8", fg: "#2F5E33" },
  booked: { bg: "#CDE7C6", fg: "#22521F" },
  dead: { bg: "#EDE7E2", fg: "#7A7068" },
};

const NEEDS_YOU: Stage[] = ["new", "acknowledged", "studio_asked", "studio_replied", "confirmed"];
const DEAD_REASONS = ["No reply from client", "No reply from studio", "No availability", "Too expensive", "Booked elsewhere", "Spam or test"];

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

function hoursSince(iso?: string | null): number | null {
  if (!iso) return null;
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  return isFinite(h) ? h : null;
}

function isSpanish(r: WaRow): boolean {
  return /espa|spanish|\bes\b/i.test(r.languages || "");
}

const priceLabel = (r: WaRow) => {
  const v = r.price != null ? String(r.price).replace(/[^\d.,]/g, "") : "";
  return v ? `${v}€` : "";
};
const clientName = (r: WaRow) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
const pref1 = (r: WaRow) => [r.day1, r.time1].filter(Boolean).join(" ");
const pref2 = (r: WaRow) => [r.day2, r.time2].filter(Boolean).join(" ");

function waLink(number: string | null, text: string): string | null {
  const d = waDigits(number || "");
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/* ── message builders ── */
function ackText(r: WaRow, studio: string): string {
  const when = pref1(r) || "your preferred time";
  return isSpanish(r)
    ? `¡Voy! Dame unos minutos para comprobar con ${studio} el ${when} y te digo algo enseguida.`
    : `On it! Give me a few minutes to check with ${studio} for ${when} and I will come right back to you.`;
}

function studioAskText(r: WaRow): string {
  const price = priceLabel(r);
  const svc = (r.service_name || "un masaje").trim();
  const service = price ? `${svc} (${price})` : svc;
  const p1 = pref1(r) || "flexible";
  const p2 = pref2(r);
  const pref = p2 ? `${p1} o ${p2}` : p1;
  const name = clientName(r) || "un cliente";
  const langs = (r.languages || "").trim();
  const who = langs ? `Cliente: ${name}, habla ${langs}.` : `Cliente: ${name}.`;
  return `Hola! Soy Jordan, de Massage Club. Tengo un cliente que quiere reservar: ${service}. Preferencia: ${pref}. ${who} ¿Tenéis hueco?`;
}

function altOfferText(r: WaRow, studio: string): string {
  const alt = (r.stage_note || "another time").trim();
  return isSpanish(r)
    ? `Esa hora está ocupada. ${studio} puede el ${alt}. ¿Te viene bien?`
    : `That time is taken. ${studio} can do ${alt}. Does that work for you?`;
}

function confirmText(r: WaRow, studio: string, address?: string | null): string {
  const day = r.confirmed_day || r.day1 || "";
  const time = r.confirmed_time || r.time1 || "";
  const addr = address ? address : "Madrid";
  return isSpanish(r)
    ? `¡Confirmado! Tienes reserva en ${studio} el ${day} a las ${time}. Dirección: ${addr}. Se paga en el estudio, sin tarjeta. Si quieres que sepan algo (presión, zonas), dímelo.`
    : `Confirmed! You are booked at ${studio} on ${day} at ${time}. Address: ${addr}. Pay at the studio, no card needed. Anything you want them to know (pressure, focus areas), just tell me.`;
}

const THANK_STUDIO = "¡Genial, gracias! Confirmado por nuestra parte. El cliente paga en el estudio.";

/* ── UI atoms ── */
const btnBase = "inline-flex items-center justify-center rounded-full font-semibold transition active:scale-[0.98]";
const primaryBtn = `${btnBase} h-12 px-5 text-sm text-white w-full`;
const smallBtn = `${btnBase} h-10 px-3 text-xs border border-[#E5DDD3] bg-white text-[#211C1A]`;
const inputCls = "w-full h-11 rounded-xl border border-[#E5DDD3] bg-white px-3 text-sm outline-none focus:border-[#C4622D]";

function StageChip({ stage }: { stage: Stage }) {
  const c = STAGE_COLOR[stage];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0"
      style={{ background: c.bg, color: c.fg }}>{STAGE_LABEL[stage]}</span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={primaryBtn}
      style={{ background: done ? "#2F5E33" : "#C4622D" }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export default function ConciergeTab({ refreshTick }: { refreshTick?: number }) {
  const [rows, setRows] = useState<WaRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [waRes, partnerRes] = await Promise.all([
      supabase.from("whatsapp_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("partners").select("*").in("status", ["active", "pending"]).limit(500),
    ]);
    setRows(((waRes.data as any[]) || []) as WaRow[]);
    setPartners(((partnerRes.data as any[]) || []) as PartnerRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshTick]);

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

  /** Patch a request row, stamping stage_updated_at. */
  const patch = async (r: WaRow, fields: Record<string, any>) => {
    setErr(null);
    setBusy(String(r.id));
    const payload = { ...fields, stage_updated_at: new Date().toISOString() };
    const { error } = await supabase.from("whatsapp_requests").update(payload as any).eq("id", r.id as any);
    setBusy(null);
    if (error) { setErr(error.message); return false; }
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...payload } : x)));
    return true;
  };

  /** Insert the real booking so the automation takes over. */
  const createBooking = async (r: WaRow) => {
    const p = studioFor(r);
    const day = (r.confirmed_day || r.day1 || "").trim();
    const time = (r.confirmed_time || r.time1 || "").trim();
    if (!day || !time) { setErr("Confirm a day and time first."); return; }
    setErr(null);
    setBusy(String(r.id));
    const priceNum = r.price != null ? Number(String(r.price).replace(/[^\d.]/g, "")) : null;
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        client_name: clientName(r) || "Concierge client",
        client_email: r.contact_email || null,
        client_phone: r.client_phone || null,
        spa_name: p?.business_name || r.studio_name || "Unknown studio",
        partner_id: p?.id ?? null,
        massage_type: r.service_name || null,
        price: priceNum && isFinite(priceNum) ? priceNum : null,
        duration: r.duration ?? 60,
        booking_date: day,
        booking_time: time,
        status: "confirmed",
        lang: isSpanish(r) ? "es" : "en",
        source: "concierge",
        notes: "concierge",
      } as any)
      .select("id")
      .single();
    setBusy(null);
    if (error || !data) { setErr(error?.message || "Booking insert failed"); return; }
    await patch(r, { booking_id: (data as any).id, stage: "booked" });
  };

  const needsYou = rows.filter((r) => NEEDS_YOU.includes(((r.stage || "new") as Stage)));
  const done = rows.filter((r) => !NEEDS_YOU.includes(((r.stage || "new") as Stage)));

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
      {err && (
        <div className="rounded-2xl border border-[#E2B4A0] bg-[#FBEDE7] p-3 text-sm" style={{ color: "#8A3D14" }}>{err}</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={`${btnBase} h-11 px-4 text-sm text-white`} style={{ background: "#C4622D" }}
          onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Close form" : "New concierge request"}
        </button>
        <button type="button" className={smallBtn} onClick={() => void load()}>Refresh</button>
        <span className="text-xs text-[#7A7068]">{needsYou.length} need you</span>
      </div>

      {showNew && (
        <NewRequestForm
          partners={partners}
          onCreated={async () => { setShowNew(false); await load(); }}
        />
      )}

      <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 sm:p-6">
        <h2 style={serif} className="text-2xl mb-1">Needs you</h2>
        <p className="text-xs text-[#7A7068] mb-4">Newest first. The button tells you the next move.</p>
        {loading && <p className="text-sm text-[#7A7068]">Loading...</p>}
        {!loading && needsYou.length === 0 && <p className="text-sm text-[#7A7068]">Nothing waiting on you.</p>}
        <div className="space-y-3">
          {needsYou.map((r) => (
            <RequestCard
              key={String(r.id)}
              r={r}
              partner={studioFor(r)}
              busy={busy === String(r.id)}
              patch={patch}
              createBooking={createBooking}
            />
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 sm:p-6">
        <button type="button" className="flex items-center gap-2 w-full text-left" onClick={() => setShowDone((v) => !v)}>
          <h2 style={serif} className="text-2xl">Done</h2>
          <span className="text-xs text-[#7A7068]">{done.length}</span>
          <span className="ml-auto text-sm text-[#7A7068]">{showDone ? "Hide" : "Show"}</span>
        </button>
        {showDone && (
          <div className="space-y-3 mt-4">
            {done.map((r) => (
              <RequestCard
                key={String(r.id)}
                r={r}
                partner={studioFor(r)}
                busy={busy === String(r.id)}
                patch={patch}
                createBooking={createBooking}
              />
            ))}
            {done.length === 0 && <p className="text-sm text-[#7A7068]">Nothing here yet.</p>}
          </div>
        )}
      </div>

      {/* Studio directory */}
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
            const digits = waDigits(p.whatsapp || p.phone || "");
            const tel = telHref(p.phone || p.whatsapp || "");
            const page = p.slug ? `/${p.slug}` : `/s/${p.id}`;
            return (
              <div key={p.id} className="rounded-2xl border border-[#E5DDD3] p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.business_name || "Unnamed studio"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                    style={{ background: "#F0E7DB", color: "#7A7068" }}>{p.status || "unknown"}</span>
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {digits ? <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={`${btnBase} h-10 px-3 text-xs text-white`} style={{ background: "#25D366" }}>WhatsApp</a> : null}
                  {tel ? <a href={tel} className={smallBtn}>Call</a> : null}
                  {p.email ? <a href={`mailto:${p.email}`} className={smallBtn}>Email</a> : null}
                  <a href={page} target="_blank" rel="noreferrer" className={smallBtn}>Page</a>
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

/* ─────────── Request card with the stage machine ─────────── */

function RequestCard({
  r, partner, busy, patch, createBooking,
}: {
  r: WaRow;
  partner: PartnerRow | null;
  busy: boolean;
  patch: (r: WaRow, fields: Record<string, any>) => Promise<boolean>;
  createBooking: (r: WaRow) => Promise<void>;
}) {
  const stage = ((r.stage || "new") as Stage);
  const studio = partner?.business_name || r.studio_name || "the studio";
  const studioNumber = partner?.whatsapp || partner?.phone || null;
  const [form, setForm] = useState<null | "confirm" | "alt" | "dead">(null);
  const [cDay, setCDay] = useState(r.confirmed_day || r.day1 || "");
  const [cTime, setCTime] = useState(r.confirmed_time || r.time1 || "");
  const [altDay, setAltDay] = useState("");
  const [altTime, setAltTime] = useState("");
  const [altNote, setAltNote] = useState("");
  const [deadReason, setDeadReason] = useState(DEAD_REASONS[0]);

  const clientWa = (text: string) => waLink(r.client_phone || null, text);
  const waitH = hoursSince(r.studio_asked_at);

  const openAndPatch = (href: string | null, fields: Record<string, any>) => {
    if (href) window.open(href, "_blank", "noopener");
    void patch(r, fields);
  };

  return (
    <div className="rounded-2xl border border-[#E5DDD3] bg-[#FBF8F4] p-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-sm">{clientName(r) || "No name"}</span>
        <span className="text-sm text-[#7A7068]">{r.service_name || "No service"}</span>
        {priceLabel(r) && <span className="text-sm font-medium">{priceLabel(r)}</span>}
        <StageChip stage={stage} />
        <span className="ml-auto text-[11px] text-[#A79C92]">{relTime(r.created_at)}</span>
      </div>
      <p className="text-sm mt-0.5">{studio}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[#7A7068]">
        {pref1(r) && <span>1st: {pref1(r)}</span>}
        {pref2(r) && <span>2nd: {pref2(r)}</span>}
        {r.languages && <span>Speaks {r.languages}</span>}
        {r.contact_email && <span className="break-all">{r.contact_email}</span>}
        {r.client_phone && <span>{r.client_phone}</span>}
        {(r.confirmed_day || r.confirmed_time) && (
          <span className="font-semibold" style={{ color: "#2F5E33" }}>
            Confirmed {[r.confirmed_day, r.confirmed_time].filter(Boolean).join(" ")}
          </span>
        )}
        {r.stage_note && <span className="italic">{r.stage_note}</span>}
        {stage === "studio_asked" && waitH != null && waitH > 3 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#F8D9D0", color: "#8A2A0F" }}>
            waiting {Math.round(waitH)}h
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {/* STAGE new */}
        {stage === "new" && (
          r.client_phone ? (
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#C4622D" }}
              onClick={() => openAndPatch(clientWa(ackText(r, studio)), { stage: "acknowledged", acknowledged_at: new Date().toISOString() })}>
              1. Tell them you are on it
            </button>
          ) : (
            <>
              <CopyButton text={ackText(r, studio)} label="1. Copy the 'on it' reply" />
              <button type="button" disabled={busy} className={smallBtn}
                onClick={() => void patch(r, { stage: "acknowledged", acknowledged_at: new Date().toISOString() })}>
                Mark as told
              </button>
              <p className="text-[11px] text-[#7A7068]">No phone on file, paste this into the WhatsApp chat.</p>
            </>
          )
        )}

        {/* STAGE acknowledged */}
        {stage === "acknowledged" && (
          <>
            {waDigits(studioNumber || "") ? (
              <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#C4622D" }}
                onClick={() => openAndPatch(waLink(studioNumber, studioAskText(r)), { stage: "studio_asked", studio_asked_at: new Date().toISOString() })}>
                2. Ask the studio
              </button>
            ) : (
              <CopyButton text={studioAskText(r)} label="2. Copy the studio message" />
            )}
            <div className="flex gap-2 flex-wrap">
              {partner?.email && (
                <a
                  className={smallBtn}
                  href={`mailto:${partner.email}?subject=${encodeURIComponent("Reserva Massage Club")}&body=${encodeURIComponent(studioAskText(r))}`}
                  onClick={() => void patch(r, { stage: "studio_asked", studio_asked_at: new Date().toISOString() })}
                >
                  Email the studio instead
                </a>
              )}
              <button type="button" className={smallBtn} disabled={busy}
                onClick={() => void patch(r, { stage: "studio_asked", studio_asked_at: new Date().toISOString() })}>
                Mark studio asked
              </button>
            </div>
          </>
        )}

        {/* STAGE studio_asked */}
        {stage === "studio_asked" && (
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={`${btnBase} h-11 px-4 text-xs text-white`} style={{ background: "#2F5E33" }}
              onClick={() => setForm(form === "confirm" ? null : "confirm")}>Studio said yes</button>
            <button type="button" className={`${btnBase} h-11 px-4 text-xs text-white`} style={{ background: "#C4622D" }}
              onClick={() => setForm(form === "alt" ? null : "alt")}>Studio offered another time</button>
            <button type="button" className={smallBtn} disabled={busy}
              onClick={() => void patch(r, { stage_note: `No reply as of ${new Date().toLocaleString()}` })}>
              No reply yet
            </button>
          </div>
        )}

        {/* STAGE studio_replied */}
        {stage === "studio_replied" && (
          <>
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#C4622D" }}
              onClick={() => openAndPatch(clientWa(altOfferText(r, studio)), {})}>
              3. Offer the new time to the client
            </button>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className={smallBtn} onClick={() => setForm(form === "confirm" ? null : "confirm")}>Client accepted</button>
              <button type="button" className={smallBtn} onClick={() => setForm(form === "dead" ? null : "dead")}>Client said no</button>
            </div>
          </>
        )}

        {/* STAGE confirmed */}
        {stage === "confirmed" && (
          <>
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#C4622D" }}
              onClick={() => openAndPatch(clientWa(confirmText(r, studio, partner?.address)), { client_confirmed_at: new Date().toISOString() })}>
              4. Confirm to the client
            </button>
            {!r.client_phone && <CopyButton text={confirmText(r, studio, partner?.address)} label="Copy the confirmation text" />}
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#2F5E33" }}
              onClick={() => void createBooking(r)}>
              5. Create the booking
            </button>
            <p className="text-[11px] text-[#7A7068]">Creates the booking so reminders and follow-ups go out automatically.</p>
            <div className="flex gap-2 flex-wrap">
              {waDigits(studioNumber || "") ? (
                <a className={smallBtn} target="_blank" rel="noreferrer" href={waLink(studioNumber, THANK_STUDIO) || "#"}>Thank the studio</a>
              ) : null}
              <button type="button" className={smallBtn} onClick={() => setForm(form === "confirm" ? null : "confirm")}>Edit day and time</button>
            </div>
          </>
        )}

        {/* STAGE booked */}
        {stage === "booked" && (
          <p className="text-sm" style={{ color: "#2F5E33" }}>
            Booked{r.booking_id ? ` (booking #${r.booking_id})` : ""}. Automation is running.
          </p>
        )}

        {stage === "dead" && (
          <p className="text-sm text-[#7A7068]">Dead{r.stage_note ? `: ${r.stage_note}` : ""}.</p>
        )}

        {/* Inline forms */}
        {form === "confirm" && (
          <div className="rounded-xl border border-[#E5DDD3] bg-white p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7A7068]">Confirmed slot</p>
            <input className={inputCls} value={cDay} onChange={(e) => setCDay(e.target.value)} placeholder="Day (YYYY-MM-DD)" />
            <input className={inputCls} value={cTime} onChange={(e) => setCTime(e.target.value)} placeholder="Time (HH:MM)" />
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#2F5E33" }}
              onClick={async () => {
                const ok = await patch(r, { confirmed_day: cDay.trim(), confirmed_time: cTime.trim(), stage: "confirmed" });
                if (ok) setForm(null);
              }}>
              Save confirmed slot
            </button>
          </div>
        )}

        {form === "alt" && (
          <div className="rounded-xl border border-[#E5DDD3] bg-white p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7A7068]">Alternative from the studio</p>
            <input className={inputCls} value={altDay} onChange={(e) => setAltDay(e.target.value)} placeholder="Day" />
            <input className={inputCls} value={altTime} onChange={(e) => setAltTime(e.target.value)} placeholder="Time" />
            <input className={inputCls} value={altNote} onChange={(e) => setAltNote(e.target.value)} placeholder="Note (optional)" />
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#C4622D" }}
              onClick={async () => {
                const alt = [altDay.trim(), altTime.trim()].filter(Boolean).join(" ");
                const note = [alt, altNote.trim()].filter(Boolean).join(" - ");
                const ok = await patch(r, { stage: "studio_replied", stage_note: note, studio_reply: note });
                if (ok) setForm(null);
              }}>
              Save alternative
            </button>
          </div>
        )}

        {form === "dead" && (
          <div className="rounded-xl border border-[#E5DDD3] bg-white p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7A7068]">Why is it dead</p>
            <select className={inputCls} value={deadReason} onChange={(e) => setDeadReason(e.target.value)}>
              {DEAD_REASONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button type="button" disabled={busy} className={primaryBtn} style={{ background: "#7A7068" }}
              onClick={async () => {
                const ok = await patch(r, { stage: "dead", stage_note: deadReason });
                if (ok) setForm(null);
              }}>
              Mark dead
            </button>
          </div>
        )}

        {stage !== "dead" && stage !== "booked" && form !== "dead" && (
          <button type="button" className="text-[11px] underline text-[#A79C92]" onClick={() => setForm("dead")}>Mark dead</button>
        )}
      </div>
    </div>
  );
}

/* ─────────── Manual request form ─────────── */

function NewRequestForm({ partners, onCreated }: { partners: PartnerRow[]; onCreated: () => void | Promise<void> }) {
  const [f, setF] = useState({
    partner_id: "", first_name: "", last_name: "", client_phone: "", contact_email: "",
    service_name: "", price: "", day1: "", time1: "", day2: "", time2: "", languages: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: any) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!f.first_name.trim()) { setError("First name is required."); return; }
    setSaving(true);
    const p = partners.find((x) => x.id === f.partner_id) || null;
    const { error: e } = await supabase.from("whatsapp_requests").insert({
      partner_id: p?.id ?? null,
      slug: p?.slug ?? null,
      studio_name: p?.business_name || "Unknown studio",
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim() || null,
      client_phone: f.client_phone.trim() || null,
      contact_email: f.contact_email.trim() || null,
      service_name: f.service_name.trim() || null,
      price: f.price.trim() || null,
      day1: f.day1.trim() || null,
      time1: f.time1.trim() || null,
      day2: f.day2.trim() || null,
      time2: f.time2.trim() || null,
      languages: f.languages.trim() || null,
      stage: "new",
      stage_updated_at: new Date().toISOString(),
    } as any);
    setSaving(false);
    if (e) { setError(e.message); return; }
    await onCreated();
  };

  return (
    <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 sm:p-6 space-y-2">
      <h3 style={serif} className="text-xl mb-2">New concierge request</h3>
      {error && <p className="text-sm" style={{ color: "#8A3D14" }}>{error}</p>}
      <select className={inputCls} value={f.partner_id} onChange={set("partner_id")}>
        <option value="">Pick a studio</option>
        {partners.map((p) => <option key={p.id} value={p.id}>{p.business_name || p.slug || p.id}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} placeholder="First name" value={f.first_name} onChange={set("first_name")} />
        <input className={inputCls} placeholder="Last name" value={f.last_name} onChange={set("last_name")} />
        <input className={inputCls} placeholder="Phone" value={f.client_phone} onChange={set("client_phone")} />
        <input className={inputCls} placeholder="Email" value={f.contact_email} onChange={set("contact_email")} />
        <input className={inputCls} placeholder="Service" value={f.service_name} onChange={set("service_name")} />
        <input className={inputCls} placeholder="Price" value={f.price} onChange={set("price")} />
        <input className={inputCls} placeholder="Day 1 (YYYY-MM-DD)" value={f.day1} onChange={set("day1")} />
        <input className={inputCls} placeholder="Time 1 (HH:MM)" value={f.time1} onChange={set("time1")} />
        <input className={inputCls} placeholder="Day 2" value={f.day2} onChange={set("day2")} />
        <input className={inputCls} placeholder="Time 2" value={f.time2} onChange={set("time2")} />
      </div>
      <input className={inputCls} placeholder="Languages (e.g. English, Spanish)" value={f.languages} onChange={set("languages")} />
      <button type="button" disabled={saving} className={primaryBtn} style={{ background: "#C4622D" }} onClick={() => void submit()}>
        {saving ? "Saving..." : "Create request"}
      </button>
    </div>
  );
}
