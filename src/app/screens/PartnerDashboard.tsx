import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, DollarSign, Star, Users, Settings, ChevronRight, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  client_name: string;
  client_email: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
};

type Partner = {
  business_name: string;
  address: string;
};

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in"); navigate("/partner/login"); return; }

    const [{ data: partnerData }, { data: bookingsData }] = await Promise.all([
      supabase.from("partners").select("business_name, address").eq("id", user.id).single(),
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

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Edit Profile", sub: "Name, address, photos", path: "/partner/profile", icon: Settings },
              { label: "Add Services", sub: "Prices, durations", path: "/partner/services", icon: Star },
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
    </div>
  );
}
