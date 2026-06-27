import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, DollarSign, Star, Users, Settings, ChevronRight, ChevronLeft, CheckCircle, XCircle, Loader2, Link2, Unlink, Copy, Check, MessageCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  duration?: number;
  pressure?: string;
  focus_areas?: string[];
  add_ons?: string[];
  notes?: string;
  allergies?: string;
  health_notes?: string;
  price?: number;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
};

const todayISO = () => new Date().toISOString().split("T")[0];

type Partner = {
  business_name: string;
  address: string;
  google_calendar_connected?: boolean;
  google_calendar_id?: string;
  auto_confirm_bookings?: boolean;
};

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  // Month-calendar state
  const now0 = new Date();
  const [calYear, setCalYear] = useState(now0.getFullYear());
  const [calMonth, setCalMonth] = useState(now0.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [calView, setCalView] = useState<"month" | "week">("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [detail, setDetail] = useState<Booking | null>(null); // booking shown in the detail popup

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in"); navigate("/partner/login"); return; }
    setShareUrl(`https://book.massageclub.io/s/${user.id}`);

    const [{ data: partnerData }, { data: bookingsData }] = await Promise.all([
      supabase.from("partners").select("business_name, address, google_calendar_connected, google_calendar_id, auto_confirm_bookings").eq("id", user.id).single(),
      supabase.from("bookings").select("*").eq("partner_id", user.id).order("booking_date", { ascending: false }).limit(20),
    ]);

    setPartner(partnerData);
    setBookings(bookingsData ?? []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: "confirmed" | "cancelled") => {
    setActionLoading(id);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    setActionLoading(null);
    if (error) { toast.error("Error updating: " + error.message); return; }
    toast.success(`Booking ${status}!`);
    loadData();
  };

  const pendingCount = bookings.filter(b => b.status === "pending").length;
  const todayBookings = bookings.filter(b => b.booking_date === new Date().toISOString().split("T")[0]);

  const pad2 = (n: number) => String(n).padStart(2, "0");

  // Group bookings by date (skip cancelled) — powers the calendar dots + day view.
  const byDate: Record<string, Booking[]> = {};
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    (byDate[b.booking_date] ||= []).push(b);
  }

  // Build the month grid (Monday-first, like European calendars).
  const firstWeekday = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`);

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedBookings = (byDate[selectedDate] || []).sort((a, b) => a.booking_time.localeCompare(b.booking_time));
  const selectedPretty = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  // Week view: 7 days (Monday-first) for the current weekOffset.
  const wkBase = new Date();
  const wkMon = new Date(wkBase);
  wkMon.setDate(wkBase.getDate() - ((wkBase.getDay() + 6) % 7) + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(wkMon); d.setDate(wkMon.getDate() + i);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const weekLabel = `${new Date(weekDays[0] + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(weekDays[6] + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  // Time range for the grid — defaults to 8:00–21:00, widened if a booking falls outside.
  const HOUR_PX = 44;
  let startH = 8, endH = 21;
  for (const ds of weekDays) for (const b of byDate[ds] || []) {
    const [h, m] = b.booking_time.split(":").map(Number);
    startH = Math.min(startH, h);
    endH = Math.max(endH, Math.ceil((h * 60 + m + (b.duration || 60)) / 60));
  }
  startH = Math.max(0, startH); endH = Math.min(24, endH);
  const weekdayAbbr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const confirmedThisMonth = bookings.filter(b => {
    const d = new Date(b.booking_date);
    const now = new Date();
    return b.status === "confirmed" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <h1 className="font-display text-xl font-bold">{partner?.business_name ?? "Partner Dashboard"}</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate("/partner/profile")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-xl mx-auto px-6 py-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pending", value: pendingCount, icon: Clock, color: "text-orange-500" },
              { label: "Today", value: todayBookings.length, icon: Calendar, color: "text-primary" },
              { label: "This Month", value: confirmedThisMonth, icon: DollarSign, color: "text-green-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-4 text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-2 ${color}`} />
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Your booking link — the shareable page */}
          <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-bold">Your booking link</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Share this anywhere — your Google listing, Instagram bio, or a WhatsApp message. Customers book right from it.
              </p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-xs text-muted-foreground"
                />
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(shareUrl);
                    setCopied(true);
                    toast.success("Link copied!");
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="h-10 px-3 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 text-xs font-semibold"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Book your massage here: ${shareUrl}`)}`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 h-9 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
                </a>
                <a
                  href={shareUrl} target="_blank" rel="noreferrer"
                  className="flex-1 h-9 rounded-xl bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  Preview
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Edit Profile", sub: "Name, address", path: "/partner/profile", icon: Settings },
              { label: "Add Services", sub: "Prices, durations", path: "/partner/services", icon: Star },
              { label: "Photos", sub: "Cover, logo, gallery", path: "/partner/photos", icon: ImageIcon },
              { label: "Availability", sub: "Opening hours", path: "/partner/calendar", icon: Clock },
              { label: "Clients", sub: "History & contacts", path: "/partner/clients", icon: Users },
            ].map(({ label, sub, path, icon: Icon }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card text-left hover:border-primary/50 transition"
              >
                <Icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </button>
            ))}

            {/* Calendar connect — spans full width */}
            <button
              onClick={() => navigate("/partner/connect-calendar")}
              className="flex items-center gap-3 p-4 rounded-2xl border bg-card text-left hover:border-primary/50 transition col-span-2"
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                partner?.google_calendar_connected ? "bg-green-100" : "bg-secondary"
              }`}>
                {partner?.google_calendar_connected
                  ? <Link2 className="h-5 w-5 text-green-600" />
                  : <Calendar className="h-5 w-5 text-foreground" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Calendar</p>
                  {partner?.google_calendar_connected ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-600">Connected</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Set up</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {partner?.google_calendar_connected
                    ? `${partner.google_calendar_id || "Google Calendar"} · Tap to manage`
                    : "Connect Google Calendar for real-time availability"
                  }
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Pending actions */}
          {pendingCount > 0 && (
            <div>
              <h2 className="font-display text-base font-bold mb-3">Needs your attention</h2>
              <div className="space-y-3">
                {bookings.filter(b => b.status === "pending").map(b => (
                  <Card key={b.id} className="bg-card border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{b.client_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.massage_type}</p>
                          <p className="text-xs text-primary font-semibold mt-1">
                            📅 {b.booking_date} at {b.booking_time}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(b.id, "confirmed")}
                            disabled={actionLoading === b.id}
                            className="h-8 w-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-50"
                          >
                            {actionLoading === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => updateStatus(b.id, "cancelled")}
                            disabled={actionLoading === b.id}
                            className="h-8 w-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Month calendar — days with bookings are dotted; tap a day to see them */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold">Calendar</h2>
                <div className="flex rounded-lg bg-secondary p-0.5 text-xs font-semibold">
                  <button onClick={() => setCalView("month")} className={`px-2.5 py-1 rounded-md ${calView === "month" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Month</button>
                  <button onClick={() => setCalView("week")} className={`px-2.5 py-1 rounded-md ${calView === "week" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Week</button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => calView === "month" ? shiftMonth(-1) : setWeekOffset(weekOffset - 1)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold w-24 text-center">{calView === "month" ? monthLabel : weekLabel}</span>
                <button onClick={() => calView === "month" ? shiftMonth(1) : setWeekOffset(weekOffset + 1)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {calView === "month" && (
              <Card className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {weekdayAbbr.map(d => (
                      <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((dateStr, i) => {
                      if (!dateStr) return <div key={`e${i}`} />;
                      const count = byDate[dateStr]?.length || 0;
                      const isToday = dateStr === todayISO();
                      const isSelected = dateStr === selectedDate;
                      const dayNum = Number(dateStr.split("-")[2]);
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`relative aspect-square rounded-lg flex items-center justify-center text-sm transition ${
                            isSelected ? "bg-primary text-primary-foreground font-bold"
                              : isToday ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-secondary text-foreground"
                          }`}
                        >
                          {dayNum}
                          {count > 0 && (
                            <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {calView === "week" && (
              <Card className="bg-card border-border">
                <CardContent className="p-2">
                  <div className="overflow-x-auto">
                    <div className="min-w-[560px]">
                      {/* Day headers */}
                      <div className="grid mb-1" style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}>
                        <div />
                        {weekDays.map(ds => {
                          const d = new Date(ds + "T00:00:00");
                          const isToday = ds === todayISO();
                          const isSel = ds === selectedDate;
                          return (
                            <button key={ds} onClick={() => setSelectedDate(ds)}
                              className={`text-center py-1 rounded-md ${isSel ? "bg-primary text-primary-foreground" : isToday ? "text-primary" : "text-muted-foreground"}`}>
                              <div className="text-[9px] uppercase">{weekdayAbbr[(d.getDay() + 6) % 7]}</div>
                              <div className="text-xs font-bold">{d.getDate()}</div>
                            </button>
                          );
                        })}
                      </div>
                      {/* Time grid */}
                      <div className="relative" style={{ height: (endH - startH) * HOUR_PX }}>
                        {Array.from({ length: endH - startH + 1 }, (_, i) => startH + i).map(hr => (
                          <div key={hr} className="absolute left-0 right-0 border-t border-border/50" style={{ top: (hr - startH) * HOUR_PX }}>
                            <span className="absolute -top-2 left-0 w-8 text-right pr-1 text-[9px] text-muted-foreground">{hr}:00</span>
                          </div>
                        ))}
                        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}>
                          <div />
                          {weekDays.map(ds => (
                            <div key={ds} className="relative border-l border-border/40">
                              {(byDate[ds] || []).map(b => {
                                const [h, m] = b.booking_time.split(":").map(Number);
                                const top = ((h * 60 + m) - startH * 60) / 60 * HOUR_PX;
                                const height = Math.max(20, ((b.duration || 60) / 60) * HOUR_PX);
                                return (
                                  <button key={b.id} onClick={() => setDetail(b)}
                                    className={`absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 text-left overflow-hidden ${
                                      b.status === "confirmed" ? "bg-green-500/85 text-white" : "bg-primary/85 text-white"
                                    }`}
                                    style={{ top, height }}>
                                    <div className="text-[9px] font-semibold leading-tight truncate">{b.booking_time} {b.client_name}</div>
                                    <div className="text-[8px] leading-tight truncate opacity-90">{b.massage_type}</div>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected day's appointments */}
            <div className="mt-3">
              <p className="text-sm font-semibold mb-2">{selectedPretty}</p>
              {selectedBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">No appointments this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedBookings.map(b => {
                    const waDigits = (b.client_phone || "").replace(/\D/g, "");
                    return (
                      <Card key={b.id} className="bg-card border-border">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <button onClick={() => setDetail(b)} className="flex-1 min-w-0 text-left">
                              <p className="font-semibold text-sm">{b.booking_time} · {b.client_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{b.massage_type} <span className="text-primary">· details</span></p>
                            </button>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                              b.status === "confirmed" ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-500"
                            }`}>{b.status}</span>
                          </div>
                          {(waDigits || b.client_email) && (
                            <div className="flex gap-2 mt-3">
                              {waDigits && (
                                <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer"
                                  className="flex-1 h-9 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                                </a>
                              )}
                              {b.client_email && (
                                <a href={`mailto:${b.client_email}?subject=${encodeURIComponent(`Your booking at ${partner?.business_name ?? "our studio"}`)}`}
                                  className="flex-1 h-9 rounded-xl bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                                  ✉️ Email
                                </a>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent bookings */}
          <div>
            <h2 className="font-display text-base font-bold mb-3">Recent bookings</h2>
            {bookings.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No bookings yet. They'll appear here when customers book.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 10).map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                    <div>
                      <p className="text-sm font-semibold">{b.client_name}</p>
                      <p className="text-xs text-muted-foreground">{b.booking_date} · {b.booking_time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        b.status === "confirmed" ? "bg-green-500/10 text-green-600" :
                        b.status === "cancelled" ? "bg-red-500/10 text-red-500" :
                        "bg-orange-500/10 text-orange-500"
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => { supabase.auth.signOut(); navigate("/partner/login"); }}
            variant="outline"
            className="w-full h-11 text-muted-foreground"
          >
            Sign Out
          </Button>
        </div>
      )}

      {/* Booking detail popup */}
      {detail && (() => {
        const d = detail;
        const waDigits = (d.client_phone || "").replace(/\D/g, "");
        const prettyDate = new Date(d.booking_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const hasExtras = d.pressure || (d.focus_areas || []).length || (d.add_ons || []).length || d.notes || d.allergies || d.health_notes;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDetail(null)}>
            <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl border border-border max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">{d.client_name}</h3>
                    <p className="text-sm text-muted-foreground">{d.massage_type}</p>
                  </div>
                  <button onClick={() => setDetail(null)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">✕</button>
                </div>

                <div className="space-y-1 text-sm">
                  <p>📅 {prettyDate}</p>
                  <p>🕐 {d.booking_time}{d.duration ? ` · ${d.duration} min` : ""}</p>
                  {d.price ? <p>💶 €{d.price}</p> : null}
                  <p>Status: <span className={`font-semibold ${d.status === "confirmed" ? "text-green-600" : d.status === "cancelled" ? "text-red-500" : "text-orange-500"}`}>{d.status}</span></p>
                </div>

                {hasExtras ? (
                  <div className="space-y-1 text-sm border-t border-border pt-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">What the client asked for</p>
                    {d.pressure && <p><span className="text-muted-foreground">Pressure:</span> {d.pressure}</p>}
                    {(d.focus_areas || []).length > 0 && <p><span className="text-muted-foreground">Focus areas:</span> {d.focus_areas!.join(", ")}</p>}
                    {(d.add_ons || []).length > 0 && <p><span className="text-muted-foreground">Add-ons:</span> {d.add_ons!.join(", ")}</p>}
                    {d.notes && <p><span className="text-muted-foreground">Notes:</span> {d.notes}</p>}
                  </div>
                ) : null}

                {(d.client_phone || d.client_email) && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Contact</p>
                    {d.client_phone && <p className="text-sm">📞 {d.client_phone}</p>}
                    {d.client_email && <p className="text-sm break-all">✉️ {d.client_email}</p>}
                    <div className="flex gap-2 pt-1">
                      {waDigits && (
                        <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer"
                          className="flex-1 h-10 rounded-xl bg-[#25D366] text-white text-sm font-semibold flex items-center justify-center gap-1.5">
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                      )}
                      {d.client_email && (
                        <a href={`mailto:${d.client_email}?subject=${encodeURIComponent(`Your booking at ${partner?.business_name ?? "our studio"}`)}`}
                          className="flex-1 h-10 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-1.5">
                          ✉️ Email
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {d.status === "pending" && (
                  <div className="flex gap-2 border-t border-border pt-3">
                    <button onClick={() => { updateStatus(d.id, "confirmed"); setDetail(null); }}
                      className="flex-1 h-10 rounded-xl bg-green-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> Confirm
                    </button>
                    <button onClick={() => { updateStatus(d.id, "cancelled"); setDetail(null); }}
                      className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5">
                      <XCircle className="h-4 w-4" /> Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
