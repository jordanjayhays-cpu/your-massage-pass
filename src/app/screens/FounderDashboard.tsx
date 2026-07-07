import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const FONT_CSS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Outfit:wght@400;500;600&display=swap";
const FOUNDER_EMAIL = "jordanjayhays@gmail.com";

type Booking = {
  id: number | string;
  client_name?: string;
  spa_name?: string;
  booking_date?: string;
  booking_time?: string;
  status?: string;
  created_at?: string;
};
type Partner = { id: string; business_name?: string };
type ValRow = {
  id: string;
  survey_type: "b2c" | "b2b";
  answers: Record<string, any>;
  email?: string | null;
  contact?: string | null;
  created_at: string;
};

function collectKeys(rows: ValRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (!r.answers || typeof r.answers !== "object") continue;
    for (const k of Object.keys(r.answers)) {
      if (k === "comments") continue;
      set.add(k);
    }
  }
  return Array.from(set);
}


const serif = { fontFamily: "'Fraunces', serif" };
const shellStyle: React.CSSProperties = {
  background: "linear-gradient(180deg,#F7F4F0 0%,#EFE7DD 100%)",
  color: "#211C1A",
  fontFamily: "'Outfit', system-ui, sans-serif",
  minHeight: "100vh",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white border border-[#E5DDD3] p-6 shadow-[0_10px_30px_-20px_rgba(122,48,0,0.2)]">
      <h2 style={serif} className="text-2xl mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068]">{label}</p>
      <p style={serif} className="text-3xl mt-1">{value}</p>
    </div>
  );
}

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#211C1A]">{label}</span>
        <span className="text-[#7A7068]">{count} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#F0E7DB] overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: "#C4622D" }} />
      </div>
    </div>
  );
}

