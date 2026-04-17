import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar as CalIcon, Clock, MapPin, CreditCard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADD_ONS, MASSAGES } from "../data";
import { useBooking } from "../BookingContext";
import { useState } from "react";
import { toast } from "sonner";

export default function Payment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const booking = useBooking();
  const massage = MASSAGES.find((m) => m.id === id);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!massage) return null;

  const addOnPrice = booking.addOns.reduce((sum, a) => sum + (ADD_ONS.find((x) => x.id === a)?.price ?? 0), 0);

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setConfirmed(true);
      toast.success("Booking confirmed!");
    }, 900);
  };

  const dateLabel = booking.date
    ? new Date(booking.date).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : "—";

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
        <p className="text-sm text-muted-foreground mt-2">A confirmation email is on its way.</p>
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
          <div className="flex justify-between"><span className="text-muted-foreground">Add-ons</span><span className="font-semibold text-right max-w-[60%]">{booking.addOns.length ? booking.addOns.map((a) => ADD_ONS.find((x) => x.id === a)?.name).join(", ") : "None"}</span></div>
        </div>

        {/* Payment method */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Payment</h3>
          <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Massage Madrid Membership</p>
              <p className="text-xs text-muted-foreground">€79/month · Unlimited bookings</p>
            </div>
            <span className="text-xs font-semibold text-primary">Active</span>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-2xl bg-secondary p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Massage</span><span className="font-semibold">Included</span></div>
          {addOnPrice > 0 && (
            <div className="flex justify-between"><span>Add-ons</span><span className="font-semibold">€{addOnPrice}</span></div>
          )}
          <div className="border-t border-border pt-2 flex justify-between text-base">
            <span className="font-semibold">Total today</span>
            <span className="font-display font-bold text-primary text-xl">€{addOnPrice}</span>
          </div>
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
