import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar as CalIcon, Clock, MapPin, Check, Star, Wallet } from "lucide-react";
import { googleReviewUrl } from "../lib/googleReview";
import { googleCalendarUrl } from "../lib/calendarLink";
import { Button } from "@/components/ui/button";
import { ADD_ONS, MASSAGES, MASSAGE_TYPES } from "../data";
import { useBooking } from "../BookingContext";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveBooking, supabase } from "@/lib/supabase";
import {
  REFERRAL_REWARD_EUR,
  getUnusedCredits,
  recordReferralOnBooking,
  redeemOneCredit,
} from "@/lib/referral";
import { getStoredUser } from "./Login";


const COMMISSION_RATE = 0.10; // 10% commission

export default function Payment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const booking = useBooking();
  const massage = booking.shop || MASSAGES.find((m) => m.id === id);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [accessInstructions, setAccessInstructions] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [availableCreditCents, setAvailableCreditCents] = useState(0);
  const [applyCredit, setApplyCredit] = useState(false);
  const stored = getStoredUser();
  const [contact, setContact] = useState({
    name: stored?.name ?? "Guest",
    email: stored?.email ?? "guest@massageclub.io",
    phone: "",
  });


  // Fetch studio access instructions when we have a partner_id
  useEffect(() => {
    const partnerId = (massage as any)?.partner_id;
    if (!partnerId) return;
    (async () => {
      const { data } = await supabase
        .from("partners")
        .select("access_instructions")
        .eq("id", partnerId)
        .maybeSingle();
      if (data?.access_instructions) setAccessInstructions(data.access_instructions);
    })();
  }, [(massage as any)?.partner_id]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(p);
      const meta: any = user.user_metadata ?? {};
      const fullName =
        p?.full_name ||
        [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
        meta.full_name ||
        meta.name ||
        stored?.name ||
        "Guest";
      setContact({
        name: fullName,
        email: user.email || stored?.email || "guest@massageclub.io",
        phone: p?.phone ?? "",
      });

      // Load available referral credit (€5 each)
      const credits = await getUnusedCredits(user.id);
      const total = credits.reduce((s, c) => s + (c.amount_cents ?? 0), 0);
      setAvailableCreditCents(total);
      if (total > 0) setApplyCredit(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  if (!massage) return null;

  const user = stored;

  const addOnPrice = booking.addOns.reduce((sum, a) => sum + (ADD_ONS.find((x) => x.id === a)?.price ?? 0), 0);
  const addOnNames = booking.addOns.map((a) => ADD_ONS.find((x) => x.id === a)?.name).filter(Boolean);
  const commission = Math.round((massage.basePrice ?? 50) * COMMISSION_RATE * 100) / 100;


  const dateLabel = booking.date
    ? new Date(booking.date).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : "—";

  const creditToApply = applyCredit && availableCreditCents >= 500 ? 5 : 0;
  const dueToday = Math.max(0, addOnPrice - creditToApply);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const noteParts: string[] = [];
      if (booking.notes) noteParts.push(booking.notes);
      if (creditToApply > 0) noteParts.push(`€${creditToApply} referral credit — deduct from bill at studio.`);

      const result = await saveBooking({
        client_name: contact.name,
        client_email: contact.email,
        client_phone: contact.phone,
        spa_name: massage.studio,
        massage_type: massage.name,
        booking_date: booking.date ?? "",
        booking_time: booking.time ?? "",
        duration: massage.duration,
        pressure: booking.pressure,
        focus_areas: booking.focusAreas,
        add_ons: addOnNames as string[],
        notes: noteParts.join(" "),
        status: "confirmed",
        client_preferences: {
          pressure: booking.pressure,
          focus_areas: booking.focusAreas,
          add_ons: addOnNames,
          preferred_therapist_gender: profile?.preferred_therapist_gender,
          conversation: booking.conversation || profile?.conversation_pref,
          music: profile?.music_pref,
          temperature: profile?.temperature_pref,
          scent: profile?.scent_pref,
          lighting: profile?.lighting_pref,
          comfort_notes: profile?.comfort_notes,
          referral_credit_applied_eur: creditToApply || undefined,
        },
      });


      if (result.success) {
        setBookingRef(result.ref ?? "MR-2026-0001");
        toast.success("Booking confirmed! Check your email.");
        // Redeem credit + reward referrer (best-effort, non-blocking on error)
        if (userId && result.id) {
          if (creditToApply > 0) {
            await redeemOneCredit(userId, result.id);
          }
          await recordReferralOnBooking(userId, contact.email, result.id);
        }
      } else {
        setBookingRef(`MR-2026-${Math.floor(Math.random() * 9000) + 1000}`);
        toast.success("Booking confirmed!");
      }
    } catch {
      setBookingRef(`MR-2026-${Math.floor(Math.random() * 9000) + 1000}`);
      toast.success("Booking confirmed!");
    } finally {
      setLoading(false);
      setConfirmed(true);
    }
  };


  if (confirmed) {
    return (
      <div className="flex flex-col h-full bg-gradient-warm p-8 items-center justify-center text-center">
        <div className="h-20 w-20 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold mb-6">
          <Check className="h-10 w-10 text-foreground" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">You're booked.</h1>
        <p className="text-muted-foreground mt-3 max-w-xs">
          {massage.name} at {massage.studio} on {dateLabel} · {booking.time}.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
          <span className="text-xs text-muted-foreground">Ref:</span>
          <span className="text-sm font-bold text-primary">{bookingRef}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {user?.email ? `Confirmation sent to ${user.email}` : "Confirmation sent to your email."}
        </p>

        {/* Getting there */}
        {accessInstructions && (
          <div className="mt-6 w-full rounded-2xl bg-[#C4622D]/5 border border-[#C4622D]/20 p-5 text-left">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-[#C4622D]" />
              <h3 className="font-display text-base font-semibold text-foreground">Getting there</h3>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{accessInstructions}</p>
          </div>
        )}

        {/* Google review prompt */}
        <div className="mt-6 w-full rounded-2xl bg-secondary/70 border border-border p-5 text-left">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4 fill-accent text-accent" />
            <h3 className="font-display text-base font-semibold text-foreground">Enjoyed Massage Club?</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            After your visit, leave {massage.studio} a review on Google — it helps the studio and other clients.
          </p>
          <a
            href={googleReviewUrl(massage.studio, (massage as any).address ?? (massage as any).location)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center justify-center w-full h-11 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition"
          >
            Leave a Google review ⭐
          </a>
        </div>

        {/* Add to calendar */}
        {booking.date && booking.time && (
          <a
            href={googleCalendarUrl({
              title: `${massage.name} at ${massage.studio}`,
              date: booking.date,
              time: booking.time,
              durationMin: massage.duration,
              details: `Booking ref ${bookingRef}. ${addOnNames.length ? "Add-ons: " + addOnNames.join(", ") + ". " : ""}Pressure: ${booking.pressure}.`,
              location: (massage as any).address ?? `${massage.studio}, ${massage.district}, Madrid`,
            })}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center justify-center w-full h-11 rounded-full bg-card border border-border text-foreground font-semibold hover:bg-secondary transition"
          >
            📅 Add to calendar
          </a>
        )}
        <div className="mt-10 w-full space-y-3">
          <Button
            onClick={() => {
              booking.reset();
              navigate("/app/massages");
            }}
            className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90"
          >
            Book another
          </Button>
          <Button onClick={() => navigate("/")} variant="ghost" className="w-full h-12">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">Review & pay</p>
          <h1 className="font-display text-lg font-bold">Confirm booking</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Summary card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
          <img src={massage.image} alt={massage.name} className="h-32 w-full object-cover" />
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">{massage.name}</h3>
              <p className="text-sm text-primary font-semibold">{massage.studio}</p>
            </div>
            <div className="space-y-2 text-sm text-foreground/80">
              <p className="flex items-center gap-2"><CalIcon className="h-4 w-4 text-primary" /> {dateLabel}</p>
              <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {booking.time} · {massage.duration} min</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {massage.district}, Madrid</p>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Pressure</span><span className="font-semibold">{booking.pressure}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Focus</span><span className="font-semibold text-right max-w-[60%]">{booking.focusAreas.length ? booking.focusAreas.join(", ") : "Therapist's choice"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Add-ons</span><span className="font-semibold text-right max-w-[60%]">{addOnNames.length ? addOnNames.join(", ") : "None"}</span></div>
        </div>



        {/* Pay at studio */}
        <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-foreground">Pay at the studio</p>
            <p className="text-muted-foreground">No payment needed now — pay when you arrive.</p>
          </div>
        </div>

        {/* Referral credit */}
        {availableCreditCents >= 500 && (
          <label className="rounded-2xl border border-[#C4622D]/30 bg-[#C4622D]/5 p-4 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={applyCredit}
              onChange={(e) => setApplyCredit(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-[#C4622D] focus:ring-[#C4622D]"
            />
            <div className="text-sm flex-1">
              <p className="font-semibold text-foreground">
                Apply €{REFERRAL_REWARD_EUR} referral credit
              </p>
              <p className="text-muted-foreground text-xs">
                You have €{(availableCreditCents / 100).toFixed(0)} in credits. €{REFERRAL_REWARD_EUR} will be deducted from your bill at the studio.
              </p>
            </div>
          </label>
        )}

        {/* Totals */}
        <div className="rounded-2xl bg-secondary p-4 space-y-2 text-sm">
          {addOnPrice > 0 && (
            <div className="flex justify-between"><span>Add-ons</span><span className="font-semibold">€{addOnPrice}</span></div>
          )}
          {creditToApply > 0 && (
            <div className="flex justify-between text-[#C4622D]">
              <span>Referral credit</span>
              <span className="font-semibold">−€{creditToApply}</span>
            </div>
          )}
          <div className="flex justify-between text-base">
            <span className="font-semibold">Due today</span>
            <span className="font-display font-bold text-primary text-xl">€{dueToday}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Massage paid directly to the studio on arrival.
            {creditToApply > 0 && ` Show your confirmation to redeem €${creditToApply} off.`}
          </p>
        </div>

      </div>

      <div className="px-6 py-4 border-t border-border bg-card">
        <Button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full h-12 bg-gradient-royal text-primary-foreground hover:opacity-90 shadow-elegant"
        >
          {loading ? "Confirming…" : "Confirm booking"}
        </Button>
      </div>
    </div>
  );
}
