// FounderChats — Jordan's private WhatsApp bot conversation viewer at /founder/chats
// Founder-only: requires the ops key as a `key` query param. Not linked from any
// public navigation and marked noindex.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";

const FN_URL =
  "https://jglftdstrowwckwqmpue.supabase.co/functions/v1/wa-chat";

type Conversation = {
  phone: string;
  last_body: string;
  last_direction: string;
  last_at: string;
};

type ChatMessage = {
  direction: "in" | "out";
  type?: string;
  text: string;
  buttons?: string[];
  at: string;
  madrid_day: string;
  madrid_time: string;
};

function snippet(s: string, n = 70): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function madridShort(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function FounderChats() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("key") ?? "";
  const phone = searchParams.get("phone") ?? "";

  useEffect(() => {
    document.title = "Founder · Chats";
    // Founder-only viewer: keep search engines out.
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

  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conversation list state
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  // Open conversation state
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const listUrl = useMemo(
    () => `${FN_URL}?key=${encodeURIComponent(key)}&format=json`,
    [key]
  );
  const threadUrl = useMemo(
    () =>
      `${FN_URL}?key=${encodeURIComponent(key)}&format=json&phone=${encodeURIComponent(phone)}`,
    [key, phone]
  );

  useEffect(() => {
    setUnauthorized(false);
    setError(null);
    if (phone) {
      setMessages(null);
      let cancelled = false;
      const load = () =>
        fetch(threadUrl)
          .then(async (r) => {
            if (r.status === 404 || r.status === 401 || r.status === 403) {
              if (!cancelled) setUnauthorized(true);
              return;
            }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            if (!cancelled) setMessages(data.messages ?? []);
          })
          .catch((e) => {
            if (!cancelled) setError(String(e?.message ?? e));
          });
      load();
      const t = setInterval(load, 30000); // auto-refresh open thread
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
    setConversations(null);
    fetch(listUrl)
      .then(async (r) => {
        if (r.status === 404 || r.status === 401 || r.status === 403) {
          setUnauthorized(true);
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const list: Conversation[] = (data.conversations ?? [])
          .slice()
          .sort(
            (a, b) =>
              new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
          );
        setConversations(list);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [listUrl, threadUrl, phone]);

  // Scroll to bottom when messages load / refresh
  useEffect(() => {
    const el = scrollRef.current;
    if (el && messages) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!key || unauthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Not authorized</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {!phone ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h1 className="font-display text-xl">WhatsApp conversations</h1>
            </div>
            {!conversations ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                {conversations.map((c) => (
                  <Link
                    key={c.phone}
                    to={`/founder/chats?key=${encodeURIComponent(key)}&phone=${encodeURIComponent(c.phone)}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">+{c.phone}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.last_direction === "out" ? "Bot: " : ""}
                        {snippet(c.last_body)}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {madridShort(c.last_at)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <Link
                to={`/founder/chats?key=${encodeURIComponent(key)}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
              <div className="text-sm font-medium">+{phone}</div>
              <a
                href={`https://wa.me/${phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <RefreshCw className="hidden" />
                Reply on WhatsApp
              </a>
            </div>

            {!messages ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div
                ref={scrollRef}
                className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1 max-h-[75vh] overflow-y-auto"
              >
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const showDay = !prev || prev.madrid_day !== m.madrid_day;
                  const isOut = m.direction === "out";
                  return (
                    <div key={`${m.at}-${i}`}>
                      {showDay && (
                        <div className="flex justify-center my-3">
                          <span className="text-[11px] text-muted-foreground bg-background border border-border rounded-full px-3 py-1">
                            {m.madrid_day}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                            isOut
                              ? "bg-emerald-100 dark:bg-emerald-900/40 rounded-br-md"
                              : "bg-background border border-border rounded-bl-md"
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.text}
                          </div>
                          {m.buttons && m.buttons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {m.buttons.map((b) => (
                                <span
                                  key={b}
                                  className="text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                          <div
                            className={`text-[10px] text-muted-foreground mt-1 ${
                              isOut ? "text-right" : "text-left"
                            }`}
                          >
                            {m.madrid_time}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No messages yet.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
