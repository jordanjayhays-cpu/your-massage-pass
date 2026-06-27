import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, ChevronDown, MessageCircle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

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

export default function PartnerClients() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/partner/login"); return; }

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("partner_id", user.id)
      .order("booking_date", { ascending: false });

    // Group bookings into clients (by email, else phone, else name).
    const map: Record<string, Client> = {};
    for (const b of (data as Booking[]) || []) {
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
    // Most-recently-seen clients first.
    const list = Object.values(map).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
    setClients(list);
    setLoading(false);
  };

  const filtered = clients.filter(c => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [c.name, c.email, c.phone].filter(Boolean).some(v => v!.toLowerCase().includes(q));
  });

  const pretty = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/partner/dashboard")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">←</button>
          <div>
            <p className="text-xs text-muted-foreground">Studio</p>
            <h1 className="font-display text-lg font-bold">Clients</h1>
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
                          </p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border">
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
                          {/* History */}
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5">History</p>
                            <div className="space-y-1.5">
                              {c.bookings.map(b => (
                                <div key={b.id} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{pretty(b.booking_date)} · {b.booking_time}</span>
                                  <span className="font-medium">{b.massage_type}</span>
                                </div>
                              ))}
                            </div>
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
