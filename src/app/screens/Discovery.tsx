import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, ChevronRight } from "lucide-react";
import { MASSAGE_TYPES, MASSAGES } from "../data";
import NearbyMap from "../components/NearbyMap";
import { useBooking } from "../BookingContext";

export default function Discovery() {
  const navigate = useNavigate();
  const { set } = useBooking();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-card flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">Massage discovery</p>
          <h1 className="font-display text-lg font-bold">Learn about each style</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Quiz CTA */}
        <button
          onClick={() => navigate("/discovery/quiz")}
          className="w-full text-left rounded-2xl p-5 bg-gradient-royal text-primary-foreground shadow-elegant relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-accent/20 text-accent rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Find your match
            </div>
            <h2 className="font-display text-2xl font-bold mt-3">Not sure which to try?</h2>
            <p className="text-sm text-primary-foreground/80 mt-1">
              Answer 4 quick questions and we'll suggest the perfect massage for you.
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
              Take the quiz <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </button>

        {/* Nearby map (real geolocation) */}
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-3">Studios near you</h3>
          <NearbyMap
            massages={MASSAGES}
            compact
            onSelect={(m) => {
              set({ massageId: m.id });
              navigate(`/massages/${m.id}`);
            }}
          />
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-3">Massage types</h3>
          <div className="grid grid-cols-2 gap-3">
            {MASSAGE_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/discovery/${t.id}`)}
                className="text-left rounded-2xl overflow-hidden bg-card border border-border shadow-soft hover:shadow-elegant hover:-translate-y-0.5 transition-all"
              >
                <div className="relative h-28">
                  <img src={t.image} alt={t.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <h4 className="font-display text-base font-bold text-primary-foreground">{t.name}</h4>
                  </div>
                </div>
                <p className="px-3 py-2.5 text-xs text-muted-foreground leading-snug">{t.short}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
