import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FounderAgentChat from "./FounderAgentChat";
import StudioPipeline from "./founder/StudioPipeline";
import ConciergeTab from "./founder/ConciergeTab";
import FindStudio from "./founder/FindStudio";
import BookingWaButtons from "./founder/BookingWaButtons";
import RecentActivity from "./founder/RecentActivity";




const FONT_CSS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Outfit:wght@400;500;600&display=swap";
const FOUNDER_EMAILS = ["jordan.hays@student.ie.edu", "jordanjayhays@gmail.com"];

type Booking = {
  id: number | string;
  client_name?: string;
  client_email?: string | null;
  spa_name?: string;
  massage_type?: string | null;
  booking_date?: string;
  booking_time?: string;
  status?: string;
  created_at?: string;
  is_test?: boolean | null;
  partner_id?: string | null;
  client_phone?: string | null;
  lang?: string | null;
  client_lang?: string | null;
};
type Partner = {
  id: string;
  business_name?: string;
  slug?: string | null;
  status?: string | null;
  email?: string | null;
  outreach_email_at?: string | null;
  outreach_status?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
};
type SiteVisit = { visitor_key?: string | null; path?: string | null; day?: string | null };
type SiteEvent = { event?: string | null; visitor_key?: string | null; day?: string | null; partner_slug?: string | null };
type WaRequest = {
  id?: string;
  studio_name?: string | null;
  first_name?: string | null;
  slug?: string | null;
  partner_id?: string | null;
  outcome?: string | null;
  created_at?: string;
};
type CustomerContact = {
  email?: string | null;
  bookings?: number | null;
  has_account?: boolean | null;
  marketing_opt_in?: boolean | null;
};

type ValRow = {
  id: string;
  survey_type: "b2c" | "b2b";
  answers: Record<string, any>;
  email?: string | null;
  contact?: string | null;
  source?: string | null;
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

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

const LINK_GROUPS = [
  { group: "Customer survey (B2C)", path: "/survey/customers", items: [
    { label: "IE classmates", tag: "ie" },
    { label: "Expat Facebook", tag: "fbexpat" },
    { label: "Digital nomads", tag: "nomad" },
    { label: "Tourists", tag: "tourist" },
    { label: "Instagram", tag: "ig" },
    { label: "Plain link (no tag)", tag: "" },
  ]},
  { group: "Studio survey (B2B)", path: "/survey/studios", items: [
    { label: "Studios — in person", tag: "studio" },
    { label: "Studios — Instagram", tag: "ig" },
    { label: "Plain link (no tag)", tag: "" },
  ]},
];

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

function StatSplit({ label, real, test }: { label: string; real: number; test: number }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068]">{label}</p>
      <p style={serif} className="text-3xl mt-1">{real}</p>
      <p className="text-[11px] text-[#A79C92] mt-0.5">{real} real · {test} test</p>
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

const DAY_MS = 86400000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Hero stat card: big serif number, EN/ES label, optional delta and muted note. */
function HeroStat({
  label, labelEs, value, delta, note,
}: {
  label: string; labelEs: string; value: number | string;
  delta?: number | null; note?: string | null;
}) {
  const up = typeof delta === "number" && delta > 0;
  const down = typeof delta === "number" && delta < 0;
  return (
    <div className="rounded-3xl bg-white border border-[#E5DDD3] p-5 shadow-[0_10px_30px_-20px_rgba(122,48,0,0.2)]">
      <p style={serif} className="text-4xl leading-none">{value}</p>
      <p className="text-[12px] font-medium mt-2 text-[#211C1A]">{label}</p>
      <p className="text-[11px] text-[#A79C92]">{labelEs}</p>
      {typeof delta === "number" && delta !== 0 && (
        <p className="text-[11px] mt-1.5 font-medium" style={{ color: up ? "#3F7A46" : down ? "#B4483A" : "#7A7068" }}>
          {up ? "▲" : "▼"} {Math.abs(delta)} vs last week
        </p>
      )}
      {note && <p className="text-[11px] text-[#A79C92] mt-1.5">{note}</p>}
    </div>
  );
}

function StatusChip({ status }: { status?: string | null }) {
  const s = (status || "").toLowerCase();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    confirmed: { bg: "#DDEFD8", fg: "#2F5E33", label: "Confirmed" },
    pending: { bg: "#F4E9D6", fg: "#5A4413", label: "Pending" },
    cancelled: { bg: "#F4D6D0", fg: "#8A3626", label: "Cancelled" },
    active: { bg: "#DDEFD8", fg: "#2F5E33", label: "Claimed" },
  };
  const v = map[s] || { bg: "#F0E7DB", fg: "#7A7068", label: status || "unknown" };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ background: v.bg, color: v.fg }}>
      {v.label}
    </span>
  );
}

