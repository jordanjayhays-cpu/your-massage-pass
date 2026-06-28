import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, ChevronDown, MessageCircle, Users, FileText, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Booking = {
  id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  price?: number;
  status: "pending" | "confirmed" | "cancelled";
};

type SoapNote = {
  id: string;
  client_email: string | null;
  client_name: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  created_at: string;
};

type Client = {
  key: string;
  name: string;
  email?: string;
  phone?: string;
  visits: number;
  lastVisit: string;
  totalSpent: number;
  bookings: Booking[];
};

const SOAP_FIELDS: { key: "subjective" | "objective" | "assessment" | "plan"; letter: string; label: string; hint: string }[] = [
  { key: "subjective", letter: "S", label: "Subjective", hint: "What the client reports — pain, stress, goals" },
  { key: "objective", letter: "O", label: "Objective", hint: "What you observe — tension, posture, range of motion" },
  { key: "assessment", letter: "A", label: "Assessment", hint: "Your interpretation" },
  { key: "plan", letter: "P", label: "Plan", hint: "What you did + next session" },
];

export default function PartnerClients() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [notes, setNotes] = useState<SoapNote[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Add-note editor state (per expanded client)
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [draft, setDraft] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/partner/login"); return; }
    setPartnerId(user.id);

    const [{ data: bookingsData }, { data: notesData }] = await Promise.all([
      supabase.from("bookings").select("*").eq("partner_id", user.id).order("booking_date", { ascending: false }),
      supabase.from("soap_notes").select("*").eq("partner_id", user.id).order("created_at", { ascending: false }),
    ]);

    // Group bookings into clients (by email, else phone, else name).
    const map: Record<string, Client> = {};
    for (const b of (bookingsData as Booking[]) || []) {
      if (b.status === "cancelled") continue;
      const key = (b.client_email || b.client_phone || b.client_name || "unknown").toLowerCase().trim();
      if (!map[key]) {
        map[key] = { key, name: b.client_name, email: b.client_email, phone: b.client_phone, visits: 0, lastVisit: b.booking_date, totalSpent: 0, bookings: [] };
      }
      const c = map[key];
      c.visits += 1;
      c.totalSpent += Number(b.price || 0);
      if (b.booking_date > c.lastVisit) c.lastVisit = b.booking_date;
      if (!c.email && b.client_email) c.email = b.client_email;
      if (!c.phone && b.client_phone) c.phone = b.client_phone;
      c.bookings.push(b);
    }
    const list = Object.values(map).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
    setClients(list);
    setNotes((notesData as SoapNote[]) || []);
    setLoading(false);
  };

  // Notes belonging to a client (match on email, else name).
  const notesFor = (c: Client) =>
    notes.filter((n) =>
      c.email && n.client_email
        ? n.client_email.toLowerCase().trim() === c.email.toLowerCase().trim()
        : (n.client_name || "").toLowerCase().trim() === (c.name || "").toLowerCase().trim()
    );

  const startAdd = (c: Client) => {
    setAddingFor(c.key);
    setDraft({ subjective: "", objective: "", assessment: "", plan: "" });
  };

  const saveNote = async (c: Client) => {
    if (!partnerId) { toast.error("Please sign in again."); return; }
    if (!draft.subjective && !draft.objective && !draft.assessment && !draft.plan) {
      toast.error("Write something in at least one field.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("soap_notes")
      .insert({
        partner_id: partnerId,
        booking_id: null,
        client_email: c.email ?? null,
        client_name: c.name ?? null,
        subjective: draft.subjective.trim() || null,
        objective: draft.objective.trim() || null,
        assessment: draft.assessment.trim() || null,
        plan: draft.plan.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      console.error("SOAP save error:", error);
      toast.error("Couldn't save the note.");
      return;
    }
    setNotes((prev) => [data as SoapNote, ...prev]);
    setAddingFor(null);
    toast.success("Treatment note saved");
  };

  const filtered = clients.filter(c => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [c.name, c.email, c.phone].filter(Boolean).some(v => v!.toLowerCase().includes(q));
  });

  const pretty = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const prettyTs = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/partner/dashboard")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
          <div>
            <p className="text-xs text-muted-foreground">Studio</p>
            <h1 className="font-display text-lg font-bold">Clients &amp; Treatment Notes</h1>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="max-w-xl mx-auto px-6 py-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, email or phone"
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <p className="text-xs text-muted-foreground">{clients.length} client{clients.length === 1 ? "" : "s"} total</p>

          {filtered.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {clients.length === 0 ? "No clients yet. They'll appear here after their first booking." : "No clients match that search."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const isOpen = open === c.key;
                const waDigits = (c.phone || "").replace(/\D/g, "");
                const clientNotes = notesFor(c);
                return (
                  <Card key={c.key} className="bg-card border-border">
                    <CardContent className="p-0">
                      <button onClick={() => setOpen(isOpen ? null : c.key)} className="w-full p-4 text-left flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                          {c.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.visits} visit{c.visits === 1 ? "" : "s"} · last {pretty(c.lastVisit)}
                            {c.totalSpent > 0 ? ` · €${c.totalSpent}` : ""}
                            {clientNotes.length > 0 ? ` · ${clientNotes.length} note${clientNotes.length === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-4 border-t border-border">
                          {/* Contact */}
                          <div className="pt-3 space-y-1 text-sm">
                            {c.phone && <p>📞 {c.phone}</p>}
                            {c.email && <p className="break-all">✉️ {c.email}</p>}
                          </div>
                          {(waDigits || c.email) && (
                            <div className="flex gap-2">
                              {waDigits && (
                                <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer"
                                  className="flex-1 h-9 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                                </a>
                              )}
                              {c.email && (
                                <a href={`mailto:${c.email}`} className="flex-1 h-9 rounded-xl bg-secondary text-foreground text-xs font-semibold flex items-center justify-center">
                                  ✉️ Email
                                </a>
                              )}
                            </div>
                          )}

                          {/* Visit history */}
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5">Visit history</p>
                            <div className="space-y-1.5">
                              {c.bookings.map(b => (
                                <div key={b.id} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{pretty(b.booking_date)} · {b.booking_time}</span>
                                  <span className="font-medium">{b.massage_type}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Treatment notes (SOAP) */}
                          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <FileText className="h-4 w-4 text-primary" /> Treatment notes
                              </p>
                              {addingFor !== c.key && (
                                <button
                                  onClick={() => startAdd(c)}
                                  className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1"
                                >
                                  <Plus className="h-3.5 w-3.5" /> New note
                                </button>
                              )}
                            </div>

                            {/* Add-note editor */}
                            {addingFor === c.key && (
                              <div className="space-y-3 mb-4 bg-card rounded-xl border border-border p-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold text-muted-foreground uppercase">New SOAP note</p>
                                  <button onClick={() => setAddingFor(null)} className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {SOAP_FIELDS.map((f) => (
                                  <div key={f.key}>
                                    <label className="flex items-center gap-2 mb-1">
                                      <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">{f.letter}</span>
                                      <span className="text-sm font-semibold text-foreground">{f.label}</span>
                                    </label>
                                    <textarea
                                      value={draft[f.key]}
                                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                      rows={2}
                                      placeholder={f.hint}
                                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                                    />
                                  </div>
                                ))}
                                <button
                                  onClick={() => saveNote(c)}
                                  disabled={saving}
                                  className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                                >
                                  {saving ? "Saving…" : "Save note"}
                                </button>
                              </div>
                            )}

                            {/* Past notes */}
                            {clientNotes.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No treatment notes yet. Add one after a session to build this client's history.</p>
                            ) : (
                              <div className="space-y-2">
                                {clientNotes.map((n) => (
                                  <div key={n.id} className="rounded-xl bg-card border border-border p-3">
                                    <p className="text-[11px] text-muted-foreground mb-1.5">{prettyTs(n.created_at)}</p>
                                    <div className="space-y-1 text-xs text-foreground/85">
                                      {n.subjective && <p><span className="font-bold text-primary">S</span> {n.subjective}</p>}
                                      {n.objective && <p><span className="font-bold text-primary">O</span> {n.objective}</p>}
                                      {n.assessment && <p><span className="font-bold text-primary">A</span> {n.assessment}</p>}
                                      {n.plan && <p><span className="font-bold text-primary">P</span> {n.plan}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
