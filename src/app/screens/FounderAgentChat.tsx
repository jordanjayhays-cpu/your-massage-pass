// FounderAgentChat — Live agent collaboration embedded in the Massage Club FounderDashboard
// Reads/writes to hermes_entries on the Collab Supabase (dprdnrgjkzgfgtcsguuq)
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const COLLAB_URL = "https://dprdnrgjkzgfgtcsguuq.supabase.co";
const COLLAB_ANON_KEY = "sb_publishable_2nHGCg116tDqkVDqyWPhvg_2TG2ZtoA";
const collab = createClient(COLLAB_URL, COLLAB_ANON_KEY);

type HermesEntry = {
  id: string;
  agent: string;
  type: string;
  title?: string;
  body?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
};

const AGENTS: Record<string, { label: string; bg: string; color: string; letter: string }> = {
  hermes: { label: "Hermes", bg: "rgba(120,100,255,0.12)", color: "#7B68EE", letter: "H" },
  claude: { label: "Claude", bg: "rgba(200,120,60,0.12)", color: "#C8783C", letter: "C" },
  codex: { label: "Codex", bg: "rgba(80,180,140,0.12)", color: "#50B48C", letter: "X" },
  jordan: { label: "You", bg: "rgba(200,80,80,0.12)", color: "#C85050", letter: "J" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FounderAgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HermesEntry[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastCount, setLastCount] = useState(0);

  async function loadMessages() {
    const { data } = await collab
      .from("hermes_entries")
      .select("*")
      .eq("archived", false)
      .eq("type", "message")
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data as HermesEntry[]) ?? []);
  }

  useEffect(() => {
    if (!open) return;
    loadMessages();
    const channel = collab
      .channel("founder-agent-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hermes_entries" }, (payload: any) => {
        const row = payload.new as HermesEntry;
        if (row.type !== "message" || row.archived) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .subscribe();
    return () => { collab.removeChannel(channel); };
  }, [open]);

  useEffect(() => {
    if (!open || messages.length === lastCount) return;
    setLastCount(messages.length);
    const el = scrollRef.current;
    if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
  }, [messages.length, open, lastCount]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    await collab.from("hermes_entries").insert({
      agent: "jordan",
      type: "message",
      body,
      tags: ["founder-dashboard"],
      metadata: { to: "all" },
    });
    setText("");
    await loadMessages();
    setSending(false);
  }

  const recent = messages.slice(-30);

  return (
    <div className="rounded-2xl border border-[#E5DDD3] bg-[#FFFDF9] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F9F5F0] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #7B68EE, #50B48C)" }}
          >
            🤖
          </div>
          <div className="text-left">
            <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: 15 }} className="text-[#2C2420]">
              🤖 Agent Team
            </div>
            <div className="text-xs text-[#7A7068]">
              {messages.length === 0 ? "Chat with Hermes, Claude & Codex" : `${messages.length} messages · tap to open`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#7A7068]">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[#E5DDD3]">
          {/* Agent pills */}
          <div className="flex gap-2 px-5 pt-3 pb-2 overflow-x-auto">
            {Object.entries(AGENTS).map(([key, meta]) => (
              <div
                key={key}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                style={{ background: meta.bg, color: meta.color }}
              >
                <span className="font-bold">{meta.letter}</span>
                <span>{meta.label}</span>
              </div>
            ))}
          </div>

          {/* Message list */}
          <div
            ref={scrollRef}
            className="px-4 pb-3 space-y-2 overflow-y-auto"
            style={{ maxHeight: 320, minHeight: 160 }}
          >
            {recent.length === 0 && (
              <div className="text-center py-8 text-[#7A7068] text-sm">
                No messages yet. Say hi to your agent team.
              </div>
            )}
            {recent.map((m) => {
              const meta = AGENTS[m.agent] ?? { label: m.agent, bg: "rgba(100,100,100,0.1)", color: "#666", letter: m.agent[0]?.toUpperCase() };
              const isJordan = m.agent === "jordan";
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isJordan ? "flex-row-reverse" : ""}`}>
                  {!isJordan && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.letter}
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isJordan ? "items-end" : "items-start"} flex flex-col`}>
                    <div className="flex items-center gap-1.5 mb-0.5 px-1">
                      <span className="text-[10px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                      <span className="text-[10px] text-[#B0A898]">{relativeTime(m.created_at)}</span>
                    </div>
                    <div
                      className="px-3 py-2 text-sm rounded-2xl whitespace-pre-wrap break-words"
                      style={{
                        background: isJordan ? "rgba(200,80,80,0.1)" : meta.bg,
                        border: `1px solid ${meta.color}30`,
                        color: "#2C2420",
                        borderRadius: isJordan ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                      }}
                    >
                      {m.body ?? ""}
                    </div>
                  </div>
                  {isJordan && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.letter}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 p-3 border-t border-[#E5DDD3] bg-[#FBF8F4]"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: AGENTS.jordan.bg, color: AGENTS.jordan.color }}
            >
              J
            </div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message the agent team…"
              className="flex-1 bg-white border border-[#E5DDD3] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#C4622D]"
              autoFocus
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="px-4 py-2 bg-[#C4622D] text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-[#A8521F] transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
