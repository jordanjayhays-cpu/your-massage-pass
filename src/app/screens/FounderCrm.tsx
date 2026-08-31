// FounderCrm — Jordan's private CRM pipeline viewer at /founder/crm
// Founder-only: requires the ops key as a `key` query param. Not linked from
// any public navigation and marked noindex. English-only UI.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Mail,
  Contact,
  ChevronDown,
  MessageCircle,
  BadgeCheck,
} from "lucide-react";

const FN_URL =
  "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/crm-data";

type CrmRequest = {
  id: string | number;
  service: string | null;
  studio: string | null;
  day: string | null;
  time: string | null;
  raw_stage: string | null;
  confirmed_day: string | null;
  confirmed_time: string | null;
};

type Person = {
  phone: string;
  name: string | null;
  email: string | null;
  lang: string | null;
  source: string | null;
  chat_step: string | null;
  stage: string | null;
  request: CrmRequest | null;
  requests_total: number;
  confirmed_total: number;
  first_seen: string | null;
  last_inbound: string | null;
  messages_in: number;
};

type EmailLead = {
  email: string;
  answers: unknown;
  matches: unknown;
  marketing_opt_in: boolean | null;
  created_at: string;
};

type EmailContact = {
  email: string;
  name: string | null;
  bookings: number;
  whatsapp_requests: number;
  has_account: boolean;
  last_activity: string | null;
};

type CrmData = {
  people: Person[];
  email_leads: EmailLead[];
  email_contacts: EmailContact[];
  generated_at: string;
};

type StageKey =
  | "chatting"
  | "request_sent"
  | "studio_replied"
  | "confirmed"
  | "lost"
  | "blocked";

const STAGES: { key: StageKey; label: string; classes: string }[] = [
  {
    key: "chatting",
    label: "Chatting",
    classes: "border-stone-300 bg-stone-100 dark:bg-stone-900/40",
  },
  {
    key: "request_sent",
    label: "Request sent",
    classes: "border-amber-300 bg-amber-100/70 dark:bg-amber-900/30",
  },
  {
    key: "studio_replied",
    label: "Studio replied",
    classes: "border-blue-300 bg-blue-100/70 dark:bg-blue-900/30",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    classes: "border-green-300 bg-green-100/70 dark:bg-green-900/30",
  },
  {
    key: "lost",
    label: "Lost",
    classes: "border-gray-300 bg-gray-100 dark:bg-gray-800/40",
  },
  {
    key: "blocked",
    label: "Blocked",
    classes: "border-red-300 bg-red-100/70 dark:bg-red-900/30",
  },
];