export default function FounderDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [validation, setValidation] = useState<ValRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user?.email;
  const isFounder = email === FOUNDER_EMAIL;

  useEffect(() => {
    if (!isFounder) return;
    (async () => {
      const [
        { count: profCount },
        { data: bks },
        { data: prs },
        { data: vals },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("partners").select("id,business_name"),
        supabase.from("validation_responses").select("*").order("created_at", { ascending: false }),
      ]);
      setProfileCount(profCount ?? 0);
      setBookings(bks ?? []);
      setPartners(prs ?? []);
      setValidation((vals as ValRow[]) ?? []);
    })();
  }, [isFounder, refreshTick]);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/founder` },
    });
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  if (loading) {
    return <div style={shellStyle} className="flex items-center justify-center"><link href={FONT_CSS} rel="stylesheet" /><p className="text-[#7A7068]">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div style={shellStyle} className="flex items-center justify-center px-6">
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-md text-center py-16">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068] mb-3">Founder</p>
          <h1 style={serif} className="text-4xl mb-6">Sign in to continue.</h1>
          <button
            onClick={signIn}
            className="w-full h-13 py-3 rounded-full text-base font-medium"
            style={{ background: "#C4622D", color: "#F7F4F0" }}
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isFounder) {
    return (
      <div style={shellStyle} className="flex items-center justify-center px-6">
        <link href={FONT_CSS} rel="stylesheet" />
        <div className="max-w-md text-center py-16">
          <h1 style={serif} className="text-4xl mb-3">Not authorized.</h1>
          <p className="text-[#7A7068] mb-6">Signed in as {email}</p>
          <button onClick={signOut} className="text-sm text-[#C4622D] underline">Sign out</button>
        </div>
      </div>
    );
  }

  // Aggregate bookings
  const now = Date.now();
  const last30 = bookings.filter((b) => b.created_at && now - new Date(b.created_at).getTime() < 30 * 86400000).length;
  const byStatus = { pending: 0, confirmed: 0, cancelled: 0 } as Record<string, number>;
  for (const b of bookings) {
    const s = (b.status || "").toLowerCase();
    if (s in byStatus) byStatus[s]++;
  }

  const bookingsByPartner: Record<string, number> = {};
  for (const b of bookings) {
    const key = (b.spa_name || "").trim();
    if (!key) continue;
    bookingsByPartner[key] = (bookingsByPartner[key] || 0) + 1;
  }

  const b2c = validation.filter((v) => v.survey_type === "b2c");
  const b2b = validation.filter((v) => v.survey_type === "b2b");

  const freq = (rows: ValRow[], key: string) => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const v = r.answers?.[key];
      if (!v || typeof v !== "string") continue;
      map[v] = (map[v] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  return (
    <div style={shellStyle}>
      <link href={FONT_CSS} rel="stylesheet" />
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase text-[#7A7068]">Founder dashboard</p>
            <h1 style={serif} className="text-4xl mt-1">Massage Club · Madrid</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRefreshTick((t) => t + 1)} className="px-4 h-10 rounded-full border border-[#E5DDD3] bg-white text-sm">Refresh</button>
            <button onClick={signOut} className="px-4 h-10 rounded-full text-sm text-[#7A7068]">Sign out</button>
          </div>
        </div>

        <div className="space-y-6">
          <Card title="Demand">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
              <Stat label="Profiles" value={profileCount ?? "—"} />
              <Stat label="Bookings total" value={bookings.length} />
              <Stat label="Last 30 days" value={last30} />
              <Stat label="Confirmed" value={byStatus.confirmed} />
              <Stat label="Pending" value={byStatus.pending} />
            </div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-3">10 most recent bookings</p>
            <div className="divide-y divide-[#F0E7DB]">
              {bookings.slice(0, 10).map((b) => (
                <div key={b.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{b.client_name || "—"}</span>
                  <span className="text-[#7A7068]">· {b.spa_name || "—"}</span>
                  <span className="text-[#7A7068]">· {b.booking_date} {b.booking_time}</span>
                  <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                    style={{
                      background: b.status === "confirmed" ? "#DDEFD8" : b.status === "cancelled" ? "#F4D6D0" : "#F4E9D6",
                      color: "#211C1A",
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              ))}
              {bookings.length === 0 && <p className="text-sm text-[#7A7068] py-4">No bookings yet.</p>}
            </div>
          </Card>

          <Card title="Supply">
            <Stat label="Partners" value={partners.length} />
            <div className="mt-6 divide-y divide-[#F0E7DB]">
              {partners.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <span>{p.business_name || "Unnamed studio"}</span>
                  <span className="text-[#7A7068]">{bookingsByPartner[(p.business_name || "").trim()] || 0} bookings</span>
                </div>
              ))}
              {partners.length === 0 && <p className="text-sm text-[#7A7068] py-4">No partners yet.</p>}
            </div>
          </Card>

          <Card title="Validation">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <Stat label="B2C responses" value={b2c.length} />
              <Stat label="B2B responses" value={b2b.length} />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-3">B2C — customers</p>
                {collectKeys(b2c).map((k) => {
                  const rows = freq(b2c, k);
                  const total = rows.reduce((s, [, c]) => s + c, 0);
                  return (
                    <div key={k} className="mb-5">
                      <p style={serif} className="text-base mb-2 capitalize">{k.replace(/_/g, " ")}</p>
                      {rows.length ? rows.map(([label, count]) => (
                        <Bar key={label} label={label} count={count} total={total} />
                      )) : <p className="text-xs text-[#7A7068]">No data.</p>}
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-3">B2B — studios</p>
                {B2B_CHOICE_KEYS.map((k) => {
                  const rows = freq(b2b, k);
                  const total = rows.reduce((s, [, c]) => s + c, 0);
                  return (
                    <div key={k} className="mb-5">
                      <p style={serif} className="text-base mb-2 capitalize">{k.replace(/_/g, " ")}</p>
                      {rows.length ? rows.map(([label, count]) => (
                        <Bar key={label} label={label} count={count} total={total} />
                      )) : <p className="text-xs text-[#7A7068]">No data.</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-4 text-sm text-[#C4622D] font-medium"
            >
              {expanded ? "Hide" : "Show"} all responses ({validation.length})
            </button>

            {expanded && (
              <div className="mt-4 space-y-3">
                {validation.map((r) => (
                  <div key={r.id} className="rounded-xl border border-[#E5DDD3] bg-[#FBF8F4] p-4 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                        style={{
                          background: r.survey_type === "b2c" ? "#EFE4D6" : "#DDE5EF",
                          color: "#211C1A",
                        }}
                      >
                        {r.survey_type}
                      </span>
                      <span className="text-[#7A7068] text-xs">{new Date(r.created_at).toLocaleString()}</span>
                      {r.email && <span className="text-[#C4622D] text-xs ml-auto">{r.email}</span>}
                      {r.contact && <span className="text-[#C4622D] text-xs ml-auto">{r.contact}</span>}
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-[#211C1A] font-mono leading-relaxed">
{JSON.stringify(r.answers, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