/** Horizontal funnel bar with count and drop-off from the previous stage. */
function FunnelRow({
  label, labelEs, count, top, prev,
}: { label: string; labelEs: string; count: number; top: number; prev: number | null }) {
  const pct = top ? Math.round((count / top) * 100) : 0;
  const drop = prev != null && prev > 0 ? Math.round(((prev - count) / prev) * 100) : null;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline text-xs mb-1 gap-3">
        <span className="text-[#211C1A]">{label} <span className="text-[#A79C92]">{labelEs}</span></span>
        <span className="text-[#7A7068] whitespace-nowrap">
          {count === 0 ? "collecting data" : `${count} · ${pct}%`}
          {drop != null && count > 0 ? ` · ${drop}% drop off` : ""}
        </span>
      </div>
      <div className="h-3 rounded-full bg-[#F0E7DB] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, count ? 4 : 0)}%`, background: "#C4622D" }} />
      </div>
    </div>
  );
}


export default function FounderDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [tab, setTab] = useState<"overview" | "concierge" | "find a studio">("overview");


  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [validation, setValidation] = useState<ValRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("__all__");
  const [showTestBookings, setShowTestBookings] = useState(false);
  const [marketingContacts, setMarketingContacts] = useState<Array<{
    email: string | null;
    name: string | null;
    phone: string | null;
    lang: string | null;
    bookings: number | null;
    last_booking_at: string | null;
  }>>([]);
  const [totalDistinctEmails, setTotalDistinctEmails] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<Array<{
    id: string; studio_name: string; area: string | null; reason: string | null;
    client_email: string | null; status: string; created_at: string;
  }>>([]);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [waRequests, setWaRequests] = useState<WaRequest[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);



  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user?.email;
  const isFounder = !!email && (
    email.toLowerCase().endsWith("@massageclub.io") ||
    FOUNDER_EMAILS.includes(email.toLowerCase())
  );

  useEffect(() => {
    if (!isFounder) return;
    (async () => {
      const since14 = dayKey(Date.now() - 14 * DAY_MS);
      const since90 = new Date(Date.now() - 90 * DAY_MS).toISOString();
      const [
        { count: profCount },
        { data: bks },
        { data: prs },
        { data: vals },
        { data: mktRows },
        { data: allEmailRows },
        { data: visitRows },
        { data: eventRows },
        { data: waRows },
        { data: contactRows },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("partners").select("id,business_name,slug,status,email,outreach_email_at,outreach_status,phone,whatsapp,address"),
        supabase.from("validation_responses").select("*").order("created_at", { ascending: false }),
        supabase.from("marketing_contacts").select("*").order("last_booking_at", { ascending: false }),
        supabase.from("bookings").select("client_email").not("client_email", "is", null).limit(10000),
        supabase.from("site_visits").select("visitor_key,path,day").gte("day", since14).limit(20000),
        supabase.from("site_events").select("event,visitor_key,day,partner_slug").gte("day", since14).limit(20000),
        supabase.from("whatsapp_requests").select("*").gte("created_at", since90).order("created_at", { ascending: false }).limit(2000),
        supabase.from("customer_contacts").select("email,bookings,has_account,marketing_opt_in").limit(10000),
      ]);
      setProfileCount(profCount ?? 0);
      setBookings(bks ?? []);
      setPartners((prs as Partner[]) ?? []);
      setValidation((vals as ValRow[]) ?? []);
      setMarketingContacts((mktRows as any[]) ?? []);
      setVisits((visitRows as SiteVisit[]) ?? []);
      setEvents((eventRows as SiteEvent[]) ?? []);
      setWaRequests((waRows as WaRequest[]) ?? []);
      setContacts((contactRows as CustomerContact[]) ?? []);
      const distinct = new Set<string>();
      for (const r of (allEmailRows as any[]) ?? []) {
        const e = (r?.client_email || "").toLowerCase().trim();
        if (e) distinct.add(e);
      }
      setTotalDistinctEmails(distinct.size);

      const { data: sugRows } = await supabase
        .from("studio_suggestions")
        .select("id, studio_name, area, reason, client_email, status, created_at")
        .order("created_at", { ascending: false });
      setSuggestions((sugRows as any[]) ?? []);

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

  // ── Booking truth: a booking is never cancelled and never a test row ────────
  const now = Date.now();
  const isTest = (b: Booking) => b.is_test === true;
  const isCancelled = (b: Booking) => (b.status || "").toLowerCase() === "cancelled";
  const realBookings = bookings.filter((b) => !isTest(b) && !isCancelled(b));
  const cancelledReal = bookings.filter((b) => !isTest(b) && isCancelled(b));
  const testBookings = bookings.filter(isTest);
  const createdAt = (b: Booking) => (b.created_at ? new Date(b.created_at).getTime() : 0);
  const weekStart = now - 7 * DAY_MS;
  const prevWeekStart = now - 14 * DAY_MS;
  const bookingsThisWeek = realBookings.filter((b) => createdAt(b) >= weekStart).length;
  const bookingsPrevWeek = realBookings.filter((b) => createdAt(b) >= prevWeekStart && createdAt(b) < weekStart).length;
  const cancelledThisWeek = cancelledReal.filter((b) => createdAt(b) >= weekStart).length;

  const today = dayKey(now);
  const isFuture = (b: Booking) => !!b.booking_date && b.booking_date >= today;
  const completedAllTime = realBookings.filter(
    (b) => (b.status || "").toLowerCase() === "completed" || (!!b.booking_date && b.booking_date < today)
  ).length;
  const upcoming = realBookings
    .filter(isFuture)
    .sort((a, b) => `${a.booking_date} ${a.booking_time}`.localeCompare(`${b.booking_date} ${b.booking_time}`));
  const upcomingConfirmed = upcoming.filter((b) => (b.status || "").toLowerCase() === "confirmed").length;

  // Partner lookup so each booking card can reach the studio's WhatsApp number.
  const partnerFor = (b: Booking): Partner | null => {
    if (b.partner_id) {
      const byId = partners.find((p) => p.id === b.partner_id);
      if (byId) return byId;
    }
    const name = (b.spa_name || "").trim().toLowerCase();
    return partners.find((p) => (p.business_name || "").trim().toLowerCase() === name) || null;
  };

  // Due soon: confirmed, non test bookings happening today or tomorrow.
  const tomorrow = dayKey(now + DAY_MS);
  const dueSoon = upcoming.filter(
    (b) =>
      (b.status || "").toLowerCase() === "confirmed" &&
      (b.booking_date === today || b.booking_date === tomorrow)
  );

  const within30 = (b: Booking) => !!b.created_at && now - createdAt(b) < 30 * DAY_MS;
  const last30 = realBookings.filter(within30).length;
  const last30Test = testBookings.filter(within30).length;
  const byStatus = { pending: 0, confirmed: 0, cancelled: 0 } as Record<string, number>;
  const byStatusTest = { pending: 0, confirmed: 0, cancelled: 0 } as Record<string, number>;
  for (const b of bookings) {
    const s = (b.status || "").toLowerCase();
    if (!(s in byStatus)) continue;
    if (isTest(b)) byStatusTest[s]++; else byStatus[s]++;
  }

  const bookingsByPartner: Record<string, number> = {};
  const bookingsByPartnerId: Record<string, number> = {};
  for (const b of realBookings) {
    const key = (b.spa_name || "").trim();
    if (key) bookingsByPartner[key] = (bookingsByPartner[key] || 0) + 1;
    if (b.partner_id) bookingsByPartnerId[b.partner_id] = (bookingsByPartnerId[b.partner_id] || 0) + 1;
  }
  const realBookingsFor = (p: Partner) =>
    bookingsByPartnerId[p.id] ?? bookingsByPartner[(p.business_name || "").trim()] ?? 0;

  const recentBookings = (showTestBookings ? bookings : realBookings).slice(0, 10);

  // ── Traffic ─────────────────────────────────────────────────────────────────
  const weekDay = dayKey(weekStart);
  const prevDay = dayKey(prevWeekStart);
  const visitorsThisWeek = new Set(
    visits.filter((v) => (v.day || "") >= weekDay && v.visitor_key).map((v) => v.visitor_key as string)
  ).size;
  const visitorsPrevWeek = new Set(
    visits.filter((v) => (v.day || "") >= prevDay && (v.day || "") < weekDay && v.visitor_key).map((v) => v.visitor_key as string)
  ).size;

  const eventsThisWeek = events.filter((e) => (e.day || "") >= weekDay);
  const countEvent = (name: string) => eventsThisWeek.filter((e) => e.event === name).length;
  const funnel = [
    { label: "Visitors", labelEs: "Visitantes", count: visitorsThisWeek },
    { label: "Studio views", labelEs: "Vistas de estudio", count: countEvent("studio_view") },
    { label: "Service selected", labelEs: "Servicio elegido", count: countEvent("wizard_service_selected") },
    { label: "Booking submitted", labelEs: "Reserva enviada", count: countEvent("booking_submitted") },
  ];
  const funnelTop = funnel[0].count || Math.max(...funnel.map((f) => f.count), 1);

  const pageViewsBySlug: Record<string, number> = {};
  for (const v of visits) {
    if ((v.day || "") < weekDay) continue;
    const path = (v.path || "").replace(/^\/+|\/+$/g, "");
    if (!path) continue;
    const last = path.split("/").pop() as string;
    pageViewsBySlug[last] = (pageViewsBySlug[last] || 0) + 1;
  }

  // ── Demand signals ──────────────────────────────────────────────────────────
  const realWa = waRequests.filter((w) => (w.first_name || "").trim().toLowerCase() !== "preview");
  const waThisWeek = realWa.filter((w) => w.created_at && new Date(w.created_at).getTime() >= weekStart);
  const waCountByStudio: Record<string, number> = {};
  for (const w of realWa) {
    const key = (w.slug || w.partner_id || (w.studio_name || "").trim()).toString();
    if (!key) continue;
    waCountByStudio[key] = (waCountByStudio[key] || 0) + 1;
  }
  const waCountFor = (p: Partner) =>
    (p.slug ? waCountByStudio[p.slug] || 0 : 0) ||
    waCountByStudio[p.id] ||
    waCountByStudio[(p.business_name || "").trim()] ||
    0;

  // ── Supply ──────────────────────────────────────────────────────────────────
  const claimedCount = partners.filter((p) => (p.status || "").toLowerCase() === "active").length;
  const contactedCount = partners.filter((p) => !!p.outreach_email_at).length;
  const followUpCount = partners.filter((p) => {
    const out = (p.outreach_status || "").toLowerCase();
    if (out === "bounced" || out === "rejected" || out === "skipped_not_massage") return false;
    if ((p.status || "").toLowerCase() === "active") return false;
    return !!p.outreach_email_at;
  }).length;

  // ── Customers ───────────────────────────────────────────────────────────────
  const contactsTotal = contacts.length;
  const contactsWithBookings = contacts.filter((c) => (c.bookings ?? 0) > 0).length;
  const contactsWithAccounts = contacts.filter((c) => c.has_account === true).length;
  const contactsOptedIn = contacts.filter((c) => c.marketing_opt_in === true).length;


  // Source filter
  const sourceCounts: Record<string, number> = {};
  for (const v of validation) {
    const s = (v.source && v.source.trim()) || "direct";
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  const sourceOptions = Object.keys(sourceCounts).sort((a, b) => sourceCounts[b] - sourceCounts[a]);
  const filteredValidation = sourceFilter === "__all__"
    ? validation
    : validation.filter((v) => ((v.source && v.source.trim()) || "direct") === sourceFilter);

  const b2c = filteredValidation.filter((v) => v.survey_type === "b2c");
  const b2b = filteredValidation.filter((v) => v.survey_type === "b2b");

  const freq = (rows: ValRow[], key: string) => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const v = r.answers?.[key];
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item !== "string" || !item) continue;
          map[item] = (map[item] || 0) + 1;
        }
      } else if (typeof v === "string" && v) {
        map[v] = (map[v] || 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const formatAnswers = (obj: Record<string, any>) => {
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");
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

        <div className="flex gap-2 mb-6">
          {(["overview", "concierge", "find a studio"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 h-9 rounded-full text-sm font-medium border capitalize"
              style={{
                background: tab === t ? "#C4622D" : "#FFFFFF",
                color: tab === t ? "#F7F4F0" : "#211C1A",
                borderColor: tab === t ? "#C4622D" : "#E5DDD3",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "concierge" && <ConciergeTab refreshTick={refreshTick} />}

        {tab === "find a studio" && <FindStudio refreshTick={refreshTick} />}

        {tab === "overview" && (
        <>
        {/* 0. Due soon */}
        {dueSoon.length > 0 && (
          <div className="rounded-3xl bg-white border border-[#E5DDD3] p-4 sm:p-5 mb-6">
            <div className="flex items-baseline gap-2 mb-3">
              <h2 style={serif} className="text-2xl">Due soon</h2>
              <span className="text-xs text-[#7A7068]">Today and tomorrow</span>
            </div>
            <div className="space-y-2">
              {dueSoon.map((b) => (
                <div key={`due-${b.id}`} className="rounded-2xl border border-[#E5DDD3] bg-[#FBF8F4] p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                    <span className="font-semibold tabular-nums">
                      {b.booking_date === today ? "Today" : "Tomorrow"} {b.booking_time}
                    </span>
                    <span>{(b.client_name || "Guest").trim().split(" ")[0]}</span>
                    <span className="text-[#7A7068]">· {b.spa_name || "Studio"}</span>
                    {b.massage_type && (
                      <span className="text-[#7A7068]">· {String(b.massage_type).replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <BookingWaButtons booking={b} partner={partnerFor(b)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1. Hero row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

          <HeroStat
            label="Bookings this week"
            labelEs="Reservas esta semana"
            value={bookingsThisWeek}
            delta={bookingsThisWeek - bookingsPrevWeek}
            note={cancelledThisWeek ? `${cancelledThisWeek} rescheduled or cancelled` : null}
          />
          <HeroStat label="Completed all time" labelEs="Completadas en total" value={completedAllTime} />
          <HeroStat
            label="Upcoming"
            labelEs="Próximas"
            value={upcomingConfirmed}
            note={upcoming.length > upcomingConfirmed ? `${upcoming.length - upcomingConfirmed} awaiting confirmation` : null}
          />
          <HeroStat
            label="Visitors this week"
            labelEs="Visitantes esta semana"
            value={visitorsThisWeek}
            delta={visitorsPrevWeek ? visitorsThisWeek - visitorsPrevWeek : null}
          />
        </div>

        <div className="space-y-6">
          {/* 1b. Booking funnel + recent activity */}
          <RecentActivity refreshTick={refreshTick} />

          {/* 2. Upcoming bookings */}

          <Card title="Upcoming bookings">
            <div className="divide-y divide-[#F0E7DB]">
              {upcoming.slice(0, 12).map((b) => (
                <div key={b.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium tabular-nums">{b.booking_date} {b.booking_time}</span>
                  <span>{(b.client_name || "Guest").trim().split(" ")[0]}</span>
                  <span className="text-[#7A7068]">· {b.spa_name || "Studio"}</span>
                  {b.massage_type && <span className="text-[#7A7068]">· {String(b.massage_type).replace(/_/g, " ")}</span>}
                  <span className="ml-auto flex items-center gap-2">
                    <BookingWaButtons booking={b} partner={partnerFor(b)} />
                    <StatusChip status={b.status} />
                  </span>
                </div>
              ))}
              {upcoming.length === 0 && <p className="text-sm text-[#7A7068] py-4">No upcoming bookings yet.</p>}
            </div>
          </Card>

          {/* 3. Funnel */}
          <Card title="Funnel this week">
            {funnel.map((f, i) => (
              <FunnelRow
                key={f.label}
                label={f.label}
                labelEs={f.labelEs}
                count={f.count}
                top={funnelTop}
                prev={i === 0 ? null : funnel[i - 1].count}
              />
            ))}
          </Card>

          {/* 4. Demand signals */}
          <Card title="Demand signals">
            <div className="flex items-baseline gap-3 mb-4">
              <p style={serif} className="text-3xl">{waThisWeek.length}</p>
              <p className="text-sm text-[#7A7068]">WhatsApp requests this week / Solicitudes de WhatsApp esta semana</p>
            </div>
            <div className="divide-y divide-[#F0E7DB]">
              {waThisWeek.map((w, i) => (
                <div key={(w.id || "") + i} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{w.studio_name || "Unknown studio"}</span>
                  {w.first_name && <span className="text-[#7A7068]">· {w.first_name}</span>}
                  <span className="text-[#7A7068]">· {w.created_at ? new Date(w.created_at).toLocaleDateString() : ""}</span>
                  {w.outcome && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                      style={{ background: w.outcome === "happened" ? "#DDEFD8" : "#F0E7DB", color: "#211C1A" }}>
                      {w.outcome === "happened" ? "Happened" : w.outcome === "no_reply" ? "No reply" : w.outcome}
                    </span>
                  )}
                </div>
              ))}
              {waThisWeek.length === 0 && <p className="text-sm text-[#7A7068] py-4">No WhatsApp requests this week.</p>}
            </div>
          </Card>


          <Card title="Your links">
            <p className="text-sm text-[#7A7068] mb-4">Copy a link and share it. The tag on the end records which audience it came from. Nobody filling it out sees it.</p>
            {LINK_GROUPS.map((g) => (
              <div key={g.group} className="mb-5">
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2">{g.group}</p>
                <div className="space-y-2">
                  {g.items.map((it) => {
                    const url = ORIGIN + g.path + (it.tag ? `?src=${it.tag}` : "");
                    return (
                      <div key={it.label} className="flex items-center gap-3 flex-wrap rounded-2xl border border-[#E5DDD3] bg-white px-3 py-2">
                        <span className="text-sm font-medium min-w-[130px]">{it.label}</span>
                        <span className="text-xs text-[#7A7068] font-mono truncate flex-1 min-w-[120px]">{url}</span>
                        <button
                          onClick={() => { navigator.clipboard?.writeText(url); }}
                          className="text-xs font-semibold px-3 h-8 rounded-full text-white"
                          style={{ background: "#C4622D" }}
                        >Copy</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-[#E5DDD3]">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2">Dashboard</p>
              <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-[#E5DDD3] bg-white px-3 py-2">
                <span className="text-sm font-medium min-w-[130px]">Founder dashboard</span>
                <span className="text-xs text-[#7A7068] font-mono truncate flex-1 min-w-[120px]">{ORIGIN + "/founder"}</span>
                <button
                  onClick={() => { navigator.clipboard?.writeText(ORIGIN + "/founder"); }}
                  className="text-xs font-semibold px-3 h-8 rounded-full text-white"
                  style={{ background: "#C4622D" }}
                >Copy</button>
              </div>
            </div>
          </Card>

          <Card title="Demand">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
              <Stat label="Profiles" value={profileCount ?? "—"} />
              <StatSplit label="Bookings total" real={realBookings.length} test={testBookings.length} />
              <StatSplit label="Last 30 days" real={last30} test={last30Test} />
              <StatSplit label="Confirmed" real={byStatus.confirmed} test={byStatusTest.confirmed} />
              <StatSplit label="Pending" real={byStatus.pending} test={byStatusTest.pending} />
            </div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068]">10 most recent bookings</p>
              <label className="flex items-center gap-2 text-xs text-[#7A7068] cursor-pointer">
                <input type="checkbox" checked={showTestBookings} onChange={(e) => setShowTestBookings(e.target.checked)} />
                Include test
              </label>
            </div>
            <div className="divide-y divide-[#F0E7DB]">
              {recentBookings.map((b) => (
                <div key={b.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{b.client_name || "—"}</span>
                  <span className="text-[#7A7068]">· {b.spa_name || "—"}</span>
                  <span className="text-[#7A7068]">· {b.booking_date} {b.booking_time}</span>
                  {b.is_test === true && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest text-[#7A7068]" style={{ background: "#F0E7DB" }}>Test</span>
                  )}
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
              {recentBookings.length === 0 && <p className="text-sm text-[#7A7068] py-4">No real bookings yet.</p>}
            </div>
          </Card>

          <StudioPipeline refreshTick={refreshTick} />

          <Card title="Supply">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <Stat label="Studios total" value={partners.length} />
              <Stat label="Claimed" value={claimedCount} />
              <Stat label="Contacted" value={contactedCount} />
              <Stat label="Eligible for follow-up" value={followUpCount} />
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border border-[#E5DDD3]">
              <table className="w-full text-sm">
                <thead className="bg-[#FBF8F4] sticky top-0">
                  <tr className="text-left text-[11px] uppercase tracking-widest text-[#7A7068]">
                    <th className="px-3 py-2">Studio</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Bookings</th>
                    <th className="px-3 py-2">WhatsApp</th>
                    <th className="px-3 py-2">Views 7d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E7DB]">
                  {[...partners]
                    .sort((a, b) => realBookingsFor(b) - realBookingsFor(a) || waCountFor(b) - waCountFor(a))
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-medium">{p.business_name || "Unnamed studio"}</td>
                        <td className="px-3 py-2"><StatusChip status={p.status} /></td>
                        <td className="px-3 py-2">{realBookingsFor(p)}</td>
                        <td className="px-3 py-2 text-[#7A7068]">{waCountFor(p)}</td>
                        <td className="px-3 py-2 text-[#7A7068]">{p.slug ? (pageViewsBySlug[p.slug] || 0) : "—"}</td>
                      </tr>
                    ))}
                  {partners.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[#7A7068]">No studios yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Clientes / Customer list">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
              <Stat label="Total contacts" value={contactsTotal || totalDistinctEmails} />
              <Stat label="With bookings" value={contactsWithBookings} />
              <Stat label="With accounts" value={contactsWithAccounts} />
              <Stat label="Marketing opt-ins" value={contactsOptedIn || marketingContacts.length} />
            </div>

            <div className="flex justify-end mb-3">
              <button
                onClick={() => {
                  const header = ["name","email","phone","lang","bookings","last_booking_at"];
                  const escape = (v: any) => {
                    const s = v == null ? "" : String(v);
                    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                  };
                  const lines = [header.join(",")];
                  for (const c of marketingContacts) {
                    lines.push([c.name, c.email, c.phone, c.lang, c.bookings, c.last_booking_at].map(escape).join(","));
                  }
                  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `massage-club-customers-${new Date().toISOString().slice(0,10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="text-xs font-semibold px-4 h-9 rounded-full text-white"
                style={{ background: "#C4622D" }}
              >Exportar CSV</button>
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border border-[#E5DDD3]">
              <table className="w-full text-sm">
                <thead className="bg-[#FBF8F4] sticky top-0">
                  <tr className="text-left text-[11px] uppercase tracking-widest text-[#7A7068]">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Bookings</th>
                    <th className="px-3 py-2">Last booking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E7DB]">
                  {marketingContacts.map((c, i) => (
                    <tr key={(c.email || "") + i}>
                      <td className="px-3 py-2">{c.name || "—"}</td>
                      <td className="px-3 py-2 text-[#C4622D]">{c.email || "—"}</td>
                      <td className="px-3 py-2 text-[#7A7068]">{c.phone || "—"}</td>
                      <td className="px-3 py-2">{c.bookings ?? 0}</td>
                      <td className="px-3 py-2 text-[#7A7068]">{c.last_booking_at ? new Date(c.last_booking_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                  {marketingContacts.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[#7A7068]">Aún no hay clientes con opt-in.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Recomendaciones de estudios">
            <Stat label="Recomendaciones" value={suggestions.length} />
            <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-[#E5DDD3]">
              <table className="w-full text-sm">
                <thead className="bg-[#FBF8F4] sticky top-0">
                  <tr className="text-left text-[11px] uppercase tracking-widest text-[#7A7068]">
                    <th className="px-3 py-2">Studio</th>
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E7DB]">
                  {suggestions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-medium">{s.studio_name}</td>
                      <td className="px-3 py-2 text-[#7A7068]">{s.area || "—"}</td>
                      <td className="px-3 py-2 text-[#7A7068] max-w-xs truncate" title={s.reason || ""}>{s.reason || "—"}</td>
                      <td className="px-3 py-2 text-[#C4622D]">{s.client_email || "—"}</td>
                      <td className="px-3 py-2">{s.status}</td>
                      <td className="px-3 py-2 text-[#7A7068]">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {suggestions.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-[#7A7068]">Sin recomendaciones todavía.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>





          <Card title="Validation">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <Stat label="B2C responses" value={b2c.length} />
              <Stat label="B2B responses" value={b2b.length} />
            </div>

            <p className="text-[11px] tracking-[0.2em] uppercase text-[#7A7068] mb-2">Source</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {(["__all__", ...sourceOptions]).map((s) => {
                const selected = sourceFilter === s;
                const label = s === "__all__" ? "All" : s;
                const count = s === "__all__" ? validation.length : (sourceCounts[s] || 0);
                return (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    className="px-3 py-1.5 rounded-full text-xs border transition"
                    style={{
                      background: selected ? "#C4622D" : "#FFFFFF",
                      color: selected ? "#F7F4F0" : "#211C1A",
                      borderColor: selected ? "#C4622D" : "#E5DDD3",
                    }}
                  >
                    {label} · {count}
                  </button>
                );
              })}
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
                {collectKeys(b2b).map((k) => {
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
              {expanded ? "Hide" : "Show"} all responses ({filteredValidation.length})
            </button>

            {expanded && (
              <div className="mt-4 space-y-3">
                {filteredValidation.map((r) => (
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
                      <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest bg-[#F0E7DB] text-[#211C1A]">
                        {(r.source && r.source.trim()) || "direct"}
                      </span>
                      <span className="text-[#7A7068] text-xs">{new Date(r.created_at).toLocaleString()}</span>
                      {r.email && <span className="text-[#C4622D] text-xs ml-auto">{r.email}</span>}
                      {r.contact && <span className="text-[#C4622D] text-xs ml-auto">{r.contact}</span>}
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-[#211C1A] font-mono leading-relaxed">
{formatAnswers(r.answers || {})}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        </>
        )}


        {/* Agent Team Chat */}
        <div className="mt-6">
          <FounderAgentChat />
        </div>
      </div>
    </div>
  );
}
