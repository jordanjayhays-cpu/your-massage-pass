import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, LogOut, CalendarDays, ArrowLeft, UserCircle2, Star, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { googleReviewUrl } from "../lib/googleReview";
import { TIME_SLOTS, getNextDays } from "../data";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

type Partner = {
  id?: string;
  slug?: string | null;
  address?: string | null;
  access_instructions?: string | null;
  opening_hours?: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
  capacity?: number | null;
  partner_availability?: { day_of_week: number; time_slot: string }[];
};


type Booking = {
  id: string | number;
  spa_name: string;
  massage_type: string;
  booking_date: string;
  booking_time: string;
  status: string;
  partner_id: string;
  price: number | null;
  action_token?: string | null;
  reviewed_at?: string | null;
  partners?: Partner | null;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (iso: string, t: any) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayName = t(`days.${DAY_KEYS[dt.getDay()]}`);
  const monthName = t(`months.${MONTH_KEYS[dt.getMonth()]}`);
  return `${dayName} ${dt.getDate()} ${monthName}`;
};

const statusStyle = (s: string) => {
  if (s === "confirmed") return "bg-emerald-100 text-emerald-700";
  if (s === "cancelled") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

const pad = (n: number) => String(n).padStart(2, "0");

function generateSlots(open: string, close: string): string[] {
  if (!open || !close) return [];
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const start = oh * 60 + (om || 0);
  const end = ch * 60 + (cm || 0);
  const out: string[] = [];
  for (let m = start; m < end; m += 60) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export default function MyBookings() {
  const { t } = useTranslation(undefined, { keyPrefix: "app.myBookings" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user?.id || user?.email) {
      const filters: string[] = [];
      if (user?.id) filters.push(`user_id.eq.${user.id}`);
      if (user?.email) filters.push(`client_email.eq.${user.email}`);
      const { data } = await supabase
        .from("bookings")
        .select(`
          id, spa_name, massage_type, booking_date, booking_time, status, partner_id, price, action_token, reviewed_at,
          partners ( id, slug, address, access_instructions, opening_hours, capacity,
                     partner_availability ( day_of_week, time_slot ) )
        `)
        .or(filters.join(","))

        .order("booking_date", { ascending: false });
      setBookings((data as any as Booking[]) || []);
    }
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const cancelBooking = async (b: Booking) => {
    if (!confirm(t("cancelConfirm", { type: b.massage_type, date: formatDate(b.booking_date, t), time: b.booking_time }))) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
    if (error) { toast.error(t("messages.cancelError", { message: error.message })); return; }
    toast.success(t("messages.cancelSuccess"));
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4F0]">
        <Loader2 className="h-7 w-7 animate-spin text-[#C4622D]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F4F0] text-center px-6">
        <div className="h-16 w-16 rounded-full bg-[#C4622D]/10 flex items-center justify-center mb-4">
          <CalendarDays className="h-8 w-8 text-[#C4622D]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{t("auth.title")}</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          {t("auth.description")}
        </p>
        <button onClick={() => navigate("/")} className="mt-6 h-12 px-6 rounded-full bg-[#C4622D] text-white font-semibold shadow-lg">
          {t("auth.signIn")}
        </button>
        <button onClick={() => navigate("/app/massages")} className="mt-3 text-sm text-gray-500 underline">
          {t("auth.browse")}
        </button>
      </div>
    );
  }

  const today = todayISO();
  const upcoming = bookings.filter(b => b.status !== "cancelled" && b.booking_date >= today);
  const past = bookings.filter(b => !(b.status !== "cancelled" && b.booking_date >= today));
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

  const renderCard = (b: Booking, isPast = false) => {
    const access = b.partners?.access_instructions;
    return (
      <div key={b.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{b.spa_name}</p>
            <p className="text-sm text-gray-500 truncate">{b.massage_type}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle(b.status)}`}>
            {t(`card.status.${b.status}`, { defaultValue: b.status })}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          📅 {formatDate(b.booking_date, t)} {t("card.at")} {b.booking_time}
        </p>

        {!isPast && access && (
          <div className="mt-3 p-3 rounded-xl bg-[#C4622D]/5 border border-[#C4622D]/15">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#C4622D] flex items-center gap-1">
              <MapPin size={12} /> {t("card.gettingThere")}
            </p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{access}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2 flex-wrap">
          {!isPast && (
            <>
              <button
                onClick={() => setRescheduling(b)}
                className="flex-1 min-w-[100px] h-10 rounded-xl bg-[#C4622D] text-white text-sm font-semibold"
              >
                {t("card.reschedule")}
              </button>
              <button
                onClick={() => cancelBooking(b)}
                className="flex-1 min-w-[100px] h-10 rounded-xl bg-white text-red-600 text-sm font-semibold border border-red-200 hover:bg-red-50"
              >
                {t("card.cancel")}
              </button>
            </>
          )}
          {b.partner_id && (
            <button
              onClick={() => navigate(`/book/${b.partners?.slug || b.partner_id}?rebook=${b.id}`)}
              className="flex-1 min-w-[100px] h-10 rounded-xl bg-[#C4622D] text-white text-sm font-semibold shadow-sm"
            >
              {t("card.rebook", { defaultValue: "Book again" })}
            </button>
          )}

          {isPast && (
            <a
              href={googleReviewUrl(b.spa_name, b.partners?.address ?? undefined)}
              target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1 px-4 h-10 rounded-xl border border-[#C4622D]/30 text-[#C4622D] text-sm font-semibold hover:bg-[#C4622D]/5"
            >
              <Star size={14} className="fill-[#E0A458] text-[#E0A458]" /> {t("card.review")}
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F4F0] pb-12">
      <div className="max-w-lg mx-auto px-5 pt-6">
        <button onClick={() => navigate("/app/massages")} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
          <ArrowLeft size={14} /> {t("back")}
        </button>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{t("signedInAs", { name })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/app/profile")} className="flex items-center gap-1 text-sm text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 bg-white">
              <UserCircle2 size={14} /> {t("profile")}
            </button>
            <button onClick={signOut} className="flex items-center gap-1 text-sm text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-white">
              <LogOut size={14} /> {t("signOut")}
            </button>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("sections.upcoming")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-200">{t("emptyStates.noUpcoming")}</p>
          ) : (
            <div className="space-y-3">{upcoming.map((b) => renderCard(b, false))}</div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("sections.past")}</h2>
          {past.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-200">{t("emptyStates.noPast")}</p>
          ) : (
            <div className="space-y-3">{past.map((b) => renderCard(b, true))}</div>
          )}
        </section>
      </div>

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => { setRescheduling(null); load(); }}
        />
      )}
    </div>
  );
}

function RescheduleModal({
  booking, onClose, onSaved,
}: {
  booking: Booking;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "app.myBookings" });
  const [date, setDate] = useState<string>(booking.booking_date);
  const [time, setTime] = useState<string>(booking.booking_time?.slice(0, 5) ?? "");
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const days = getNextDays(14);

  const partner = booking.partners;
  const capacity = Math.max(1, Number(partner?.capacity) || 1);

  const slots = useMemo(() => {
    if (!date) return [];
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    const key = DAY_KEYS[dow];
    let base: string[] = [];
    const hours = partner?.opening_hours?.[key];
    if (hours && !hours.closed && hours.open && hours.close) {
      base = generateSlots(hours.open, hours.close);
    } else if (partner?.partner_availability?.length) {
      base = partner.partner_availability
        .filter((a) => Number(a.day_of_week) === dow)
        .map((a) => a.time_slot.slice(0, 5))
        .sort();
    } else {
      base = TIME_SLOTS;
    }
    const today = new Date();
    const isToday = today.toISOString().slice(0, 10) === date;
    if (isToday) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      base = base.filter((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + (m || 0) > nowMin;
      });
    }
    return base;
  }, [date, partner]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!date || !booking.partner_id) { setBookedCounts({}); return; }
      const { data } = await supabase
        .from("bookings")
        .select("id, booking_time")
        .eq("partner_id", booking.partner_id)
        .eq("booking_date", date)
        .neq("status", "cancelled");
      const counts: Record<string, number> = {};
      for (const b of data ?? []) {
        if (String(b.id) === String(booking.id)) continue; // exclude self
        const t = (b.booking_time || "").slice(0, 5);
        counts[t] = (counts[t] || 0) + 1;
      }
      if (!cancelled) setBookedCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [date, booking.partner_id, booking.id]);

  const isFull = (t: string) => (bookedCounts[t] || 0) >= capacity;

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({ booking_date: date, booking_time: time })
      .eq("id", booking.id);
    setSaving(false);
    if (error) { toast.error(t("messages.rescheduleError", { message: error.message })); return; }
    toast.success(t("messages.rescheduleSuccess"));
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-gray-900">{t("rescheduleModal.title")}</h3>
              <p className="text-sm text-gray-500">{booking.spa_name} — {booking.massage_type}</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={16} />
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("rescheduleModal.chooseDay")}</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {days.map((d) => {
                const selected = date === d.iso;
                return (
                  <button
                    key={d.iso}
                    onClick={() => { setDate(d.iso); setTime(""); }}
                    className={cn(
                      "flex-shrink-0 w-14 h-20 rounded-2xl flex flex-col items-center justify-center border transition-all",
                      selected
                        ? "bg-[#C4622D] text-white border-[#C4622D] shadow"
                        : "bg-white border-gray-200 text-gray-800 hover:border-[#C4622D]/50",
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-80">
                      {t(`days.${DAY_KEYS[d.date.getDay()]}`)}
                    </span>
                    <span className="font-display text-2xl font-bold mt-1">{d.date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("rescheduleModal.availableTimes")}</p>
            {slots.length === 0 ? (
              <p className="text-sm text-gray-500">{t("rescheduleModal.closed")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((t_slot) => {
                  const selected = time === t_slot;
                  const full = isFull(t_slot);
                  return (
                    <button
                      key={t_slot}
                      onClick={() => !full && setTime(t_slot)}
                      disabled={full}
                      className={cn(
                        "h-11 rounded-xl border text-sm font-semibold flex items-center justify-center",
                        full ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : selected ? "bg-[#C4622D] text-white border-[#C4622D]"
                            : "bg-white border-gray-200 text-gray-800 hover:border-[#C4622D]/50",
                      )}
                    >
                      {full ? t("rescheduleModal.full") : t_slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!date || !time || saving}
            className="w-full h-12 rounded-xl bg-[#C4622D] text-white font-semibold disabled:opacity-50"
          >
            {saving ? t("rescheduleModal.saving") : t("rescheduleModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