function stageOf(p: Person): StageKey {
  const s = (p.stage ?? p.request?.raw_stage ?? "").toLowerCase();
  if (s.includes("block")) return "blocked";
  if (s.includes("lost") || s.includes("dead") || s.includes("cold"))
    return "lost";
  if (s.includes("confirm") || p.request?.confirmed_day) return "confirmed";
  if (s.includes("repl")) return "studio_replied";
  if (s.includes("request") || s.includes("sent") || p.request) {
    return "request_sent";
  }
  return "chatting";
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function timeHM(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function sourceChip(source: string | null): { label: string; classes: string } {
  const s = (source ?? "").toLowerCase();
  if (s.includes("fb") || s.includes("facebook") || s.includes("ad") || s.includes("meta")) {
    return {
      label: "FB ad",
      classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
    };
  }
  return {
    label: "Organic",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  };
}

function answersSummary(answers: unknown): string {
  if (!answers) return "";
  if (typeof answers === "string") return answers;
  if (Array.isArray(answers)) return answers.filter(Boolean).join(" · ");
  if (typeof answers === "object") {
    return Object.values(answers as Record<string, unknown>)
      .filter((v) => typeof v === "string" && v)
      .join(" · ");
  }
  return "";
}

export default function FounderCrm() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("key") ?? "";

  useEffect(() => {
    document.title = "Founder · CRM";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    const prev = meta.getAttribute("content");
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      if (prev) meta!.setAttribute("content", prev);
    };
  }, []);

  const url = useMemo(
    () => `${FN_URL}?key=${encodeURIComponent(key)}`,
    [key]
  );

  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CrmData | null>(null);
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setUnauthorized(false);
    setError(null);
    if (!key) return;
    let cancelled = false;
    const load = () =>
      fetch(url)
        .then(async (r) => {
          if (r.status === 401 || r.status === 403 || r.status === 404) {
            if (!cancelled) setUnauthorized(true);
            return;
          }
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = (await r.json()) as CrmData;
          if (!cancelled) setData(d);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e?.message ?? e));
        });
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [url, key]);

  const grouped = useMemo(() => {
    const map = new Map<StageKey, Person[]>();
    for (const s of STAGES) map.set(s.key, []);
    for (const p of data?.people ?? []) map.get(stageOf(p))!.push(p);
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.last_inbound ?? 0).getTime() -
          new Date(a.last_inbound ?? 0).getTime()
      );
    }
    return map;
  }, [data]);

  if (!key || unauthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Invalid key</p>
      </div>
    );
  }

  const personCard = (p: Person) => {
    const chip = sourceChip(p.source);
    const r = p.request;
    return (
      <button
        key={p.phone}
        type="button"
        onClick={() =>
          window.open(
            `/founder/chats?key=${encodeURIComponent(key)}&phone=${encodeURIComponent(p.phone)}`,
            "_blank",
            "noopener,noreferrer"
          )
        }
        className="block w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">
            {p.name?.trim() || "No name yet"}
          </span>
          <span
            className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 ${chip.classes}`}
          >
            {chip.label}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <a
            href={`tel:+${p.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline"
          >
            +{p.phone}
          </a>
          {p.lang && (
            <span className="text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 uppercase">
              {p.lang}
            </span>
          )}
        </div>
        {r && (
          <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
            <div className="truncate">
              {[r.service, r.studio].filter(Boolean).join(" · ")}
            </div>
            <div>
              {[r.day, r.time].filter(Boolean).join(" ")}
              {r.confirmed_day && (
                <span className="text-green-700 dark:text-green-300">
                  {" "}
                  · confirmed{" "}
                  {[r.confirmed_day, r.confirmed_time]
                    .filter(Boolean)
                    .join(" ")}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{relTime(p.last_inbound)}</span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {p.messages_in}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl">Massage Club CRM</h1>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {data
            ? `${data.people.length} people · updated ${timeHM(data.generated_at)}`
            : "Loading…"}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Pipeline: collapsible sections on mobile, kanban columns on desktop */}
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-3 md:items-start">
          {STAGES.map((s) => {
            const list = grouped.get(s.key) ?? [];
            const isOpen = openStages[s.key] ?? true;
            return (
              <section
                key={s.key}
                className={`rounded-2xl border ${s.classes} overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenStages((o) => ({ ...o, [s.key]: !isOpen }))
                  }
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium md:cursor-default"
                >
                  <span>
                    {s.label}{" "}
                    <span className="text-muted-foreground">({list.length})</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 md:hidden transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`${isOpen ? "block" : "hidden"} md:block px-2 pb-2 space-y-2`}
                >
                  {list.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground px-1 pb-1">
                      Nobody here yet.
                    </p>
                  ) : (
                    list.map(personCard)
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Email leads */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">
              Email leads{" "}
              <span className="text-muted-foreground">
                ({data?.email_leads.length ?? 0})
              </span>
            </h2>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
            {!data ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : data.email_leads.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No email leads yet.
              </p>
            ) : (
              data.email_leads.map((l) => (
                <div
                  key={`${l.email}-${l.created_at}`}
                  className="px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate flex items-center gap-2">
                      {l.email}
                      {l.marketing_opt_in && (
                        <span className="shrink-0 text-[10px] rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                          opted in
                        </span>
                      )}
                    </div>
                    {answersSummary(l.answers) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {answersSummary(l.answers)}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {relTime(l.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Email contacts */}
        <section className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Contact className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">
              Email contacts{" "}
              <span className="text-muted-foreground">
                ({data?.email_contacts.length ?? 0})
              </span>
            </h2>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
            {!data ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : data.email_contacts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No email contacts yet.
              </p>
            ) : (
              data.email_contacts.map((c) => (
                <div
                  key={c.email}
                  className="px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate flex items-center gap-2">
                      {c.name?.trim() || c.email}
                      {c.has_account && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                          <BadgeCheck className="h-3 w-3" />
                          account
                        </span>
                      )}
                    </div>
                    {c.name?.trim() && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.email}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      {c.bookings} bookings · {c.whatsapp_requests} WhatsApp
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {relTime(c.last_activity)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
