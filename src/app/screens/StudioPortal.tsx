import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, DollarSign, Star, Settings, ChevronRight,
  CheckCircle, XCircle, Loader2, Link2, Unlink, Users, LogOut,
  MapPin, Phone, Globe, ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const DAYS = [
  { num: 1, label: "Mon" }, { num: 2, label: "Tue" }, { num: 3, label: "Wed" },
  { num: 4, label: "Thu" }, { num: 5, label: "Fri" }, { num: 6, label: "Sat" }, { num: 0, label: "Sun" },
];
const DEFAULT_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

type Booking = {
  id: string; client_name: string; client_email: string; client_phone: string;
  massage_type: string; booking_date: string; booking_time: string;
  duration: number; status: "pending" | "confirmed" | "cancelled"; notes?: string;
};
type Partner = {
  id: string; business_name: string; address: string; phone: string; website: string;
  description: string; email: string;
  google_calendar_connected?: boolean;
};

export default function StudioPortal() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [section, setSection] = useState<"bookings" | "availability" | "settings">("bookings");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ business_name: "", address: "", phone: "", website: "", description: "" });
  const [availability, setAvailability] = useState<Record<number, string[]>>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [],
  });
  const [savingAvail, setSavingAvail] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/partner"); return; }

    const [{ data: partnerData }, { data: bookingsData }, { data: availData }] = await Promise.all([
      supabase.from("partners").select("*").eq("id", user.id).single(),
      supabase.from("bookings").select("*").eq("partner_id", user.id).order("booking_date", { ascending: false }),
      supabase.from("partner_availability").select("*").eq("partner_id", user.id),
    ]);

    if (!partnerData) { toast.error("Please complete onboarding"); navigate("/studio-setup"); return; }

    setPartner(partnerData as Partner);
    setProfileForm({
      business_name: partnerData.business_name || "",
      address: partnerData.address || "",
      phone: partnerData.phone || "",
      website: partnerData.website || "",
      description: partnerData.description || "",
    });

    const av: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] };
    for (const a of availData ?? []) {
      if (!av[a.day_of_week]) av[a.day_of_week] = [];
      av[a.day_of_week].push(a.time_slot);
    }
    setAvailability(av);

    setBookings((bookingsData ?? []) as Booking[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: "confirmed" | "cancelled") => {
    setActionLoading(id);
    await supabase.from("bookings").update({ status }).eq("id", id);
    setActionLoading(null);
    toast.success(`Booking ${status}`);
    loadData();
  };

  const saveProfile = async () => {
    if (!partner) return;
    setEditingProfile(false);
    const { error } = await supabase.from("partners").update(profileForm).eq("id", partner.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); setPartner(p => p ? { ...p, ...profileForm } : p); }
  };

  const saveAvailability = async () => {
    if (!partner) return;
    setSavingAvail(true);
    await supabase.from("partner_availability").delete().eq("partner_id", partner.id);
    const rows = DAYS.flatMap(day => (availability[day.num] || []).map(slot => ({ partner_id: partner!.id, day_of_week: day.num, time_slot: slot })));
    if (rows.length > 0) await supabase.from("partner_availability").insert(rows);
    setSavingAvail(false);
    toast.success("Availability updated");
  };

  const toggleDay = (day: number) => {
    setAvailability(prev => ({ ...prev, [day]: prev[day].length > 0 ? [] : [...DEFAULT_SLOTS] }));
  };
  const toggleSlot = (day: number, slot: string) => {
    setAvailability(prev => ({
      ...prev, [day]: prev[day].includes(slot) ? prev[day].filter(s => s !== slot) : [...prev[day], slot].sort(),
    }));
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const newPw = (form.elements.namedItem("newPw") as HTMLInputElement).value;
    if (newPw.length < 8) { toast.error("Min 8 characters"); return; }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPasswordLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); (form as any).reset(); }
  };

  const today = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter(b => b.booking_date === today);
  const upcomingBookings = bookings.filter(b => b.booking_date > today && b.booking_date <= new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
  const pendingCount = bookings.filter(b => b.status === "pending").length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Studio Portal</p>
              <h1 className="font-display text-xl font-bold">{partner?.business_name}</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => supabase.auth.signOut().then(() => navigate("/partner"))} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Section nav */}
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {[
              { key: "bookings", label: "Bookings", icon: Calendar, badge: pendingCount || undefined },
              { key: "availability", label: "Hours", icon: Clock },
              { key: "settings", label: "Settings", icon: Settings },
            ].map(({ key, label, icon: Icon, badge }) => (
              <button key={key} onClick={() => setSection(key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition flex-shrink-0 ${section === key ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
                {badge ? <span className="bg-primary text-white text-[10px] rounded-full px-1.5 py-0.5">{badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-6">

        {/* BOOKINGS */}
        {section === "bookings" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Pending", value: pendingCount, color: "text-orange-500" },
                { label: "Today", value: todayBookings.length, color: "text-primary" },
                { label: "This Week", value: upcomingBookings.length, color: "text-blue-500" },
              ].map(({ label, value, color }) => (
                <Card key={label} className="bg-card border-border">
                  <CardContent className="p-4 text-center">
                    <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Today's bookings */}
            <div>
              <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Today
              </h2>
              {todayBookings.length === 0 ? (
                <Card className="bg-card border-border"><CardContent className="p-6 text-center text-sm text-muted-foreground">No bookings today</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {todayBookings.map(b => <BookingCard key={b.id} booking={b} actionLoading={actionLoading} onAction={updateStatus} />)}
                </div>
              )}
            </div>

            {/* Upcoming */}
            <div>
              <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Next 7 days
              </h2>
              {upcomingBookings.length === 0 ? (
                <Card className="bg-card border-border"><CardContent className="p-6 text-center text-sm text-muted-foreground">No upcoming bookings</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {Object.entries(
                    upcomingBookings.reduce<Record<string, Booking[]>>((acc, b) => {
                      const d = new Date(b.booking_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                      if (!acc[d]) acc[d] = []; acc[d].push(b); return acc;
                    }, {})
                  ).map(([date, dayBookings]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{date}</p>
                      <div className="space-y-2">
                        {dayBookings.map(b => <BookingCard key={b.id} booking={b} actionLoading={actionLoading} onAction={updateStatus} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AVAILABILITY */}
        {section === "availability" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-base font-bold">Availability</h2>
              <Button size="sm" onClick={saveAvailability} disabled={savingAvail} className="bg-primary hover:bg-blue-700">
                {savingAvail ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…</> : "Save Changes"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Tap a day to toggle it on/off. Tap times to adjust your available slots.</p>
            <div className="space-y-3">
              {DAYS.map(day => (
                <div key={day.num}>
                  <div className="flex items-center justify-between mb-1.5">
                    <button onClick={() => toggleDay(day.num)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${availability[day.num].length > 0 ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                      {day.label}
                    </button>
                    <span className="text-xs text-muted-foreground">{availability[day.num].length > 0 ? `${availability[day.num].length} slots` : "Closed"}</span>
                  </div>
                  {availability[day.num].length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {DEFAULT_SLOTS.map(slot => (
                        <button key={slot} onClick={() => toggleSlot(day.num, slot)}
                          className={`px-2 py-1 rounded-md text-xs font-medium transition ${availability[day.num].includes(slot) ? "bg-blue-100 text-primary border border-blue-300" : "bg-secondary/60 text-muted-foreground border border-border"}`}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {section === "settings" && (
          <div className="space-y-6">
            {/* Profile edit */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-base font-bold">Studio Profile</h2>
                  {!editingProfile ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)}>Edit</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingProfile(false); setProfileForm({ business_name: partner?.business_name || "", address: partner?.address || "", phone: partner?.phone || "", website: partner?.website || "", description: partner?.description || "" }); }}><ChevronLeft className="h-3 w-3" /> Cancel</Button>
                      <Button size="sm" onClick={saveProfile} className="bg-primary hover:bg-blue-700">Save</Button>
                    </div>
                  )}
                </div>
                {editingProfile ? (
                  <div className="space-y-3">
                    {[
                      { key: "business_name", label: "Studio Name", icon: MapPin },
                      { key: "address", label: "Address", icon: MapPin },
                      { key: "phone", label: "Phone", icon: Phone },
                      { key: "website", label: "Website", icon: Globe },
                    ].map(({ key, label, icon: Icon }) => (
                      <div key={key} className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={profileForm[key as keyof typeof profileForm]} onChange={e => setProfileForm(p => ({ ...p, [key]: e.target.value }))} className="pl-9 h-11" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                      <textarea value={profileForm.description} onChange={e => setProfileForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{partner?.business_name}</span></div>
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{partner?.address}</span></div>
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{partner?.phone}</span></div>
                    <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{partner?.website || "—"}</span></div>
                    <p className="text-muted-foreground mt-2">{partner?.description || "No description"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Google Calendar */}
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${partner?.google_calendar_connected ? "bg-green-100" : "bg-secondary"}`}>
                      {partner?.google_calendar_connected ? <Link2 className="h-5 w-5 text-green-600" /> : <Calendar className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Google Calendar</p>
                      <p className="text-xs text-muted-foreground">{partner?.google_calendar_connected ? "Connected" : "Not connected"}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate("/partner/connect-calendar")}>
                    {partner?.google_calendar_connected ? "Manage" : "Connect"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Change password */}
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-display text-base font-bold">Change Password</h2>
                <form onSubmit={changePassword} className="space-y-3">
                  <Input name="newPw" type="password" placeholder="New password (min 8 chars)" className="h-11" />
                  <Button type="submit" size="sm" disabled={passwordLoading} className="bg-primary hover:bg-blue-700">
                    {passwordLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Updating…</> : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, actionLoading, onAction }: { booking: Booking; actionLoading: string | null; onAction: (id: string, status: "confirmed" | "cancelled") => void }) {
  return (
    <Card className={`bg-card ${booking.status === "pending" ? "border-orange-200" : "border-border"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm">{booking.client_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{booking.massage_type}</p>
            <p className="text-xs text-primary font-semibold mt-1">📅 {booking.booking_date} at {booking.booking_time} · {booking.duration}min</p>
            {booking.client_phone && <p className="text-xs text-muted-foreground mt-1">📞 {booking.client_phone}</p>}
            {booking.notes && <p className="text-xs text-muted-foreground mt-1 italic">📝 {booking.notes}</p>}
          </div>
          <div className="flex flex-col gap-2">
            {booking.status === "pending" ? (
              <>
                <button onClick={() => onAction(booking.id, "confirmed")} disabled={actionLoading === booking.id}
                  className="h-8 w-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-50">
                  {actionLoading === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                </button>
                <button onClick={() => onAction(booking.id, "cancelled")} disabled={actionLoading === booking.id}
                  className="h-8 w-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-50">
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                booking.status === "confirmed" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
              }`}>{booking.status}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}