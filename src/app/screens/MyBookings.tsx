import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, LogOut, CalendarDays, ArrowLeft } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Booking = {
  id: string | number;
  spa_name: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  status: string;
  partner_id: string;
  price: number | null;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
};

const statusStyle = (s: string) => {
  if (s === "confirmed") return "bg-emerald-100 text-emerald-700";
  if (s === "cancelled") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user?.email) {
        const { data } = await supabase
          .from("bookings")
          .select("id, spa_name, massage_type, booking_date, booking_time, status, partner_id, price")
          .eq("client_email", user.email)
          .order("booking_date", { ascending: false });
        setBookings((data as Booking[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6ee]">
        <Loader2 className="h-7 w-7 animate-spin text-[#A21228]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf6ee] text-center px-6">
        <div className="h-16 w-16 rounded-full bg-[#A21228]/10 flex items-center justify-center mb-4">
          <CalendarDays className="h-8 w-8 text-[#A21228]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Sign in to see your bookings</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Track upcoming massages and rebook your favourites in one tap.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 h-12 px-6 rounded-full bg-[#A21228] text-white font-semibold shadow-lg"
        >
          Sign in
        </button>
        <button
          onClick={() => navigate("/app/massages")}
          className="mt-3 text-sm text-gray-500 underline"
        >
          Browse studios instead
        </button>
      </div>
    );
  }

  const today = todayISO();
  const upcoming = bookings.filter(b => b.status !== "cancelled" && b.booking_date >= today);
  const past = bookings.filter(b => !(b.status !== "cancelled" && b.booking_date >= today));

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

  const renderCard = (b: Booking) => (
    <div key={b.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{b.spa_name}</p>
          <p className="text-sm text-gray-500 truncate">{b.massage_type}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle(b.status)}`}>
          {b.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-2">
        📅 {formatDate(b.booking_date)} at {b.booking_time}
      </p>
      <button
        onClick={() => navigate(`/s/${b.partner_id}`)}
        className="mt-3 w-full h-10 rounded-xl bg-[#A21228]/5 text-[#A21228] text-sm font-semibold border border-[#A21228]/20"
      >
        Rebook
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf6ee] pb-12">
      <div className="max-w-lg mx-auto px-5 pt-6">
        <button
          onClick={() => navigate("/app/massages")}
          className="flex items-center gap-1 text-sm text-gray-500 mb-3"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">My bookings</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">Signed in as {name}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-sm text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-200">
              No upcoming bookings.
            </p>
          ) : (
            <div className="space-y-3">{upcoming.map(renderCard)}</div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Past</h2>
          {past.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-200">
              No past bookings yet.
            </p>
          ) : (
            <div className="space-y-3">{past.map(renderCard)}</div>
          )}
        </section>
      </div>
    </div>
  );
}
